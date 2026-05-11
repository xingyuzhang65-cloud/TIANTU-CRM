import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet,
  RefreshControl, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';

const TABS = [
  { key: 'all', label: '全部' },
  { key: 'private', label: '私海' },
  { key: 'public', label: '公海' },
  { key: 'converted', label: '已转化' },
];

const POOL_COLORS = { 0: 'blue', 1: 'yellow', 2: 'green' };
const POOL_LABELS = { 0: '公海', 1: '私海', 2: '已转化' };

export default function LeadListScreen({ navigation }) {
  const [leads, setLeads] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({});

  const fetchLeads = useCallback(async () => {
    try {
      const params = {};
      if (activeTab === 'public') params.pool = 'public';
      else if (activeTab === 'private') params.pool = 'private';
      if (keyword.trim()) params.keyword = keyword.trim();
      const res = await client.get('/api/leads/list', { params });
      if (res.ok) {
        setLeads(res.leads || []);
        setStats({ total: res.total, public: res.leads.filter(l => l.lead_status === 0).length, private: res.leads.filter(l => l.lead_status === 1).length, converted: res.leads.filter(l => l.lead_status === 2).length });
      }
    } catch {}
  }, [activeTab, keyword]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const onRefresh = async () => { setRefreshing(true); await fetchLeads(); setRefreshing(false); };

  const handleClaim = async (id) => {
    try {
      const res = await client.post(`/api/leads/${id}/claim`, { user_id: 1, user_name: '张晓明' });
      if (res.ok) { Alert.alert('成功', res.msg); fetchLeads(); }
      else Alert.alert('提示', res.msg);
    } catch (e) { Alert.alert('错误', e.message); }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('LeadDetail', { leadId: item.id })}>
      <View style={styles.cardHeader}>
        <Text style={styles.company}>{item.company_name}</Text>
        <StatusBadge label={POOL_LABELS[item.lead_status] || '未知'} color={POOL_COLORS[item.lead_status] || 'gray'} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.info}>{item.contact_name || '未知'} · {item.contact_mobile}</Text>
        <View style={styles.tags}>
          {item.target_market ? <StatusBadge label={item.target_market} color="purple" /> : null}
          {item.logistics_type ? <View style={{ width: 6 }} /> : null}
          {item.logistics_type ? <StatusBadge label={item.logistics_type} color="orange" /> : null}
        </View>
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.owner}>{item.owner || '未分配'}</Text>
        <View style={styles.actions}>
          {item.reclaim_countdown_hours !== null && item.reclaim_countdown_hours !== undefined && (
            <Text style={[styles.countdown, item.reclaim_countdown_hours < 24 && styles.urgent]}>
              剩{item.reclaim_countdown_hours}h
            </Text>
          )}
          {item.lead_status === 0 ? (
            <TouchableOpacity style={styles.claimBtn} onPress={() => handleClaim(item.id)}>
              <Text style={styles.claimText}>认领</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>线索管理</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('CreateLead')}>
          <Ionicons name="add-circle" size={40} color="#2563eb" />
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}><Text style={styles.statVal}>{stats.total || 0}</Text><Text style={styles.statLbl}>全部</Text></View>
        <View style={styles.statItem}><Text style={styles.statVal}>{stats.public || 0}</Text><Text style={styles.statLbl}>公海</Text></View>
        <View style={styles.statItem}><Text style={styles.statVal}>{stats.private || 0}</Text><Text style={styles.statLbl}>私海</Text></View>
        <View style={styles.statItem}><Text style={styles.statVal}>{stats.converted || 0}</Text><Text style={styles.statLbl}>已转化</Text></View>
      </View>

      <View style={styles.tabRow}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key} style={[styles.tab, activeTab === t.key && styles.tabActive]} onPress={() => setActiveTab(t.key)}>
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color="#94a3b8" />
        <TextInput style={styles.searchInput} placeholder="搜索公司名称/手机号..." value={keyword} onChangeText={setKeyword} onSubmitEditing={fetchLeads} />
        {keyword ? <TouchableOpacity onPress={() => { setKeyword(''); }}><Ionicons name="close-circle" size={18} color="#94a3b8" /></TouchableOpacity> : null}
      </View>

      <FlatList
        data={leads}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<EmptyState icon="📋" title="暂无线索" desc="点击右下角 + 创建新线索" />}
        contentContainerStyle={leads.length === 0 ? { flex: 1 } : { paddingBottom: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  addBtn: {},
  statsRow: { flexDirection: 'row', backgroundColor: '#fff', paddingBottom: 12, paddingHorizontal: 16 },
  statItem: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 20, fontWeight: '700', color: '#1e3a5f' },
  statLbl: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, backgroundColor: '#fff', paddingBottom: 10, gap: 6 },
  tab: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f1f5f9' },
  tabActive: { backgroundColor: '#2563eb' },
  tabText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  tabTextActive: { color: '#fff' },
  searchBox: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginVertical: 10, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  searchInput: { flex: 1, fontSize: 14, marginLeft: 8, color: '#334155' },
  card: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 8, borderRadius: 12, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  company: { fontSize: 16, fontWeight: '600', color: '#0f172a', flex: 1 },
  cardBody: { marginBottom: 8 },
  info: { fontSize: 13, color: '#64748b', marginBottom: 6 },
  tags: { flexDirection: 'row', flexWrap: 'wrap' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10 },
  owner: { fontSize: 12, color: '#94a3b8' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  countdown: { fontSize: 12, color: '#f59e0b', fontWeight: '600' },
  urgent: { color: '#dc2626' },
  claimBtn: { backgroundColor: '#2563eb', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 6 },
  claimText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
