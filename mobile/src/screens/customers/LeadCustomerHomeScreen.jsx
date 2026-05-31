import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet,
  RefreshControl, Modal, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';

const STAGE_OPTIONS = [
  { key: 'developing', label: '开发中', statuses: ['lead', 'new', 'contacted'] },
  { key: 'negotiating', label: '报价谈判', statuses: ['nurturing', 'quoted', 'negotiating'] },
  { key: 'cooperating', label: '合作中', statuses: ['trial', 'active', 'receding'] },
  { key: 'archived', label: '已归档', statuses: ['disqualified', 'churned'] },
];

const STAGE_TO_LEAD_STATUS = {
  developing: 'lead',
  negotiating: 'negotiating',
  cooperating: 'active',
  archived: 'disqualified',
};

const STAGE_TO_CUST_STATUS = {
  developing: 'new',
  negotiating: 'negotiating',
  cooperating: 'active',
  archived: 'disqualified',
};

const STAGE_COLORS = {
  developing: '#2563eb',
  negotiating: '#ea580c',
  cooperating: '#16a34a',
  archived: '#94a3b8',
};

const FOLLOW_TYPES = [
  { key: 'call', label: '📞 电话' },
  { key: 'meeting', label: '🤝 会议' },
  { key: 'email', label: '📧 邮件' },
  { key: 'visit', label: '🏢 拜访' },
];

