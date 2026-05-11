import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';

const STAGE_TABS = [
  { key: 'all', label: '全部' },
  { key: 'developing', label: '开发中' },
  { key: 'negotiating', label: '报价谈判' },
  { key: 'cooperating', label: '合作中' },
  { key: 'archived', label: '已归档' },
];

const LEVEL_COLORS = { A: 'green', B: 'blue', C: 'yellow', D: 'red' };
const STAGE_COLORS = { developing: 'blue', negotiating: 'orange', cooperating: 'green', archived: 'gray' };

export default function CustomerListScreen({ navigation }) {
  const [customers, setCustomers] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchCustomers = useCallback(async () => {
    try {
      const params = {};
      if (activeTab !== 'all') {
        // Map stage to statuses for filtering
        const stageMap = {
          developing: 'new,contacted',
          negotiating: 'nurturing,quoted,negotiating',
          cooperating: 'trial,active,receding',
          archived: 'disqualified,churned',
        };
        // Use keyword search for stage-based filtering since API doesn't have stage param
        const res = await client.get('/api/customers/list', { params: { keyword: keyword.trim() || undefined } });
        if (res.ok) {
          const all = res.customers || [];
          const stageStatuses = (stageMap[activeTab] || '').split(',');
          setCustomers(activeTab === 'all' ? all : all.filter(c => stageStatuses.includes(c.lifecycle_status)));
        }
      } else {
        const res = await client.get('/api/customers/list', { params: { keyword: keyword.trim() || undefined } });
        if (res.ok) setCustomers(res.customers || []);
      }
    } catch {}
  }, [activeTab, keyword]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const onRefresh = async () => { setRefreshing(true); await fetchCustomers(); setRefreshing(false); };

  const getMomColor = (mom) => {
    if (mom > 5) return '#16a34a';
    if (mom < -20) return '#dc2626';
    if (mom < 0) return '#f59e0b';
    return '#94a3b8';
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('CustomerDetail', { customerId: item.id })}>
      <View style={styles.cardTop}>
        <Text style={styles.company}>{item.company_name}</Text>
        <View style={styles.badges}>
          <StatusBadge label={item.customer_level} color={LEVEL_COLORS[item.customer_level] || 'gray'} />
        </View>
      </View>
      <View style={styles.cardMid}>
        <StatusBadge label={item.lifecycle_label || item.lifecycle_status} color={STAGE_COLORS[item.lifecycle_status] || 'gray'} />
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
      <View style={styles.cardFoot}>
        <Text style={styles.contact}>{item.contact_name || ''} · {item.phone || ''}</Text>
        <Text style={styles.owner}>{item.owner || ''}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>客户与商机</Text>
      </View>

      <View style={styles.tabRow}>
        <FlatList
          horizontal
          data={STAGE_TABS}
          keyExtractor={t => t.key}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item: t }) => (
            <TouchableOpacity style={[styles.tab, activeTab === t.key && styles.tabActive]} onPress={() => setActiveTab(t.key)}>
              <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color="#94a3b8" />
        <TextInput style={styles.searchInput} placeholder="搜索客户名称..." value={keyword} onChangeText={setKeyword} onSubmitEditing={fetchCustomers} />
        {keyword ? <TouchableOpacity onPress={() => setKeyword('')}><Ionicons name="close-circle" size={18} color="#94a3b8" /></TouchableOpacity> : null}
      </View>

      <FlatList
        data={customers}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<EmptyState icon="👥" title="暂无客户数据" />}
        contentContainerStyle={customers.length === 0 ? { flex: 1 } : { paddingBottom: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  tabRow: { backgroundColor: '#fff', paddingBottom: 10, paddingLeft: 16 },
  tab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f1f5f9', marginRight: 8 },
  tabActive: { backgroundColor: '#2563eb' },
  tabText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  tabTextActive: { color: '#fff' },
  searchBox: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginVertical: 10, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  searchInput: { flex: 1, fontSize: 14, marginLeft: 8, color: '#334155' },
  card: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 8, borderRadius: 12, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  company: { fontSize: 16, fontWeight: '600', color: '#0f172a', flex: 1 },
  badges: { flexDirection: 'row', gap: 6 },
  cardMid: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  metrics: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#f8fafc', borderRadius: 8, padding: 10, marginBottom: 8 },
  metric: { alignItems: 'center' },
  metricLabel: { fontSize: 11, color: '#94a3b8', marginBottom: 2 },
  metricVal: { fontSize: 15, fontWeight: '600', color: '#334155' },
  cardFoot: { flexDirection: 'row', justifyContent: 'space-between' },
  contact: { fontSize: 12, color: '#94a3b8' },
  owner: { fontSize: 12, color: '#94a3b8' },
});
