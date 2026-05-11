import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
  Modal, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';

const STATUS_COLORS = {
  received: 'blue', warehouse: 'yellow', departed: 'orange',
  customs: 'red', transit: 'blue', arrived: 'green', delivered: 'green',
};

export default function TrackingScreen() {
  const [orders, setOrders] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [events, setEvents] = useState([]);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await client.get('/api/orders/list');
      if (res.ok) setOrders(res.orders || []);
    } catch {}
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const onRefresh = async () => { setRefreshing(true); await fetchOrders(); setRefreshing(false); };

  const handleViewTracking = async (orderId) => {
    try {
      const res = await client.get(`/api/tracking/${orderId}`);
      if (res.ok) {
        setSelectedOrder(res.order);
        setEvents(res.events || []);
      }
    } catch (e) { Alert.alert('错误', e.message); }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => handleViewTracking(item.id)}>
      <View style={styles.cardTop}>
        <Text style={styles.trackingNo}>{item.tracking_number}</Text>
        <StatusBadge label={item.status} color={item.has_exception ? 'red' : (STATUS_COLORS[item.status] || 'blue')} />
      </View>
      <Text style={styles.company}>{item.company_name}</Text>
      <Text style={styles.route}>{item.route_detail}</Text>
      <View style={styles.cardBottom}>
        <Text style={styles.cargo}>{item.cargo_desc} · {item.weight_kg}kg</Text>
        {item.eta && <Text style={styles.eta}>ETA: {item.eta}</Text>}
      </View>
      {item.has_exception && (
        <View style={styles.exceptionBadge}>
          <Ionicons name="warning" size={14} color="#dc2626" />
          <Text style={styles.exceptionText}>异常: {item.exception_type}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>轨迹追踪</Text>
      </View>

      <FlatList
        data={orders}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<EmptyState icon="📦" title="暂无运单" />}
        contentContainerStyle={orders.length === 0 ? { flex: 1 } : { paddingBottom: 20 }}
      />

      <Modal visible={!!selectedOrder} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>运单详情</Text>
              <TouchableOpacity onPress={() => { setSelectedOrder(null); setEvents([]); }}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            {selectedOrder && (
              <>
                <View style={styles.orderInfo}>
                  <Text style={styles.orderTN}>{selectedOrder.tracking_number}</Text>
                  <View style={styles.orderInfoRow}>
                    <Text style={styles.orderLabel}>路线</Text>
                    <Text style={styles.orderVal}>{selectedOrder.route_detail}</Text>
                  </View>
                  <View style={styles.orderInfoRow}>
                    <Text style={styles.orderLabel}>状态</Text>
                    <StatusBadge label={selectedOrder.status} color={selectedOrder.has_exception ? 'red' : 'green'} />
                  </View>
                  <View style={styles.orderInfoRow}>
                    <Text style={styles.orderLabel}>ETD</Text>
                    <Text style={styles.orderVal}>{selectedOrder.etd || '-'}</Text>
                  </View>
                  <View style={styles.orderInfoRow}>
                    <Text style={styles.orderLabel}>ETA</Text>
                    <Text style={styles.orderVal}>{selectedOrder.eta || '-'}</Text>
                  </View>
                </View>
                <Text style={styles.timelineTitle}>物流轨迹</Text>
                {events.map((e, i) => (
                  <View key={i} style={styles.eventRow}>
                    <View style={styles.eventDot}>
                      <View style={[styles.dot, e.event_type === 'exception' && styles.dotException]} />
                      {i < events.length - 1 && <View style={styles.connector} />}
                    </View>
                    <View style={styles.eventContent}>
                      <Text style={styles.eventType}>{e.event_type}</Text>
                      <Text style={styles.eventDesc}>{e.description}</Text>
                      <Text style={styles.eventMeta}>{e.location} · {e.time?.slice(0, 16)}</Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  card: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 8, borderRadius: 12, padding: 14 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  trackingNo: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  company: { fontSize: 14, color: '#334155', marginBottom: 4 },
  route: { fontSize: 13, color: '#64748b', marginBottom: 8 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between' },
  cargo: { fontSize: 12, color: '#94a3b8' },
  eta: { fontSize: 12, color: '#2563eb', fontWeight: '500' },
  exceptionBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 8, backgroundColor: '#fef2f2', padding: 6, borderRadius: 6, gap: 4 },
  exceptionText: { fontSize: 12, color: '#dc2626', fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  orderInfo: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 14, marginBottom: 16 },
  orderTN: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 10 },
  orderInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  orderLabel: { fontSize: 13, color: '#94a3b8' },
  orderVal: { fontSize: 14, color: '#334155' },
  timelineTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginBottom: 12 },
  eventRow: { flexDirection: 'row', minHeight: 56 },
  eventDot: { alignItems: 'center', width: 24 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2563eb', marginTop: 4 },
  dotException: { backgroundColor: '#dc2626' },
  connector: { flex: 1, width: 2, backgroundColor: '#e2e8f0' },
  eventContent: { flex: 1, paddingBottom: 14, paddingLeft: 8 },
  eventType: { fontSize: 13, fontWeight: '600', color: '#334155' },
  eventDesc: { fontSize: 13, color: '#64748b', marginTop: 2 },
  eventMeta: { fontSize: 11, color: '#94a3b8', marginTop: 4 },
});
