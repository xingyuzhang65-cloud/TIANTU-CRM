import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, RefreshControl,
  Modal, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';

const STATUS_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'sea', label: '海运在途' },
  { key: 'air', label: '空运在途' },
  { key: 'lastmile', label: '尾程派送中' },
];

const STATUS_COLORS = {
  received: 'blue', warehouse: 'blue', departed: 'orange',
  customs: 'red', transit: 'yellow', arrived: 'green', delivered: 'green',
};

const STATUS_PROGRESS = {
  received: 0.05, warehouse: 0.15, departed: 0.3,
  customs: 0.5, transit: 0.65, arrived: 0.85, delivered: 1,
};

function formatTime(t) {
  if (!t) return '';
  const d = new Date(t);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  if (diff < 2592000000) return Math.floor(diff / 86400000) + '天前';
  return d.toLocaleDateString('zh-CN');
}

export default function TrackingHomeScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('tracking');

  // Tracking state
  const [orders, setOrders] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailOrder, setDetailOrder] = useState(null);
  const [detailEvents, setDetailEvents] = useState([]);

  // Exception state
  const [exceptions, setExceptions] = useState([]);
  const [exceptionStats, setExceptionStats] = useState({ severe: 0, warning: 0 });
  const [excRefreshing, setExcRefreshing] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const params = { filter: statusFilter };
      if (keyword.trim()) params.keyword = keyword.trim();
      const res = await client.get('/api/orders/list', { params });
      if (res.ok) setOrders(res.orders || []);
    } catch {}
  }, [keyword, statusFilter]);

  const fetchExceptions = useCallback(async () => {
    try {
      const res = await client.get('/api/orders/exceptions');
      if (res.ok) {
        setExceptions(res.exceptions || []);
        setExceptionStats(res.stats || { severe: 0, warning: 0 });
      }
    } catch {}
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => { if (activeTab === 'exception') fetchExceptions(); }, [fetchExceptions, activeTab]);

  const fetchDetail = async (orderId) => {
    try {
      const res = await client.get(`/api/tracking/${orderId}`);
      if (res.ok) {
        setDetailOrder(res.order);
        setDetailEvents(res.events || []);
        setDetailVisible(true);
      }
    } catch {}
  };

  const handleSubscribe = async (orderId) => {
    try {
      const res = await client.post(`/api/orders/${orderId}/subscribe`);
      if (res.ok) Alert.alert('已订阅', '关键节点将推送通知');
    } catch {}
  };

  const copyTracking = (order) => {
    const text = `📦 运单号: ${order.tracking_number}\n路线: ${order.route_detail}\n货物: ${order.cargo_desc}\n状态: ${order.status_label}\n起运: ${order.origin} → 目的: ${order.destination}\nETA: ${order.eta || '待定'}\n最新动态: ${order.latest_event || '暂无'}`;
    Alert.alert('已复制', text);
  };

  const eventTypeLabel = (t) => {
    const map = { warehouse: '入仓', departure: '起运', arrival: '到港', customs: '报关', transit: '运输中', delivery: '派送', exception: '异常' };
    return map[t] || t;
  };

  const eventTypeIcon = (t) => {
    switch (t) {
      case 'warehouse': return 'cube-outline';
      case 'departure': return 'airplane-outline';
      case 'arrival': return 'flag-outline';
      case 'customs': return 'document-text-outline';
      case 'delivery': return 'checkmark-circle-outline';
      case 'exception': return 'warning-outline';
      default: return 'ellipse-outline';
    }
  };

  const exceptionLevel = (type) => {
    if (!type) return 'warning';
    if (type.includes('查验') || type.includes('扣关') || type.includes('破损') || type.includes('退运')) return 'severe';
    return 'warning';
  };

  // ==== RENDER: Tracking Order Card ====
  const renderOrderItem = ({ item }) => {
    const prog = STATUS_PROGRESS[item.status] || 0.1;
    return (
      <TouchableOpacity style={styles.card} onPress={() => fetchDetail(item.id)}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.trackingNo}>{item.tracking_number}</Text>
            <Text style={styles.channel}>{item.route_detail?.split('-')?.[1] || ''}</Text>
          </View>
          <StatusBadge label={item.status_label} color={STATUS_COLORS[item.status] || 'gray'} />
        </View>

        {/* Progress bar */}
        <View style={styles.progressRow}>
          <Text style={styles.progressLoc}>{item.origin?.split('港')[0]?.split('机场')[0] || item.origin}</Text>
          <View style={styles.progressBarWrap}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${prog * 100}%` }]} />
            </View>
            <View style={[styles.progressDot, { left: `${prog * 100}%` }]}>
              <Ionicons name="boat" size={14} color="#2563eb" />
            </View>
          </View>
          <Text style={styles.progressLoc}>{item.destination?.split('港')[0]?.split('仓')[0] || item.destination}</Text>
        </View>

        <View style={styles.cardFoot}>
          <Text style={styles.latestEvent} numberOfLines={1}>
            {item.latest_event || '暂无轨迹'}
          </Text>
          <View style={styles.footActions}>
            <TouchableOpacity style={styles.copyBtn} onPress={() => copyTracking(item)}>
              <Ionicons name="copy-outline" size={13} color="#2563eb" />
              <Text style={styles.copyText}>复制</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.subBtn} onPress={() => handleSubscribe(item.id)}>
              <Ionicons name="notifications-outline" size={13} color="#2563eb" />
              <Text style={styles.copyText}>订阅</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ==== RENDER: Exception Card ====
  const renderExceptionItem = ({ item }) => {
    const level = exceptionLevel(item.exception_type);
    return (
      <TouchableOpacity style={[styles.card, level === 'severe' && styles.cardSevere]} onPress={() => fetchDetail(item.id)}>
        <View style={styles.cardHeader}>
          <View style={[styles.exceptionTag, level === 'severe' ? styles.exceptionSevere : styles.exceptionWarn]}>
            <Ionicons name="warning" size={12} color="#fff" />
            <Text style={styles.exceptionTagText}>{(item.exception_type || '异常')}{level === 'severe' ? ' (严重)' : ' (预警)'}</Text>
          </View>
          <Text style={styles.trackingNo}>{item.tracking_number}</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.company}>{item.customer_name}</Text>
          <Text style={styles.cargoDetail}>{item.cargo_desc} · {item.weight_kg}kg · {item.volume_cbm}cbm</Text>
          <Text style={styles.exceptionDesc}>
            {item.events?.find(e => e.event_type === 'exception')?.description || '异常详情请查看轨迹'}
          </Text>
        </View>
        <View style={styles.exceptionFoot}>
          <Text style={styles.exceptionTime}>发生时间: {formatTime(item.created_at)}</Text>
          <TouchableOpacity style={styles.handleBtn} onPress={() => fetchDetail(item.id)}>
            <Text style={styles.handleText}>查看详情</Text>
            <Ionicons name="chevron-forward" size={14} color="#2563eb" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>运踪</Text>
      </View>

      {/* Segmented control */}
      <View style={styles.segmentedBar}>
        <TouchableOpacity
          style={[styles.segment, activeTab === 'tracking' && styles.segmentActive]}
          onPress={() => setActiveTab('tracking')}
        >
          <Text style={[styles.segmentText, activeTab === 'tracking' && styles.segmentTextActive]}>在途追踪</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, activeTab === 'exception' && styles.segmentActive]}
          onPress={() => setActiveTab('exception')}
        >
          <Text style={[styles.segmentText, activeTab === 'exception' && styles.segmentTextActive]}>异常预警</Text>
        </TouchableOpacity>
      </View>

      {/* === 在途追踪 TAB === */}
      {activeTab === 'tracking' && (
        <>
          {/* Search */}
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color="#94a3b8" />
            <TextInput style={styles.searchInput} placeholder="搜索单号/提单号/柜号/货描..." value={keyword} onChangeText={setKeyword} onSubmitEditing={fetchOrders} />
            {keyword ? <TouchableOpacity onPress={() => setKeyword('')}><Ionicons name="close-circle" size={18} color="#94a3b8" /></TouchableOpacity> : null}
            <TouchableOpacity>
              <Ionicons name="qr-code-outline" size={20} color="#2563eb" />
            </TouchableOpacity>
          </View>

          {/* Filter chips */}
          <View style={styles.filterRow}>
            {STATUS_FILTERS.map(f => (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterChip, statusFilter === f.key && styles.filterChipActive]}
                onPress={() => setStatusFilter(f.key)}
              >
                <Text style={[styles.filterChipText, statusFilter === f.key && styles.filterChipTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <FlatList
            data={orders}
            keyExtractor={item => String(item.id)}
            renderItem={renderOrderItem}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await fetchOrders(); setRefreshing(false); }} />}
            ListEmptyComponent={<EmptyState icon="🚢" title="暂无运单数据" />}
            contentContainerStyle={orders.length === 0 ? { flex: 1 } : { paddingBottom: 20 }}
          />
        </>
      )}

      {/* === 异常预警 TAB === */}
      {activeTab === 'exception' && (
        <>
          {/* Stats */}
          <View style={styles.exceptionStats}>
            <View style={styles.exceptionStatRed}>
              <Text style={styles.exceptionStatCount}>{exceptionStats.severe}</Text>
              <Text style={styles.exceptionStatLabel}>严重异常</Text>
            </View>
            <View style={styles.exceptionStatYellow}>
              <Text style={styles.exceptionStatCount}>{exceptionStats.warning}</Text>
              <Text style={styles.exceptionStatLabel}>延期预警</Text>
            </View>
          </View>

          <FlatList
            data={exceptions}
            keyExtractor={item => String(item.id)}
            renderItem={renderExceptionItem}
            refreshControl={<RefreshControl refreshing={excRefreshing} onRefresh={async () => { setExcRefreshing(true); await fetchExceptions(); setExcRefreshing(false); }} />}
            ListEmptyComponent={<EmptyState icon="✅" title="暂无异常" desc="所有运单运行正常" />}
            contentContainerStyle={exceptions.length === 0 ? { flex: 1 } : { paddingBottom: 20 }}
          />
        </>
      )}

      {/* === 运踪详情 Modal === */}
      <Modal visible={detailVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.detailModal}>
            <View style={styles.detailHeader}>
              <TouchableOpacity onPress={() => setDetailVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
              <Text style={styles.detailTitle}>运踪详情</Text>
              <TouchableOpacity onPress={() => { setDetailVisible(false); copyTracking(detailOrder); }}>
                <Ionicons name="share-outline" size={22} color="#2563eb" />
              </TouchableOpacity>
            </View>

            {/* Order info bar */}
            {detailOrder && (
              <View style={styles.detailInfo}>
                <Text style={styles.detailTrackingNo}>{detailOrder.tracking_number}</Text>
                <Text style={styles.detailRoute}>{detailOrder.route_detail}</Text>
                <View style={styles.detailRouteRow}>
                  <Text style={styles.detailEtc}>
                    ETD: {detailOrder.etd || '-'} → ETA: {detailOrder.eta || '-'}
                  </Text>
                  <StatusBadge label={detailOrder.status} color={STATUS_COLORS[detailOrder.status] || 'gray'} />
                </View>
              </View>
            )}

            {/* Timeline */}
            <FlatList
              data={detailEvents}
              keyExtractor={(_, i) => String(i)}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item: e, index: i }) => {
                const isException = e.event_type === 'exception';
                const isLatest = i === 0;
                return (
                  <View style={styles.timelineRow}>
                    <View style={styles.timelineLeft}>
                      <View style={[styles.timelineDot, isException && styles.timelineDotException, isLatest && styles.timelineDotLatest]} />
                      {i < detailEvents.length - 1 && <View style={styles.timelineLine} />}
                    </View>
                    <View style={[styles.timelineContent, isException && styles.timelineException]}>
                      <View style={styles.timelineEventHeader}>
                        <Ionicons
                          name={eventTypeIcon(e.event_type)}
                          size={14}
                          color={isException ? '#dc2626' : isLatest ? '#2563eb' : '#64748b'}
                        />
                        <Text style={[styles.timelineType, isException && { color: '#dc2626' }, isLatest && { color: '#2563eb', fontWeight: '700' }]}>
                          [{eventTypeLabel(e.event_type)}] {isLatest ? '最新 ' : ''}
                          {e.location}
                        </Text>
                      </View>
                      <Text style={styles.timelineDesc}>{e.description}</Text>
                      <Text style={styles.timelineTime}>{e.time}</Text>
                    </View>
                  </View>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },

  // Segmented control
  segmentedBar: { flexDirection: 'row', marginHorizontal: 16, marginTop: 10, backgroundColor: '#f1f5f9', borderRadius: 10, padding: 3 },
  segment: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  segmentActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
  segmentText: { fontSize: 14, fontWeight: '500', color: '#64748b' },
  segmentTextActive: { color: '#2563eb', fontWeight: '600' },

  // Search
  searchBox: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginVertical: 8, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  searchInput: { flex: 1, fontSize: 14, marginLeft: 8, color: '#334155' },

  // Filter
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 8, backgroundColor: '#fff', gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f1f5f9' },
  filterChipActive: { backgroundColor: '#2563eb' },
  filterChipText: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  filterChipTextActive: { color: '#fff' },

  // Cards
  card: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 8, borderRadius: 12, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  cardSevere: { borderLeftWidth: 3, borderLeftColor: '#dc2626' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  trackingNo: { fontSize: 13, color: '#0f172a', fontFamily: 'monospace', fontWeight: '600' },
  channel: { fontSize: 11, color: '#64748b', backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },

  // Progress bar
  progressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingHorizontal: 4 },
  progressLoc: { fontSize: 10, color: '#94a3b8', width: 42, textAlign: 'center' },
  progressBarWrap: { flex: 1, height: 20, justifyContent: 'center', marginHorizontal: 4 },
  progressBar: { height: 4, backgroundColor: '#e2e8f0', borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: '#2563eb', borderRadius: 2 },
  progressDot: { position: 'absolute', marginLeft: -7, top: 3 },

  // Card foot
  cardFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10 },
  latestEvent: { fontSize: 12, color: '#64748b', flex: 1, marginRight: 8 },
  footActions: { flexDirection: 'row', gap: 8 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0' },
  copyText: { fontSize: 11, color: '#2563eb' },
  subBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#eff6ff' },

  // Exception stats
  exceptionStats: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  exceptionStatRed: { flex: 1, backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, alignItems: 'center', borderLeftWidth: 3, borderLeftColor: '#dc2626' },
  exceptionStatYellow: { flex: 1, backgroundColor: '#fff7ed', borderRadius: 10, padding: 12, alignItems: 'center', borderLeftWidth: 3, borderLeftColor: '#ea580c' },
  exceptionStatCount: { fontSize: 28, fontWeight: '700', color: '#0f172a' },
  exceptionStatLabel: { fontSize: 12, color: '#64748b', marginTop: 2 },

  // Exception card
  cardBody: { marginBottom: 8 },
  company: { fontSize: 15, fontWeight: '600', color: '#0f172a', marginBottom: 2 },
  cargoDetail: { fontSize: 12, color: '#64748b', marginBottom: 6 },
  exceptionTag: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  exceptionSevere: { backgroundColor: '#dc2626' },
  exceptionWarn: { backgroundColor: '#ea580c' },
  exceptionTagText: { fontSize: 11, color: '#fff', fontWeight: '600' },
  exceptionDesc: { fontSize: 13, color: '#dc2626', lineHeight: 18, marginBottom: 4 },
  exceptionFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10 },
  exceptionTime: { fontSize: 11, color: '#94a3b8' },
  handleBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  handleText: { fontSize: 13, fontWeight: '600', color: '#2563eb' },

  // Detail modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.4)', justifyContent: 'flex-end' },
  detailModal: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  detailTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  detailInfo: { padding: 16, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  detailTrackingNo: { fontSize: 16, fontWeight: '700', color: '#0f172a', fontFamily: 'monospace' },
  detailRoute: { fontSize: 13, color: '#64748b', marginTop: 4 },
  detailRouteRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  detailEtc: { fontSize: 11, color: '#94a3b8' },

  // Timeline
  timelineRow: { flexDirection: 'row' },
  timelineLeft: { alignItems: 'center', width: 28, marginRight: 12 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#cbd5e1' },
  timelineDotException: { backgroundColor: '#dc2626' },
  timelineDotLatest: { backgroundColor: '#2563eb', width: 14, height: 14, borderRadius: 7 },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#e2e8f0', marginVertical: 2 },
  timelineContent: { flex: 1, paddingBottom: 20 },
  timelineException: { backgroundColor: '#fef2f2', borderRadius: 8, padding: 10 },
  timelineEventHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  timelineType: { fontSize: 13, fontWeight: '500', color: '#475569' },
  timelineDesc: { fontSize: 14, color: '#334155', lineHeight: 20, marginBottom: 4 },
  timelineTime: { fontSize: 11, color: '#94a3b8' },
});