export default function LeadCustomerHomeScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [filterExpanded, setFilterExpanded] = useState(false);
  const [selectedStages, setSelectedStages] = useState([]);

  // Quick follow-up modal
  const [followVisible, setFollowVisible] = useState(false);
  const [followTarget, setFollowTarget] = useState(null);
  const [followType, setFollowType] = useState('call');
  const [followContent, setFollowContent] = useState('');
  const [saving, setSaving] = useState(false);

  // Stage edit modal
  const [stageVisible, setStageVisible] = useState(false);
  const [stageTarget, setStageTarget] = useState(null);
  const [stageSaving, setStageSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [leadsRes, custRes] = await Promise.all([
        client.get('/api/leads/list', { params: keyword.trim() ? { keyword: keyword.trim() } : {} }),
        client.get('/api/customers/list', { params: { keyword: keyword.trim() || undefined } }),
      ]);

      const leadItems = (leadsRes.ok ? leadsRes.leads || [] : []).map(l => ({
        id: `lead-${l.id}`,
        _type: 'lead',
        _leadId: l.id,
        company_name: l.company_name,
        contact_name: l.contact_name,
        contact_phone: l.contact_mobile,
        lifecycle_status: 'lead',
        lifecycle_label: '开发中',
        target_market: l.target_market,
        logistics_type: l.logistics_type,
        owner: l.owner || '未分配',
        created_at: l.created_at,
        latest_follow: l.latest_follow,
      }));

      const custItems = (custRes.ok ? custRes.customers || [] : []).map(c => ({
        id: `cust-${c.id}`,
        _type: 'customer',
        _custId: c.id,
        company_name: c.company_name,
        contact_name: c.contact_name,
        contact_phone: c.phone,
        lifecycle_status: c.lifecycle_status,
        lifecycle_label: c.lifecycle_label || c.lifecycle_status,
        customer_level: c.customer_level,
        avg_monthly_revenue: c.avg_monthly_revenue,
        avg_monthly_volume: c.avg_monthly_volume,
        volume_mom: c.volume_mom,
        order_frequency_tag: c.order_frequency_tag,
        owner: c.owner || '',
        created_at: c.created_at,
        latest_follow: c.latest_follow,
      }));

      const all = [...leadItems, ...custItems];

      if (selectedStages.length === 0) {
        setItems(all);
      } else {
        const allowed = new Set(selectedStages.flatMap(k => {
          const opt = STAGE_OPTIONS.find(o => o.key === k);
          return opt ? opt.statuses : [];
        }));
        setItems(all.filter(item => allowed.has(item.lifecycle_status)));
      }
    } catch {}
  }, [keyword, selectedStages]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const onRefresh = async () => { setRefreshing(true); await fetchAll(); setRefreshing(false); };

  const toggleStage = (key) => {
    setSelectedStages(prev =>
      prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]
    );
  };

  const clearFilter = () => { setSelectedStages([]); setFilterExpanded(false); };

  const FOLLOW_TYPE_ICONS = {
    call: '📞', meeting: '🤝', email: '📧', visit: '🏢',
    follow: '📝',
  };

  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return '';
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMin = Math.floor((now - then) / 60000);
    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin}分钟前`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}小时前`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 30) return `${diffDay}天前`;
    const diffMonth = Math.floor(diffDay / 30);
    return `${diffMonth}个月前`;
  };

  const getMomColor = (mom) => {
    if (mom == null) return '#94a3b8';
    if (mom > 5) return '#16a34a';
    if (mom < -20) return '#dc2626';
    if (mom < 0) return '#f59e0b';
    return '#94a3b8';
  };

  const openFollow = (item) => {
    setFollowTarget(item);
    setFollowType('call');
    setFollowContent('');
    setFollowVisible(true);
  };

  const handleFollow = async () => {
    if (!followContent.trim()) { Alert.alert('提示', '请输入跟进内容'); return; }
    setSaving(true);
    try {
      if (followTarget._type === 'lead') {
        const res = await client.post(`/api/leads/${followTarget._leadId}/follow-up`, {
          status: followType === 'call' ? '初步沟通' : followType === 'visit' ? '意向强烈' : '初步沟通',
          content: followContent,
          created_by: '张晓明',
        });
        if (res.ok) Alert.alert('成功', res.msg);
      } else {
        const res = await client.post(
          `/api/customer/${followTarget._custId}/add-activity?activity_type=${followType}&content=${encodeURIComponent(followContent)}&created_by=张晓明`
        );
        if (res.ok) Alert.alert('成功', res.msg);
      }
      setFollowVisible(false);
      setFollowContent('');
    } catch (e) { Alert.alert('错误', e.message); }
    setSaving(false);
  };

  const handleStageChange = async (stageKey) => {
    if (!stageTarget) return;
    setStageSaving(true);
    try {
      if (stageTarget._type === 'lead') {
        const status = STAGE_TO_LEAD_STATUS[stageKey];
        const res = await client.put(`/api/leads/${stageTarget._leadId}/stage?stage=${status}`);
        if (res.ok) Alert.alert('成功', res.msg);
      } else {
        const status = STAGE_TO_CUST_STATUS[stageKey];
        const res = await client.put(`/api/customer/${stageTarget._custId}/stage?stage=${status}`);
        if (res.ok) Alert.alert('成功', res.msg);
      }
      setStageVisible(false);
      setStageTarget(null);
      fetchAll();
    } catch (e) { Alert.alert('错误', e.message); }
    setStageSaving(false);
  };

  const getStageKey = (item) => {
    return Object.keys(STAGE_TO_LEAD_STATUS).find(k =>
      STAGE_OPTIONS.find(o => o.key === k)?.statuses.includes(item.lifecycle_status)
    ) || 'developing';
  };

  const renderItem = ({ item }) => {
    const isLead = item._type === 'lead';
    const stageColor = STAGE_COLORS[Object.keys(STAGE_COLORS).find(k =>
      STAGE_OPTIONS.find(o => o.key === k)?.statuses.includes(item.lifecycle_status)
    )] || '#94a3b8';

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => isLead
          ? navigation.navigate('LeadDetail', { leadId: item._leadId })
          : navigation.navigate('CustomerDetail', { customerId: item._custId })
        }
      >
        <View style={styles.cardTop}>
          <Text style={styles.company}>{item.company_name}</Text>
          <View style={styles.topRight}>
            <TouchableOpacity
              style={[styles.stageBadge, { backgroundColor: stageColor }]}
              onPress={(e) => { e.stopPropagation && e.stopPropagation(); setStageTarget(item); setStageVisible(true); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.stageBadgeText}>{item.lifecycle_label}</Text>
              <Ionicons name="caret-down" size={10} color="#fff" style={{ marginLeft: 3 }} />
            </TouchableOpacity>
          </View>
        </View>

        {isLead ? (
          <View style={styles.cardBody}>
            <Text style={styles.info}>{item.contact_name || '未知'} · {item.contact_phone}</Text>
            <View style={styles.tags}>
              {item.target_market ? <StatusBadge label={item.target_market} color="purple" /> : null}
              {item.logistics_type ? <View style={{ width: 6 }} /> : null}
              {item.logistics_type ? <StatusBadge label={item.logistics_type} color="orange" /> : null}
            </View>
          </View>
        ) : (
          <>
            <View style={styles.cardMid}>
              {item.customer_level ? <StatusBadge label={item.customer_level} color={item.customer_level === 'A' ? 'green' : item.customer_level === 'B' ? 'blue' : item.customer_level === 'C' ? 'yellow' : 'red'} /> : null}
              {item.order_frequency_tag && item.order_frequency_tag !== 'Inactive' ? (
                <StatusBadge label={item.order_frequency_tag} color="purple" />
              ) : null}
            </View>
            <View style={styles.metrics}>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>月均营收</Text>
                <Text style={styles.metricVal}>{(item.avg_monthly_revenue / 10000).toFixed(1)}万</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>月均货量</Text>
                <Text style={styles.metricVal}>{item.avg_monthly_volume?.toFixed(1) || 0}方</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>MoM</Text>
                <Text style={[styles.metricVal, { color: getMomColor(item.volume_mom) }]}>
                  {item.volume_mom > 0 ? '+' : ''}{item.volume_mom?.toFixed(1) || 0}%
                </Text>
              </View>
            </View>
          </>
        )}

        {item.latest_follow && (
          <View style={styles.latestFollow}>
            <Text style={styles.latestFollowIcon}>
              {FOLLOW_TYPE_ICONS[item.latest_follow.type] || '📝'}
            </Text>
            <Text style={styles.latestFollowText} numberOfLines={1}>
              {item.latest_follow.content}
            </Text>
            <Text style={styles.latestFollowTime}>
              {formatRelativeTime(item.latest_follow.created_at)}
            </Text>
          </View>
        )}

        <View style={styles.cardFoot}>
          <Text style={styles.contact}>
            {item.contact_name || ''}{item.contact_phone ? ` · ${item.contact_phone}` : ''}
          </Text>
          <View style={styles.cardFootRight}>
            <Text style={styles.owner}>{item.owner}</Text>
            <TouchableOpacity
              style={styles.quickFollowBtn}
              onPress={(e) => { e.stopPropagation && e.stopPropagation(); openFollow(item); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="add-circle-outline" size={20} color="#2563eb" />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>线索与客户</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('CreateLead')}>
          <Ionicons name="add-circle" size={40} color="#2563eb" />
        </TouchableOpacity>
      </View>

      {/* Stage filter */}
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[styles.filterChip, selectedStages.length === 0 && !filterExpanded && styles.filterChipActive]}
          onPress={() => { if (selectedStages.length > 0) { clearFilter(); } else { setFilterExpanded(!filterExpanded); } }}
        >
          <Text style={[styles.filterChipText, selectedStages.length === 0 && !filterExpanded && styles.filterChipTextActive]}>全部</Text>
          <Ionicons name={filterExpanded ? 'chevron-up' : 'chevron-down'} size={12} color={selectedStages.length === 0 && !filterExpanded ? '#fff' : '#94a3b8'} />
        </TouchableOpacity>
        {selectedStages.length > 0 && (
          <TouchableOpacity style={styles.filterClearBtn} onPress={clearFilter}>
            <Ionicons name="close-circle" size={16} color="#94a3b8" />
            <Text style={styles.filterClearText}>清除 ({selectedStages.length})</Text>
          </TouchableOpacity>
        )}
      </View>
      {filterExpanded && (
        <View style={styles.filterDropdown}>
          {STAGE_OPTIONS.map(opt => {
            const checked = selectedStages.includes(opt.key);
            return (
              <TouchableOpacity key={opt.key} style={[styles.checkChip, checked && styles.checkChipActive]} onPress={() => toggleStage(opt.key)}>
                <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={14} color={checked ? '#2563eb' : '#94a3b8'} />
                <Text style={[styles.checkChipText, checked && styles.checkChipTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color="#94a3b8" />
        <TextInput style={styles.searchInput} placeholder="搜索公司名称..." value={keyword} onChangeText={setKeyword} onSubmitEditing={fetchAll} />
        {keyword ? <TouchableOpacity onPress={() => setKeyword('')}><Ionicons name="close-circle" size={18} color="#94a3b8" /></TouchableOpacity> : null}
      </View>

      <FlatList
        data={items}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<EmptyState icon="📋" title="暂无数据" desc="点击右上角 + 创建新线索" />}
        contentContainerStyle={items.length === 0 ? { flex: 1 } : { paddingBottom: 20 }}
      />

      {/* Quick Follow-up Modal */}
      <Modal visible={followVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setFollowVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
              <Text style={styles.modalTitle} numberOfLines={1}>
                添加跟进 - {followTarget?.company_name}
              </Text>
              <View style={{ width: 24 }} />
            </View>

            <Text style={styles.label}>跟进方式</Text>
            <View style={styles.typeRow}>
              {FOLLOW_TYPES.map(t => (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.typeChip, followType === t.key && styles.typeChipActive]}
                  onPress={() => setFollowType(t.key)}
                >
                  <Text style={[styles.typeText, followType === t.key && styles.typeTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>跟进内容</Text>
            <TextInput
              style={styles.textArea}
              placeholder="请输入跟进内容..."
              value={followContent}
              onChangeText={setFollowContent}
              multiline
              autoFocus
            />

            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.5 }]} onPress={handleFollow} disabled={saving}>
              <Text style={styles.saveBtnText}>{saving ? '保存中...' : '保存跟进记录'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Stage Edit Modal */}
      <Modal visible={stageVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => { setStageVisible(false); setStageTarget(null); }}>
          <View style={styles.stageModalContent}>
            <Text style={styles.stageModalTitle}>
              编辑阶段 - {stageTarget?.company_name}
            </Text>
            <Text style={styles.stageModalSub}>
              当前: {stageTarget?.lifecycle_label || '开发中'}
            </Text>
            <View style={styles.stageOptionList}>
              {STAGE_OPTIONS.map(opt => {
                const currentKey = stageTarget ? getStageKey(stageTarget) : null;
                const isActive = currentKey === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.stageOption, isActive && { borderColor: STAGE_COLORS[opt.key], borderWidth: 2 }]}
                    onPress={() => handleStageChange(opt.key)}
                    disabled={stageSaving}
                  >
                    <View style={[styles.stageDot, { backgroundColor: STAGE_COLORS[opt.key] }]} />
                    <Text style={[styles.stageOptionLabel, isActive && { fontWeight: '700' }]}>
                      {opt.label}
                    </Text>
                    {isActive && <Ionicons name="checkmark" size={18} color={STAGE_COLORS[opt.key]} style={{ marginLeft: 'auto' }} />}
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={styles.stageCancelBtn}
              onPress={() => { setStageVisible(false); setStageTarget(null); }}
            >
              <Text style={styles.stageCancelText}>取消</Text>
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
  addBtn: {},

  // Stage filter
  filterBar: { flexDirection: 'row', backgroundColor: '#fff', paddingBottom: 6, paddingHorizontal: 16, gap: 8, paddingTop: 4 },
  filterChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f1f5f9', gap: 4 },
  filterChipActive: { backgroundColor: '#2563eb' },
  filterChipText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  filterChipTextActive: { color: '#fff' },
  filterClearBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 3 },
  filterClearText: { fontSize: 12, color: '#94a3b8' },
  filterDropdown: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  checkChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', gap: 4 },
  checkChipActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  checkChipText: { fontSize: 12, color: '#64748b' },
  checkChipTextActive: { color: '#2563eb', fontWeight: '600' },

  // Search
  searchBox: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginVertical: 10, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  searchInput: { flex: 1, fontSize: 14, marginLeft: 8, color: '#334155' },

  // Cards
  card: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 8, borderRadius: 12, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  company: { fontSize: 16, fontWeight: '600', color: '#0f172a', flex: 1 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  quickFollowBtn: { padding: 4 },
  cardFootRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stageBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  stageBadgeText: { fontSize: 11, color: '#fff', fontWeight: '600' },
  cardBody: { marginBottom: 8 },
  info: { fontSize: 13, color: '#64748b', marginBottom: 6 },
  tags: { flexDirection: 'row', flexWrap: 'wrap' },
  cardMid: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  metrics: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#f8fafc', borderRadius: 8, padding: 10, marginBottom: 8 },
  metric: { alignItems: 'center' },
  metricLabel: { fontSize: 11, color: '#94a3b8', marginBottom: 2 },
  metricVal: { fontSize: 15, fontWeight: '600', color: '#334155' },
  latestFollow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingTop: 8, paddingBottom: 2 },
  latestFollowIcon: { fontSize: 12, marginRight: 4 },
  latestFollowText: { flex: 1, fontSize: 12, color: '#64748b', lineHeight: 17 },
  latestFollowTime: { fontSize: 11, color: '#94a3b8', marginLeft: 8 },
  cardFoot: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10 },
  contact: { fontSize: 12, color: '#94a3b8' },
  owner: { fontSize: 12, color: '#94a3b8' },

  // Follow-up modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a', flex: 1, textAlign: 'center' },
  label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8, marginTop: 8 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  typeChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, backgroundColor: '#f1f5f9' },
  typeChipActive: { backgroundColor: '#2563eb' },
  typeText: { fontSize: 13, color: '#64748b' },
  typeTextActive: { color: '#fff', fontWeight: '500' },
  textArea: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 12, fontSize: 14, minHeight: 80, borderWidth: 1, borderColor: '#e2e8f0', textAlignVertical: 'top' },
  saveBtn: { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },

  // Stage edit modal
  stageModalContent: { backgroundColor: '#fff', marginHorizontal: 32, borderRadius: 16, padding: 20 },
  stageModalTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', textAlign: 'center', marginBottom: 4 },
  stageModalSub: { fontSize: 13, color: '#94a3b8', textAlign: 'center', marginBottom: 16 },
  stageOptionList: { gap: 8, marginBottom: 16 },
  stageOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  stageDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  stageOptionLabel: { fontSize: 15, color: '#334155', fontWeight: '500' },
  stageCancelBtn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#f1f5f9' },
  stageCancelText: { color: '#64748b', fontWeight: '600', fontSize: 15 },
});
