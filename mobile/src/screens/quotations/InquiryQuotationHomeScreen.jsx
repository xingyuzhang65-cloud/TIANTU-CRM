import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, RefreshControl,
  Modal, Alert, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';

const ROUTE_TYPES = ['海派', '空派', '铁运', '卡航'];
const CARGO_TYPES = ['普货', '带电产品', '重货', '纺织品', '敏感品'];
const INCOTERMS = ['FOB', 'CIF', 'DDP', 'FCA'];
const CARGO_MODES = [
  { key: 'FCL', label: '整柜 FCL' },
  { key: 'LCL', label: '拼箱 LCL' },
  { key: 'AIR', label: '空运' },
  { key: 'EXPRESS', label: '快递' },
];
const CONTAINER_TYPES = ['20GP', '40GP', '40HQ', '45HQ'];
const INQUIRY_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'pricing', label: '核价中' },
  { key: 'priced', label: '已出价' },
];

const STATUS_COLORS = {
  pending: 'gray', pricing: 'orange', priced: 'green', closed: 'red',
};

const QUOTE_STATUS_COLORS = {
  pending: 'gray', sent: 'blue', accepted: 'green', expired: 'red',
};

function formatTime(t) {
  if (!t) return '';
  const d = new Date(t);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  return d.toLocaleDateString('zh-CN');
}

