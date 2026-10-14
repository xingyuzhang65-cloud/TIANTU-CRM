import { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, Pressable, TextInput, FlatList, ScrollView, Modal, RefreshControl, Alert, Image, ActivityIndicator, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import client, { isDemoMode } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { copyText } from '../../components/AppFeedback';
import { colors, ui, ScreenHeader, IconButton, Pill, Tag } from '../../components/AppUI';

const views = [['my', '我的客户'], ['pool', '公司池'], ['expiring', '即将掉保'], ['closed', '成交客户'], ['all', '全部']];
const stages = [['all', '全部阶段'], ['developing', '开发中'], ['quoted', '已报价'], ['cooperating', '合作中'], ['churned', '已流失']];
const types = [['call', '电话'], ['follow', '微信'], ['visit', '拜访'], ['meeting', '会议']];
const stageOf = item => item.lifecycle_status === 'active' || item.follow_status === 'CLOSED' ? 'cooperating' : ['negotiating', 'quoted'].includes(item.lifecycle_status) || item.follow_status === 'QUOTED' ? 'quoted' : ['disqualified', 'churned'].includes(item.lifecycle_status) ? 'churned' : 'developing';
const shortDate = date => date ? String(date).slice(5, 10) : '待完善';

export default function CustomerHub({ navigation, route }) {
  const { user } = useAuth();
  const [mode, setMode] = useState('customers');
  const [view, setView] = useState('my');
  const [keyword, setKeyword] = useState('');
  const [stage, setStage] = useState('all');
  const [risk, setRisk] = useState('all');
  const [records, setRecords] = useState([]);
  const [counts, setCounts] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [follow, setFollow] = useState(null);
  const [followType, setFollowType] = useState('call');
  const [content, setContent] = useState('');
  const [images, setImages] = useState([]);
  const [nextDate, setNextDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [stageTarget, setStageTarget] = useState(null);
  const requestVersion = useRef(0);
  useEffect(() => {
    if (route.params?.stage || route.params?.risk) { setMode('customers'); setView('all'); setStage(route.params.stage || 'all'); setRisk(route.params.risk || 'all'); }
  }, [route.params]);
  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      const response = mode === 'customers'
        ? await client.get('/api/crm/customers', { params: { tab: view, keyword: keyword.trim(), page_size: 100 } })
        : await client.get('/api/leads/list', { params: { keyword: keyword.trim(), pool: view === 'pool' ? 'public' : view === 'my' ? 'private' : 'all' } });
      if (version !== requestVersion.current) return;
      setRecords(mode === 'customers' ? response.records || [] : response.leads || []);
      setCounts(response.tab_counts || {}); setError('');
    } catch (e) { if (version === requestVersion.current) setError(e.message); }
  }, [mode, view, keyword]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  const visible = records.filter(item => {
    if (mode === 'customers' && stage !== 'all' && stageOf(item) !== stage) return false;
    if (risk === 'declining') return Number(item.volume_mom) < 0;
    if (risk === 'credit') return Number(item.credit?.days_aged) > 30;
    if (risk === 'risk') return Number(item.volume_mom) < 0 || Number(item.credit?.days_aged) > 30 || stageOf(item) === 'churned';
    return true;
  }).sort((a, b) => String(b.latest_follow?.created_at || b.last_followup_at || '').localeCompare(String(a.latest_follow?.created_at || a.last_followup_at || '')));
  const openFollow = item => { setFollow(item); setContent(''); setImages([]); setNextDate(''); setFollowType('call'); };
  const openDetail = item => navigation.navigate(mode === 'leads' ? 'LeadDetail' : 'CustomerDetail', mode === 'leads' ? { leadId: item.id } : { customerId: item.id });
  const contact = item => {
    const phone = item.mobile || item.phone || item.contact_mobile;
    Alert.alert(item.contact_name || '客户联系方式', phone || '暂未登记联系方式', phone ? [{ text: '关闭', style: 'cancel' }, { text: '复制号码', onPress: () => copyText(phone) }] : undefined);
  };
  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: .6 });
    if (!result.canceled) setImages(previous => [...previous, ...result.assets].slice(0, 3));
  };
  const imageUrls = async () => {
    const urls = [];
    for (const image of images) {
      if (isDemoMode && Platform.OS === 'web') {
        const blob = await (await fetch(image.uri)).blob();
        if (blob.size > 2000000) throw new Error('请选择 2MB 以内的图片');
        urls.push(await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); }));
      } else {
        const formData = new FormData();
        formData.append('file', { uri: image.uri, name: image.fileName || 'follow.jpg', type: image.mimeType || 'image/jpeg' });
        const response = await fetch(`${client.defaults.baseURL}/api/upload/follow-up-image`, { method: 'POST', body: formData });
        const data = await response.json(); if (data.url) urls.push(data.url);
      }
    }
    return urls;
  };
  const saveFollow = async () => {
    if (!content.trim()) { Alert.alert('请填写跟进内容', '记录客户需求、沟通结果和下一步计划。'); return; }
    if (nextDate && !/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) { Alert.alert('日期格式有误', '请使用 YYYY-MM-DD 格式'); return; }
    setSaving(true);
    try {
      const body = { content: content.trim(), activity_type: followType, status: '初步沟通', created_by: user?.name, image_urls: await imageUrls(), next_follow_date: nextDate };
      const response = await client.post(mode === 'leads' ? `/api/leads/${follow.id}/follow-up` : `/api/customer/${follow.id}/add-activity`, body);
      if (!response.ok) throw new Error(response.msg || '保存失败');
      setFollow(null); await load(); Alert.alert('跟进已保存', '客户最近跟进记录已更新。');
    } catch (e) { Alert.alert('保存失败', e.message); } finally { setSaving(false); }
  };
  const claim = async item => {
    const response = await client.post(mode === 'leads' ? `/api/leads/${item.id}/claim` : '/api/crm/customers/claim', { ids: [item.id], owner: user?.name });
    if (response.ok) { await load(); Alert.alert('认领成功', '可以在“我的客户”或“我的私海”继续跟进。'); }
  };
  const updateStage = async key => {
    const status = { developing: 'new', quoted: 'negotiating', cooperating: 'active', churned: 'disqualified' }[key];
    try {
      const response = await client.put(`/api/customer/${stageTarget.id}/stage?stage=${status}`);
      if (!response.ok) throw new Error(response.msg); setStageTarget(null); await load();
    } catch (e) { Alert.alert('更新失败', e.message); }
  };
  const renderCard = ({ item }) => {
    const lead = mode === 'leads';
    const pool = lead ? item.lead_status === 'public' || item.lead_status === 0 : item.ownership_status === 'COMPANY_POOL';
    const status = lead ? pool ? '待认领' : item.lead_status === 'converted' || Number(item.lead_status) === 2 ? '已转化' : '跟进中' : item.follow_status_label || item.lifecycle_label || '初访';
    const name = item.company_name || item.customer_name;
    const tone = !lead && stageOf(item) === 'cooperating' ? 'success' : !lead && stageOf(item) === 'churned' ? 'muted' : 'primary';
    return <View style={[ui.card, { marginHorizontal: 22, marginBottom: 12, padding: 17 }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`查看${name}`} onPress={() => openDetail(item)} style={[ui.row, { alignItems: 'flex-start', gap: 11 }]}><View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: '#EDF1F7', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#647B98', fontSize: 15, fontWeight: '600' }}>{name?.slice(0, 1)}</Text></View><View style={{ flex: 1 }}><Text numberOfLines={2} style={{ fontSize: 14, color: colors.ink, fontWeight: '700', lineHeight: 21 }}>{name}</Text><View style={[ui.row, { marginTop: 7, gap: 5, flexWrap: 'wrap' }]}>{(item.tags || [item.customer_level, item.customer_type, item.logistics_type].filter(Boolean)).slice(0, 3).map(tag => <Tag key={tag} label={tag} />)}</View></View><Tag label={status} tone={tone} /></Pressable>
      <View style={[ui.row, { marginTop: 16, justifyContent: 'space-between' }]}><Text style={{ color: colors.muted, fontSize: 11 }}>{item.contact_name || '联系人待完善'} · {item.masked_mobile || item.contact_mobile || item.phone || '暂无电话'}</Text><Text style={{ color: colors.muted, fontSize: 11 }}>{item.owner || item.owner_name || '未分配'}</Text></View>
      {!lead && <View style={{ flexDirection: 'row', backgroundColor: '#F8FAFC', borderRadius: 10, padding: 11, marginTop: 12 }}>{[['月均货量', `${item.avg_monthly_volume ?? '—'} CBM`], ['货量环比', item.volume_mom == null ? '—' : `${item.volume_mom > 0 ? '+' : ''}${item.volume_mom}%`], ['应收余额', item.credit?.balance_due ? `¥${(item.credit.balance_due / 10000).toFixed(1)}万` : '—']].map(([label, value], index) => <View key={label} style={{ flex: 1, gap: 5, borderLeftWidth: index ? 1 : 0, borderColor: colors.border, paddingLeft: index ? 12 : 0 }}><Text style={{ color: colors.muted, fontSize: 10 }}>{label}</Text><Text style={{ color: index === 1 && item.volume_mom < 0 ? colors.danger : colors.ink, fontSize: 12, fontWeight: '600' }}>{value}</Text></View>)}</View>}
      <View style={[ui.row, { marginTop: 12, alignItems: 'flex-start', gap: 7 }]}><Ionicons name="chatbubble-ellipses-outline" size={13} color="#98A6B9" /><Text numberOfLines={2} style={{ flex: 1, color: '#758398', fontSize: 11, lineHeight: 17 }}>{item.latest_follow?.content || '还没有跟进记录，记下第一次沟通吧。'}</Text></View>
      {(item.ownership_status === 'EXPIRING_PROTECTION' || Number(item.credit?.days_aged) > 30) && <Text style={{ color: colors.warning, fontSize: 10, marginTop: 8 }}>{item.ownership_status === 'EXPIRING_PROTECTION' ? `保护期至 ${shortDate(item.protect_expire_at)}，请及时跟进` : `账龄 ${item.credit.days_aged} 天，请关注回款`}</Text>}
      <View style={{ flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderColor: colors.border, marginTop: 13, paddingTop: 10, gap: 9 }}><Pressable accessibilityRole="button" accessibilityLabel={`联系${name}`} onPress={() => contact(item)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 7 }}><Ionicons name="call-outline" size={13} color={colors.muted} /><Text style={{ fontSize: 11, color: colors.muted }}>联系</Text></Pressable>{!lead && <Pressable accessibilityRole="button" accessibilityLabel={`更新${name}阶段`} onPress={() => setStageTarget(item)} style={{ padding: 7 }}><Text style={{ color: colors.muted, fontSize: 11 }}>改阶段</Text></Pressable>}<View style={{ flex: 1 }} /><Pressable accessibilityRole="button" accessibilityLabel={`${pool ? '认领' : '写跟进'}${name}`} onPress={() => pool ? claim(item) : openFollow(item)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.light, borderRadius: 8 }}><Ionicons name={pool ? 'add-outline' : 'create-outline'} size={13} color={colors.primary} /><Text style={{ color: colors.primary, fontSize: 11, fontWeight: '600' }}>{pool ? '认领客户' : '写跟进'}</Text></Pressable></View>
    </View>;
  };
  return <View style={ui.screen}>
    <ScreenHeader title="客户管理" subtitle="客户归属清晰，跟进进展可见"><IconButton primary name="add-outline" label="新增线索" onPress={() => navigation.navigate('CreateLead')} /></ScreenHeader>
    <View style={{ flexDirection: 'row', gap: 23, paddingHorizontal: 22, marginBottom: 17 }}>{[['customers', '客户'], ['leads', '线索']].map(([key, label]) => <Pressable key={key} accessibilityRole="button" onPress={() => { setMode(key); setView(key === 'customers' ? 'my' : 'all'); setStage('all'); setRisk('all'); }} style={{ paddingBottom: 9, borderBottomWidth: mode === key ? 2 : 0, borderColor: colors.primary }}><Text style={{ fontSize: 16, color: mode === key ? colors.ink : colors.muted, fontWeight: mode === key ? '700' : '500' }}>{label}</Text></Pressable>)}</View>
    <View style={[ui.row, { paddingHorizontal: 22, marginBottom: 13 }]}><View style={[ui.row, { flex: 1, backgroundColor: '#fff', paddingHorizontal: 12, height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.border }]}><Ionicons name="search-outline" size={17} color="#9AA7B8" /><TextInput accessibilityLabel="搜索客户" value={keyword} onChangeText={setKeyword} placeholder="搜索公司、联系人或手机号" placeholderTextColor="#A0ACBC" style={{ flex: 1, fontSize: 12, color: colors.ink, paddingVertical: 10 }} />{!!keyword && <Pressable accessibilityRole="button" accessibilityLabel="清空搜索" onPress={() => setKeyword('')}><Ionicons name="close-circle" size={16} color={colors.muted} /></Pressable>}</View><IconButton name="options-outline" label="筛选客户" onPress={() => setFilterOpen(true)} /></View>
    <View style={{ marginBottom: 15 }}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingHorizontal: 22 }}>{(mode === 'customers' ? views : [['all', '全部线索'], ['my', '我的私海'], ['pool', '公海待认领']]).map(([key, label]) => <Pill key={key} label={label} count={mode === 'customers' ? counts[key] : undefined} selected={view === key} onPress={() => setView(key)} />)}</ScrollView></View>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 22, marginBottom: 12 }}><Text style={{ fontSize: 11, color: colors.muted }}>共 {visible.length} 位{mode === 'customers' ? '客户' : '潜在客户'}{stage !== 'all' ? ` · ${stages.find(s => s[0] === stage)?.[1]}` : ''}{risk !== 'all' ? ' · 关注风险' : ''}</Text><Text style={{ fontSize: 10, color: '#9AA6B7' }}>最近跟进优先</Text></View>
    {!!error && <Text accessibilityRole="alert" style={{ margin: 22, color: colors.danger }}>{error}</Text>}
    <FlatList data={visible} keyExtractor={item => String(item.id)} renderItem={renderCard} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />} ListEmptyComponent={<View style={{ alignItems: 'center', padding: 50, gap: 14 }}><Ionicons name="search-outline" size={32} color="#BAC5D3" /><Text style={{ color: colors.muted, fontSize: 13 }}>没有符合条件的客户</Text><Pressable onPress={() => { setKeyword(''); setStage('all'); setRisk('all'); }}><Text style={{ color: colors.primary, fontSize: 12 }}>清空筛选条件</Text></Pressable></View>} />
    <Modal visible={filterOpen} transparent animationType="slide" onRequestClose={() => setFilterOpen(false)}><View style={ui.overlay}><View style={ui.sheet}><View style={[ui.row, { justifyContent: 'space-between', marginBottom: 22 }]}><Text style={{ fontSize: 19, fontWeight: '700', color: colors.ink }}>筛选客户</Text><IconButton name="close-outline" label="关闭筛选" onPress={() => setFilterOpen(false)} /></View><Text style={{ fontSize: 13, color: colors.ink, marginBottom: 12 }}>客户生命周期</Text><View style={[ui.row, { flexWrap: 'wrap', marginBottom: 24 }]}>{stages.map(([key, label]) => <Pill key={key} label={label} selected={stage === key} onPress={() => setStage(key)} />)}</View><Text style={{ fontSize: 13, color: colors.ink, marginBottom: 12 }}>风险关注</Text><View style={[ui.row, { flexWrap: 'wrap', marginBottom: 30 }]}>{[['all', '全部'], ['declining', '货量下滑'], ['credit', '账期异常'], ['risk', '全部风险']].map(([key, label]) => <Pill key={key} label={label} selected={risk === key} onPress={() => setRisk(key)} />)}</View><View style={ui.row}><Pressable onPress={() => { setStage('all'); setRisk('all'); }} style={[ui.button, { flex: 1, backgroundColor: '#EFF2F7' }]}><Text style={{ color: colors.muted }}>重置</Text></Pressable><Pressable accessibilityRole="button" onPress={() => setFilterOpen(false)} style={[ui.button, { flex: 2 }]}><Text style={ui.buttonText}>查看筛选结果</Text></Pressable></View></View></View></Modal>
    <Modal visible={!!follow} transparent animationType="slide" onRequestClose={() => !saving && setFollow(null)}><View style={ui.overlay}><View style={ui.sheet}><View style={[ui.row, { justifyContent: 'space-between', marginBottom: 5 }]}><Text style={{ fontSize: 19, color: colors.ink, fontWeight: '700' }}>写跟进</Text><IconButton name="close-outline" label="关闭跟进" onPress={() => !saving && setFollow(null)} /></View><Text style={{ color: colors.muted, fontSize: 12, marginBottom: 22 }}>{follow?.company_name}</Text><ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 440 }}><View style={[ui.row, { marginBottom: 18 }]}>{types.map(([key, label]) => <Pill key={key} label={label} selected={followType === key} onPress={() => setFollowType(key)} />)}</View><TextInput accessibilityLabel="跟进内容" multiline value={content} onChangeText={setContent} placeholder="记录客户需求、沟通结果和下一步计划…" style={[ui.input, { minHeight: 130, textAlignVertical: 'top', lineHeight: 23 }]} /><Pressable accessibilityRole="button" onPress={pickImages} style={[ui.row, { paddingVertical: 16 }]}><Ionicons name="image-outline" size={18} color={colors.muted} /><Text style={{ color: colors.muted, fontSize: 12 }}>添加图片（最多 3 张）</Text></Pressable><View style={ui.row}>{images.map((image, index) => <Pressable key={image.uri} onPress={() => setImages(previous => previous.filter((_, at) => at !== index))}><Image source={{ uri: image.uri }} style={{ width: 54, height: 54, borderRadius: 8 }} /></Pressable>)}</View><Text style={{ color: colors.ink, fontSize: 12, marginTop: 14, marginBottom: 9 }}>下次跟进日期（选填）</Text><TextInput accessibilityLabel="下次跟进日期" value={nextDate} onChangeText={setNextDate} placeholder="YYYY-MM-DD" style={ui.input} /></ScrollView><Pressable accessibilityRole="button" accessibilityLabel="保存跟进" disabled={saving} onPress={saveFollow} style={[ui.button, { marginTop: 22 }]}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={ui.buttonText}>保存跟进</Text>}</Pressable></View></View></Modal>
    <Modal visible={!!stageTarget} transparent animationType="slide" onRequestClose={() => setStageTarget(null)}><View style={ui.overlay}><View style={ui.sheet}><View style={[ui.row, { justifyContent: 'space-between', marginBottom: 14 }]}><Text style={{ fontSize: 19, fontWeight: '700', color: colors.ink }}>更新客户阶段</Text><IconButton name="close-outline" label="关闭阶段设置" onPress={() => setStageTarget(null)} /></View><Text style={{ color: colors.muted, fontSize: 12, marginBottom: 20 }}>{stageTarget?.company_name}</Text>{stages.slice(1).map(([key, label]) => <Pressable key={key} accessibilityRole="button" accessibilityLabel={label} onPress={() => updateStage(key)} style={{ paddingVertical: 17, borderTopWidth: 1, borderColor: colors.border, flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ fontSize: 15, color: colors.ink }}>{label}</Text><Ionicons name="chevron-forward" size={16} color={colors.muted} /></Pressable>)}</View></View></Modal>
  </View>;
}
