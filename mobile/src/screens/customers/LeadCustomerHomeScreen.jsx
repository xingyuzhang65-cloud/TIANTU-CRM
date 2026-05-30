import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';

const STAGE_OPTIONS = [
  { key: 'developing', label: '开发中' },
  { key: 'negotiating', label: '报价谈判' },
  { key: 'cooperating', label: '合作中' },
  { key: 'archived', label: '已归档' },
];

const STAGE_BRIGHT_COLORS = {
  developing: '#2563eb',
  negotiating: '#ea580c',
  cooperating: '#16a34a',
  archived: '#94a3b8',
};

const STAGE_MAP = {
  developing: 'new,contacted',
  negotiating: 'nurturing,quoted,negotiating',
  cooperating: 'trial,active,receding',
  archived: 'disqualified,churned',
};

export default function LeadCustomerHomeScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('leads');

  // Leads state
  const [leads, setLeads] = useState([]);
  const [leadKeyword, setLeadKeyword] = useState('');
  const [leadRefreshing, setLeadRefreshing] = useState(false);

  // Customers state
  const [customers, setCustomers] = useState([]);
  const [customerKeyword, setCustomerKeyword] = useState('');
  const [customerRefreshing, setCustomerRefreshing] = useState(false);
  const [filterExpanded, setFilterExpanded] = useState(false);
  const [selectedStages, setSelectedStages] = useState([]);

  // Fetch leads
  const fetchLeads = useCallback(async () => {
    try {
      const params = {};
      if (leadKeyword.trim()) params.keyword = leadKeyword.trim();
      const res = await client.get('/api/leads/list', { params });
      if (res.ok) setLeads(res.leads || []);
    } catch {}
  }, [leadKeyword]);

  useEffect(() => { if (activeTab === 'leads') fetchLeads(); }, [fetchLeads, activeTab]);

  // Fetch customers
  const fetchCustomers = useCallback(async () => {
    try {
      const res = await client.get('/api/customers/list', { params: { keyword: customerKeyword.trim() || undefined } });
      if (res.ok) {
        const all = res.customers || [];
        if (selectedStages.length === 0) {
          setCustomers(all);
        } else {
          const statusSets = selectedStages.map(s => (STAGE_MAP[s] || '').split(',')).flat();
          setCustomers(all.filter(c => statusSets.includes(c.lifecycle_status)));
        }
      }
    } catch {}
  }, [customerKeyword, selectedStages]);

  useEffect(() => { if (activeTab === 'customers') fetchCustomers(); }, [fetchCustomers, activeTab]);

  const toggleStage = (key) => {
    setSelectedStages(prev =>
      prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]
    );
  };

  const clearFilter = () => { setSelectedStages([]); setFilterExpanded(false); };

  const getMomColor = (mom) => {
    if (mom > 5) return '#16a34a';
    if (mom < -20) return '#dc2626';
    if (mom < 0) return '#f59e0b';
    return '#94a3b8';
  };

  const renderLeadItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('LeadDetail', { leadId: item.id })}>
      <View style={styles.cardHeader}>
        <Text style={styles.company}>{item.company_name}</Text>
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
      </View>
    </TouchableOpacity>
  );

  const renderCustomerItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('CustomerDetail', { customerId: item.id })}>
      <View style={styles.cardTop}>
        <Text style={styles.company}>{item.company_name}</Text>
        <Text style={[styles.stageLabel, { color: STAGE_BRIGHT_COLORS[item.lifecycle_status] || '#94a3b8' }]}>
          {item.lifecycle_label || item.lifecycle_status}
        </Text>
      </View>
      <View style={styles.cardMid}>
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
        <Text style={styles.title}>线索与客户</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('CreateLead')}>
          <Ionicons name="add-circle" size={40} color="#2563eb" />
        </TouchableOpacity>
      </View>

      {/* Internal tabs: 线索 | 客户 */}
      <View style={styles.segmentedBar}>
        <TouchableOpacity
          style={[styles.segment, activeTab === 'leads' && styles.segmentActive]}
          onPress={() => setActiveTab('leads')}
        >
          <Text style={[styles.segmentText, activeTab === 'leads' && styles.segmentTextActive]}>线索</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, activeTab === 'customers' && styles.segmentActive]}
          onPress={() => setActiveTab('customers')}
        >
          <Text style={[styles.segmentText, activeTab === 'customers' && styles.segmentTextActive]}>客户</Text>
        </TouchableOpacity>
      </View>

      {/* Leads view */}
      {activeTab === 'leads' && (
        <>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color="#94a3b8" />
            <TextInput style={styles.searchInput} placeholder="搜索公司名称/手机号..." value={leadKeyword} onChangeText={setLeadKeyword} onSubmitEditing={fetchLeads} />
            {leadKeyword ? <TouchableOpacity onPress={() => setLeadKeyword('')}><Ionicons name="close-circle" size={18} color="#94a3b8" /></TouchableOpacity> : null}
          </View>
          <FlatList
            data={leads}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderLeadItem}
            refreshControl={<RefreshControl refreshing={leadRefreshing} onRefresh={async () => { setLeadRefreshing(true); await fetchLeads(); setLeadRefreshing(false); }} />}
            ListEmptyComponent={<EmptyState icon="📋" title="暂无线索" desc="点击右下角 + 创建新线索" />}
            contentContainerStyle={leads.length === 0 ? { flex: 1 } : { paddingBottom: 20 }}
          />
        </>
      )}

      {/* Customers view */}
      {activeTab === 'customers' && (
        <>
          <View style={styles.filterBar}>
            <TouchableOpacity
              style={[styles.filterChip, styles.filterAllChip, (selectedStages.length === 0 && !filterExpanded) && styles.filterChipActive]}
              onPress={() => { if (selectedStages.length > 0) { clearFilter(); } else { setFilterExpanded(!filterExpanded); } }}
            >
              <Text style={[styles.filterChipText, (selectedStages.length === 0 && !filterExpanded) && styles.filterChipTextActive]}>全部</Text>
              <Ionicons name={filterExpanded ? 'chevron-up' : 'chevron-down'} size={12} color={(selectedStages.length === 0 && !filterExpanded) ? '#fff' : '#94a3b8'} />
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
            <TextInput style={styles.searchInput} placeholder="搜索客户名称..." value={customerKeyword} onChangeText={setCustomerKeyword} onSubmitEditing={fetchCustomers} />
            {customerKeyword ? <TouchableOpacity onPress={() => setCustomerKeyword('')}><Ionicons name="close-circle" size={18} color="#94a3b8" /></TouchableOpacity> : null}
          </View>
          <FlatList
            data={customers}
            keyExtractor={item => String(item.id)}
            renderItem={renderCustomerItem}
            refreshControl={<RefreshControl refreshing={customerRefreshing} onRefresh={async () => { setCustomerRefreshing(true); await fetchCustomers(); setCustomerRefreshing(false); }} />}
            ListEmptyComponent={<EmptyState icon="👥" title="暂无客户数据" />}
            contentContainerStyle={customers.length === 0 ? { flex: 1 } : { paddingBottom: 20 }}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  addBtn: {},

  // Segmented control
  segmentedBar: { flexDirection: 'row', marginHorizontal: 16, marginTop: 10, backgroundColor: '#f1f5f9', borderRadius: 10, padding: 3 },
  segment: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  segmentActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
  segmentText: { fontSize: 14, fontWeight: '500', color: '#64748b' },
  segmentTextActive: { color: '#2563eb', fontWeight: '600' },

  // Search
  searchBox: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginVertical: 10, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  searchInput: { flex: 1, fontSize: 14, marginLeft: 8, color: '#334155' },

  // Customer filter
  filterBar: { flexDirection: 'row', backgroundColor: '#fff', paddingBottom: 6, paddingHorizontal: 16, gap: 8, paddingTop: 4 },
  filterChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f1f5f9', gap: 4 },
  filterChipActive: { backgroundColor: '#2563eb' },
  filterChipText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  filterChipTextActive: { color: '#fff' },
  filterAllChip: { gap: 4 },
  filterClearBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 3 },
  filterClearText: { fontSize: 12, color: '#94a3b8' },
  filterDropdown: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  checkChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', gap: 4 },
  checkChipActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  checkChipText: { fontSize: 12, color: '#64748b' },
  checkChipTextActive: { color: '#2563eb', fontWeight: '600' },

  // Cards (shared)
  card: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 8, borderRadius: 12, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  company: { fontSize: 16, fontWeight: '600', color: '#0f172a', flex: 1 },
  cardBody: { marginBottom: 8 },
  info: { fontSize: 13, color: '#64748b', marginBottom: 6 },
  tags: { flexDirection: 'row', flexWrap: 'wrap' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10 },
  owner: { fontSize: 12, color: '#94a3b8' },

  // Customer-specific
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  stageLabel: { fontSize: 14, fontWeight: '700' },
  cardMid: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  metrics: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#f8fafc', borderRadius: 8, padding: 10, marginBottom: 8 },
  metric: { alignItems: 'center' },
  metricLabel: { fontSize: 11, color: '#94a3b8', marginBottom: 2 },
  metricVal: { fontSize: 15, fontWeight: '600', color: '#334155' },
  cardFoot: { flexDirection: 'row', justifyContent: 'space-between' },
  contact: { fontSize: 12, color: '#94a3b8' },
});