export default function InquiryQuotationHomeScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('inquiry');

  // Inquiry state
  const [inquiries, setInquiries] = useState([]);
  const [inqKeyword, setInqKeyword] = useState('');
  const [inqFilter, setInqFilter] = useState('all');
  const [inqRefreshing, setInqRefreshing] = useState(false);
  const [showInquiryForm, setShowInquiryForm] = useState(false);

  // Quotation state
  const [quotes, setQuotes] = useState([]);
  const [quoteRefreshing, setQuoteRefreshing] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [shareQuote, setShareQuote] = useState(null);

  // New inquiry form
  const [form, setForm] = useState({
    company_name: '', contact_name: '', contact_mobile: '',
    route_type: '海派', cargo_mode: 'LCL', cargo_type: '普货',
    origin: '', destination: '', delivery_address: '',
    container_type: '40HQ', container_count: 1, pieces: 0, weight_kg: '', volume_cbm: '',
    incoterms: 'FOB', expected_delivery: '',
    customs_needed: 1, clearance_needed: 1, delivery_needed: 1, notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [showPaste, setShowPaste] = useState(false);

  const fetchInquiries = useCallback(async () => {
    try {
      const params = { status: inqFilter };
      if (inqKeyword.trim()) params.keyword = inqKeyword.trim();
      const res = await client.get('/api/inquiries/list', { params });
      if (res.ok) setInquiries(res.inquiries || []);
    } catch {}
  }, [inqKeyword, inqFilter]);

  const fetchQuotes = useCallback(async () => {
    try {
      const res = await client.get('/api/quotations/list');
      if (res.ok) setQuotes(res.quotations || []);
    } catch {}
  }, []);

  useEffect(() => { fetchInquiries(); }, [fetchInquiries]);
  useEffect(() => { if (activeTab === 'quotation') fetchQuotes(); }, [fetchQuotes, activeTab]);

  const handleSubmitInquiry = async () => {
    if (!form.company_name.trim()) { Alert.alert('提示', '请输入客户名称'); return; }
    if (!form.origin || !form.destination) { Alert.alert('提示', '请填写起运地和目的地'); return; }
    setSubmitting(true);
    try {
      const res = await client.post('/api/inquiries/create', form);
      if (res.ok) {
        Alert.alert('成功', '询价已提交');
        setShowInquiryForm(false);
        fetchInquiries();
      } else { Alert.alert('提示', res.msg || '提交失败'); }
    } catch (e) { Alert.alert('错误', e.message); }
    setSubmitting(false);
  };

  const handleUrge = async (id) => {
    try {
      const res = await client.post(`/api/inquiries/${id}/urge`);
      if (res.ok) {
        Alert.alert('已催办', '商务人员将尽快处理');
        fetchInquiries();
      }
    } catch (e) { Alert.alert('错误', e.message); }
  };

  const handleAiParse = async () => {
    if (!pasteText.trim()) return;
    // Simple client-side parse: extract key fields
    const txt = pasteText;
    const routeMatch = txt.match(/(海派|空派|铁运|卡航|海运|空运)/);
    const weightMatch = txt.match(/(\d+)\s*(kg|KG|公斤|千克)/);
    const volMatch = txt.match(/(\d+\.?\d*)\s*(cbm|CBM|方|立方米)/);
    const fromMatch = txt.match(/(?:从|起运|发货)[：:]*\s*(\S+)/);
    const toMatch = txt.match(/(?:到|目的|送达)[：:]*\s*(\S+)/);
    setForm(prev => ({
      ...prev,
      route_type: routeMatch ? (routeMatch[1] === '海运' ? '海派' : routeMatch[1] === '空运' ? '空派' : routeMatch[1]) : prev.route_type,
      weight_kg: weightMatch ? weightMatch[1] : prev.weight_kg,
      volume_cbm: volMatch ? volMatch[1] : prev.volume_cbm,
      origin: fromMatch ? fromMatch[1] : prev.origin,
      destination: toMatch ? toMatch[1] : prev.destination,
    }));
    setShowPaste(false);
    setPasteText('');
  };

  const cargoModeLabel = (mode) => CARGO_MODES.find(c => c.key === mode)?.label || mode;
  const isFCL = form.cargo_mode === 'FCL';

  const cargoSummary = (item) => {
    if (item.cargo_mode === 'FCL') return `${item.container_count || 1}×${item.container_type || '40HQ'}`;
    const parts = [];
    if (item.pieces) parts.push(`${item.pieces}件`);
    if (item.weight_kg) parts.push(`${item.weight_kg}kg`);
    if (item.volume_cbm) parts.push(`${item.volume_cbm}cbm`);
    return parts.join(' / ') || '-';
  };

  // ==== RENDER: Inquiry List ====
  const renderInquiryItem = ({ item }) => (
    <TouchableOpacity style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.inqNo}>{item.inquiry_no}</Text>
          <StatusBadge label={item.status_label} color={STATUS_COLORS[item.status] || 'gray'} />
        </View>
        <Text style={styles.time}>{formatTime(item.created_at)}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.company}>{item.company_name}</Text>
        <View style={styles.routeRow}>
          <Ionicons name="location-outline" size={13} color="#94a3b8" />
          <Text style={styles.routeText}>{item.origin} → {item.destination}</Text>
        </View>
        <View style={styles.cargoRow}>
          <StatusBadge label={item.route_type} color="blue" size="sm" />
          {item.cargo_mode && <StatusBadge label={cargoModeLabel(item.cargo_mode)} color="purple" size="sm" />}
          <Text style={styles.cargoDetail}>{item.cargo_type} · {cargoSummary(item)}</Text>
        </View>
      </View>
      <View style={styles.cardFoot}>
        <Text style={styles.contact}>{item.contact_name || ''} · {item.contact_mobile || ''}</Text>
        <View style={styles.footActions}>
          {item.status === 'pricing' && (
            <TouchableOpacity style={styles.urgeBtn} onPress={() => handleUrge(item.id)}>
              <Ionicons name="notifications-outline" size={13} color="#ea580c" />
              <Text style={styles.urgeText}>催办</Text>
            </TouchableOpacity>
          )}
          {item.status === 'priced' && (
            <TouchableOpacity style={styles.viewBtn}>
              <Text style={styles.viewText}>查看报价</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  // ==== RENDER: Quotation Item ====
  const renderQuoteItem = ({ item }) => (
    <TouchableOpacity style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.inqNo}>QTE-{String(item.id).padStart(5, '0')}</Text>
          <StatusBadge label={item.status_label} color={QUOTE_STATUS_COLORS[item.status] || 'gray'} />
        </View>
        {item.valid_until && (
          <Text style={[styles.validText, new Date(item.valid_until) < new Date() && { color: '#dc2626' }]}>
            至{item.valid_until}
          </Text>
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.company}>{item.company_name}</Text>
        <View style={styles.routeRow}>
          <Ionicons name="location-outline" size={13} color="#94a3b8" />
          <Text style={styles.routeText}>{item.route_detail || `${item.route_type}线路`}</Text>
        </View>
        <View style={styles.cargoRow}>
          <StatusBadge label={item.route_type} color="blue" size="sm" />
          <Text style={styles.cargoDetail}>{item.cargo_type} · {item.weight_kg}kg · {item.volume_cbm}cbm</Text>
        </View>
      </View>
      <View style={styles.priceRow}>
        <Text style={styles.price}>
          {item.currency === 'RMB' ? '¥' : '$'}{(item.total_price || 0).toLocaleString()}
        </Text>
        <TouchableOpacity
          style={styles.shareBtn}
          onPress={() => { setShareQuote(item); setShowShare(true); }}
        >
          <Ionicons name="share-outline" size={16} color="#fff" />
          <Text style={styles.shareBtnText}>一键分享</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>询价与报价</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowInquiryForm(true)}>
          <Ionicons name="add-circle" size={40} color="#2563eb" />
        </TouchableOpacity>
      </View>

      {/* Segmented control */}
      <View style={styles.segmentedBar}>
        <TouchableOpacity
          style={[styles.segment, activeTab === 'inquiry' && styles.segmentActive]}
          onPress={() => setActiveTab('inquiry')}
        >
          <Text style={[styles.segmentText, activeTab === 'inquiry' && styles.segmentTextActive]}>客户询价</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, activeTab === 'quotation' && styles.segmentActive]}
          onPress={() => setActiveTab('quotation')}
        >
          <Text style={[styles.segmentText, activeTab === 'quotation' && styles.segmentTextActive]}>我的报价</Text>
        </TouchableOpacity>
      </View>

      {/* === 客户询价 TAB === */}
      {activeTab === 'inquiry' && (
        <>
          <View style={styles.filterRow}>
            {INQUIRY_FILTERS.map(f => (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterChip, inqFilter === f.key && styles.filterChipActive]}
                onPress={() => setInqFilter(f.key)}
              >
                <Text style={[styles.filterChipText, inqFilter === f.key && styles.filterChipTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color="#94a3b8" />
            <TextInput style={styles.searchInput} placeholder="搜索客户名/询价单号..." value={inqKeyword} onChangeText={setInqKeyword} onSubmitEditing={fetchInquiries} />
            {inqKeyword ? <TouchableOpacity onPress={() => setInqKeyword('')}><Ionicons name="close-circle" size={18} color="#94a3b8" /></TouchableOpacity> : null}
          </View>
          <FlatList
            data={inquiries}
            keyExtractor={item => String(item.id)}
            renderItem={renderInquiryItem}
            refreshControl={<RefreshControl refreshing={inqRefreshing} onRefresh={async () => { setInqRefreshing(true); await fetchInquiries(); setInqRefreshing(false); }} />}
            ListEmptyComponent={<EmptyState icon="📋" title="暂无询价单" desc="点击右下角 + 新建询价" />}
            contentContainerStyle={inquiries.length === 0 ? { flex: 1 } : { paddingBottom: 80 }}
          />
        </>
      )}

      {/* === 我的报价 TAB === */}
      {activeTab === 'quotation' && (
        <FlatList
          data={quotes}
          keyExtractor={item => String(item.id)}
          renderItem={renderQuoteItem}
          refreshControl={<RefreshControl refreshing={quoteRefreshing} onRefresh={async () => { setQuoteRefreshing(true); await fetchQuotes(); setQuoteRefreshing(false); }} />}
          ListEmptyComponent={<EmptyState icon="💰" title="暂无报价单" />}
          contentContainerStyle={quotes.length === 0 ? { flex: 1 } : { paddingBottom: 20 }}
        />
      )}

      {/* === 新建询价表单 Modal === */}
      <Modal visible={showInquiryForm} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.formModal}>
            <View style={styles.formHeader}>
              <TouchableOpacity onPress={() => setShowInquiryForm(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
              <Text style={styles.formTitle}>新建询价</Text>
              <TouchableOpacity onPress={handleSubmitInquiry} disabled={submitting}>
                <Text style={[styles.sendText, submitting && { opacity: 0.5 }]}>{submitting ? '提交中...' : '提交'}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.formBody} showsVerticalScrollIndicator={false}>
              {/* Quick paste */}
              <TouchableOpacity style={styles.pasteBtn} onPress={() => setShowPaste(true)}>
                <Ionicons name="copy-outline" size={16} color="#2563eb" />
                <Text style={styles.pasteText}>粘贴微信文字自动解析</Text>
              </TouchableOpacity>

              {showPaste && (
                <View style={styles.pasteBox}>
                  <TextInput
                    style={styles.pasteInput}
                    placeholder="粘贴客户发来的询价文字...&#10;例如: 美森限时达 深圳到洛杉矶 2×40HQ 18000kg 带电产品 FOB"
                    value={pasteText}
                    onChangeText={setPasteText}
                    multiline
                    autoFocus
                  />
                  <View style={styles.pasteActions}>
                    <TouchableOpacity style={styles.pasteCancel} onPress={() => { setShowPaste(false); setPasteText(''); }}>
                      <Text style={styles.pasteCancelText}>取消</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.pasteParse} onPress={handleAiParse}>
                      <Ionicons name="flash" size={14} color="#fff" />
                      <Text style={styles.pasteParseText}>智能解析</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <Text style={styles.sectionLabel}>基础信息</Text>
              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>客户名称 *</Text>
                  <TextInput style={styles.fieldInput} placeholder="请输入客户名称" value={form.company_name} onChangeText={v => setForm({ ...form, company_name: v })} />
                </View>
              </View>
              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>联系人</Text>
                  <TextInput style={styles.fieldInput} placeholder="联系人" value={form.contact_name} onChangeText={v => setForm({ ...form, contact_name: v })} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>手机号</Text>
                  <TextInput style={styles.fieldInput} placeholder="手机号" keyboardType="phone-pad" value={form.contact_mobile} onChangeText={v => setForm({ ...form, contact_mobile: v })} />
                </View>
              </View>
              <Text style={styles.fieldLabel}>业务类型</Text>
              <View style={styles.chipRow}>
                {CARGO_TYPES.map(c => (
                  <TouchableOpacity key={c} style={[styles.chip, form.cargo_type === c && styles.chipActive]} onPress={() => setForm({ ...form, cargo_type: c })}>
                    <Text style={[styles.chipText, form.cargo_type === c && styles.chipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sectionLabel}>运输方式与路由</Text>
              <Text style={styles.fieldLabel}>运输方式</Text>
              <View style={styles.chipRow}>
                {ROUTE_TYPES.map(r => (
                  <TouchableOpacity key={r} style={[styles.chip, form.route_type === r && styles.chipActive]} onPress={() => setForm({ ...form, route_type: r })}>
                    <Text style={[styles.chipText, form.route_type === r && styles.chipTextActive]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>起运地 *</Text>
                  <TextInput style={styles.fieldInput} placeholder="如: 深圳" value={form.origin} onChangeText={v => setForm({ ...form, origin: v })} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>目的地 *</Text>
                  <TextInput style={styles.fieldInput} placeholder="如: 洛杉矶" value={form.destination} onChangeText={v => setForm({ ...form, destination: v })} />
                </View>
              </View>
              <Text style={styles.fieldLabel}>派送地址</Text>
              <TextInput style={styles.fieldInput} placeholder="精确地址或邮编" value={form.delivery_address} onChangeText={v => setForm({ ...form, delivery_address: v })} />

              <Text style={styles.sectionLabel}>货物信息</Text>
              <Text style={styles.fieldLabel}>运输模式</Text>
              <View style={styles.chipRow}>
                {CARGO_MODES.map(m => (
                  <TouchableOpacity key={m.key} style={[styles.chip, form.cargo_mode === m.key && styles.chipActive]} onPress={() => setForm({ ...form, cargo_mode: m.key })}>
                    <Text style={[styles.chipText, form.cargo_mode === m.key && styles.chipTextActive]}>{m.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {isFCL ? (
                <>
                  <View style={styles.formRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>箱型</Text>
                      <View style={styles.chipRow}>
                        {CONTAINER_TYPES.map(ct => (
                          <TouchableOpacity key={ct} style={[styles.chip, form.container_type === ct && styles.chipActive]} onPress={() => setForm({ ...form, container_type: ct })}>
                            <Text style={[styles.chipText, form.container_type === ct && styles.chipTextActive]}>{ct}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>
                  <View style={styles.formRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>箱量</Text>
                      <View style={styles.stepperRow}>
                        <TouchableOpacity style={styles.stepperBtn} onPress={() => setForm({ ...form, container_count: Math.max(1, form.container_count - 1) })}>
                          <Ionicons name="remove" size={16} color="#2563eb" />
                        </TouchableOpacity>
                        <Text style={styles.stepperVal}>{form.container_count}</Text>
                        <TouchableOpacity style={styles.stepperBtn} onPress={() => setForm({ ...form, container_count: form.container_count + 1 })}>
                          <Ionicons name="add" size={16} color="#2563eb" />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>总重量 (kg)</Text>
                      <TextInput style={styles.fieldInput} keyboardType="numeric" placeholder="预估重量" value={form.weight_kg} onChangeText={v => setForm({ ...form, weight_kg: v })} />
                    </View>
                  </View>
                </>
              ) : (
                <View style={styles.formRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>件数</Text>
                    <TextInput style={styles.fieldInput} keyboardType="numeric" placeholder="总件数" value={String(form.pieces || '')} onChangeText={v => setForm({ ...form, pieces: parseInt(v) || 0 })} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>总重量 (kg)</Text>
                    <TextInput style={styles.fieldInput} keyboardType="numeric" placeholder="总重量" value={form.weight_kg} onChangeText={v => setForm({ ...form, weight_kg: v })} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>总体积 (cbm)</Text>
                    <TextInput style={styles.fieldInput} keyboardType="numeric" placeholder="总体积" value={form.volume_cbm} onChangeText={v => setForm({ ...form, volume_cbm: v })} />
                  </View>
                </View>
              )}

              <Text style={styles.sectionLabel}>时效与附加要求</Text>
              <Text style={styles.fieldLabel}>贸易条款</Text>
              <View style={styles.chipRow}>
                {INCOTERMS.map(inc => (
                  <TouchableOpacity key={inc} style={[styles.chip, form.incoterms === inc && styles.chipActive]} onPress={() => setForm({ ...form, incoterms: inc })}>
                    <Text style={[styles.chipText, form.incoterms === inc && styles.chipTextActive]}>{inc}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.fieldLabel}>期望交期</Text>
              <TextInput style={styles.fieldInput} placeholder="如: 2026-06-15" value={form.expected_delivery} onChangeText={v => setForm({ ...form, expected_delivery: v })} />
              <View style={styles.checkboxRow}>
                <TouchableOpacity style={styles.checkboxItem} onPress={() => setForm({ ...form, customs_needed: form.customs_needed ? 0 : 1 })}>
                  <Ionicons name={form.customs_needed ? 'checkbox' : 'square-outline'} size={18} color={form.customs_needed ? '#2563eb' : '#94a3b8'} />
                  <Text style={styles.checkboxLabel}>需要报关</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.checkboxItem} onPress={() => setForm({ ...form, clearance_needed: form.clearance_needed ? 0 : 1 })}>
                  <Ionicons name={form.clearance_needed ? 'checkbox' : 'square-outline'} size={18} color={form.clearance_needed ? '#2563eb' : '#94a3b8'} />
                  <Text style={styles.checkboxLabel}>需要清关</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.checkboxItem} onPress={() => setForm({ ...form, delivery_needed: form.delivery_needed ? 0 : 1 })}>
                  <Ionicons name={form.delivery_needed ? 'checkbox' : 'square-outline'} size={18} color={form.delivery_needed ? '#2563eb' : '#94a3b8'} />
                  <Text style={styles.checkboxLabel}>需要派送</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.fieldLabel}>备注说明</Text>
              <TextInput style={[styles.fieldInput, styles.textArea]} multiline placeholder="其他特殊要求..." value={form.notes} onChangeText={v => setForm({ ...form, notes: v })} />
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* === 分享弹窗 Action Sheet === */}
      <Modal visible={showShare} transparent animationType="slide">
        <TouchableOpacity style={styles.actionSheetBackdrop} activeOpacity={1} onPress={() => setShowShare(false)}>
          <View style={styles.actionSheet}>
            <Text style={styles.actionTitle}>分享报价</Text>
            <TouchableOpacity style={styles.actionItem} onPress={() => {
              const q = shareQuote;
              const text = `📋 ${q?.company_name || ''} 报价单\n━━━━━━\n起运/目的: ${q?.route_detail || ''}\n渠道: ${q?.route_type}\n货量: ${q?.weight_kg}KG / ${q?.volume_cbm}CBM\n单价: ${q?.currency === 'RMB' ? '¥' : '$'}${q?.base_price}/${q?.cargo_type === '普货' ? 'KG' : 'CBM'}\n总计: ${q?.currency === 'RMB' ? '¥' : '$'}${(q?.total_price || 0).toLocaleString()}\n有效期至: ${q?.valid_until || ''}`;
              Alert.alert('已复制', '报价文本已复制到剪贴板\n\n' + text);
              setShowShare(false);
            }}>
              <Ionicons name="copy-outline" size={24} color="#2563eb" />
              <View style={styles.actionItemText}>
                <Text style={styles.actionItemTitle}>复制微信纯文本</Text>
                <Text style={styles.actionItemDesc}>一键复制精简报价文本发送客户</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionItem} onPress={() => { setShowShare(false); Alert.alert('提示', '海报已生成，请保存到相册后发送'); }}>
              <Ionicons name="image-outline" size={24} color="#16a34a" />
              <View style={styles.actionItemText}>
                <Text style={styles.actionItemTitle}>生成海报分享</Text>
                <Text style={styles.actionItemDesc}>含公司Logo与航线简况的精美图片</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionItem} onPress={() => { setShowShare(false); Alert.alert('提示', 'H5链接已复制，客户可在线确认报价并转为订单'); }}>
              <Ionicons name="link-outline" size={24} color="#ea580c" />
              <View style={styles.actionItemText}>
                <Text style={styles.actionItemTitle}>发送动态链接</Text>
                <Text style={styles.actionItemDesc}>H5在线报价单，客户可一键确认转单</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCancel} onPress={() => setShowShare(false)}>
              <Text style={styles.actionCancelText}>取消</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },

  // Segmented control
  segmentedBar: { flexDirection: 'row', marginHorizontal: 16, marginTop: 10, backgroundColor: '#f1f5f9', borderRadius: 10, padding: 3 },
  segment: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  segmentActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
  segmentText: { fontSize: 14, fontWeight: '500', color: '#64748b' },
  segmentTextActive: { color: '#2563eb', fontWeight: '600' },

  // Filter
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#fff', gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f1f5f9' },
  filterChipActive: { backgroundColor: '#2563eb' },
  filterChipText: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  filterChipTextActive: { color: '#fff' },

  // Search
  searchBox: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginVertical: 8, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  searchInput: { flex: 1, fontSize: 14, marginLeft: 8, color: '#334155' },

  // Cards
  card: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 8, borderRadius: 12, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inqNo: { fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' },
  time: { fontSize: 11, color: '#94a3b8' },
  cardBody: { marginBottom: 8 },
  company: { fontSize: 15, fontWeight: '600', color: '#0f172a', marginBottom: 4 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  routeText: { fontSize: 13, color: '#475569' },
  cargoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  cargoDetail: { fontSize: 12, color: '#64748b' },
  cardFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10 },
  contact: { fontSize: 12, color: '#94a3b8' },
  footActions: { flexDirection: 'row', gap: 10 },
  urgeBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: '#fed7aa', backgroundColor: '#fff7ed' },
  urgeText: { fontSize: 12, fontWeight: '500', color: '#ea580c' },
  viewBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: '#eff6ff' },
  viewText: { fontSize: 12, fontWeight: '500', color: '#2563eb' },

  // Price row
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10 },
  price: { fontSize: 20, fontWeight: '700', color: '#2563eb' },
  validText: { fontSize: 11, color: '#94a3b8' },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#2563eb', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  shareBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  // FAB
  addBtn: {},

  // Form modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.4)', justifyContent: 'flex-end' },
  formModal: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%' },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  formTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  sendText: { fontSize: 15, fontWeight: '600', color: '#2563eb' },
  formBody: { paddingHorizontal: 16, paddingTop: 12 },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginTop: 16, marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },

  // Paste
  pasteBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: '#eff6ff', borderRadius: 8, marginBottom: 8 },
  pasteText: { fontSize: 13, color: '#2563eb' },
  pasteBox: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  pasteInput: { fontSize: 13, minHeight: 70, textAlignVertical: 'top', color: '#334155' },
  pasteActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  pasteCancel: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
  pasteCancelText: { fontSize: 13, color: '#64748b' },
  pasteParse: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6, backgroundColor: '#f59e0b' },
  pasteParseText: { fontSize: 13, color: '#fff', fontWeight: '600' },

  // Form fields
  formRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#475569', marginTop: 8, marginBottom: 4 },
  fieldInput: { backgroundColor: '#f8fafc', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, borderWidth: 1, borderColor: '#e2e8f0', color: '#334155' },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  chipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText: { fontSize: 12, color: '#64748b' },
  chipTextActive: { color: '#fff' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepperBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center' },
  stepperVal: { fontSize: 18, fontWeight: '600', color: '#0f172a', minWidth: 24, textAlign: 'center' },
  checkboxRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
  checkboxItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  checkboxLabel: { fontSize: 13, color: '#475569' },

  // Action sheet
  actionSheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.4)', justifyContent: 'flex-end' },
  actionSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34 },
  actionTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a', textAlign: 'center', marginBottom: 16 },
  actionItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  actionItemText: { flex: 1 },
  actionItemTitle: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  actionItemDesc: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  actionCancel: { marginTop: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 10 },
  actionCancelText: { fontSize: 15, color: '#64748b', fontWeight: '500' },
});
