import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
  Modal, TextInput, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';

const ROUTES = ['海派', '空派', '铁运', '卡航'];
const CARGO_TYPES = ['普货', '带电产品', '重货', '纺织品', '敏感品'];
const INCOTERMS = ['FOB', 'CIF', 'DDP', 'FCA'];

export default function QuotationScreen() {
  const [quotes, setQuotes] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [aiForm, setAiForm] = useState({ route_type: '海派', weight: '100', volume: '1', cargo_type: '普货', incoterms: 'FOB' });
  const [aiResult, setAiResult] = useState(null);

  const fetchQuotes = useCallback(async () => {
    try {
      const res = await client.get('/api/quotations/list');
      if (res.ok) setQuotes(res.quotations || []);
    } catch {}
  }, []);

  useEffect(() => { fetchQuotes(); }, [fetchQuotes]);

  const onRefresh = async () => { setRefreshing(true); await fetchQuotes(); setRefreshing(false); };

  const handleAIQuote = async () => {
    try {
      const res = await client.get('/api/ai/smart_quote', { params: aiForm });
      if (res.ok) setAiResult(res);
    } catch (e) { Alert.alert('错误', e.message); }
  };

  const getStatusColor = (s) => {
    switch (s) {
      case 'accepted': return 'green';
      case 'sent': return 'blue';
      case 'pending': return 'yellow';
      default: return 'gray';
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.company}>{item.company_name}</Text>
        <StatusBadge label={item.status} color={getStatusColor(item.status)} />
      </View>
      <View style={styles.cardMid}>
        <StatusBadge label={item.route_type} color="blue" />
        <Text style={styles.route}>{item.route_detail || ''}</Text>
      </View>
      <View style={styles.cardBottom}>
        <Text style={styles.detail}>{item.cargo_type} · {item.weight_kg}kg · {item.volume_cbm}cbm</Text>
        <Text style={styles.price}>¥{(item.total_price || 0).toFixed(2)}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>报价管理</Text>
        <TouchableOpacity style={styles.aiBtn} onPress={() => setShowAI(true)}>
          <Ionicons name="flash" size={18} color="#fff" />
          <Text style={styles.aiBtnText}>AI智能报价</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={quotes}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<EmptyState icon="💰" title="暂无报价单" />}
        contentContainerStyle={quotes.length === 0 ? { flex: 1 } : { paddingBottom: 20 }}
      />

      <Modal visible={showAI} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>AI 智能报价</Text>
              <TouchableOpacity onPress={() => { setShowAI(false); setAiResult(null); }}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>运输方式</Text>
            <View style={styles.chipRow}>
              {ROUTES.map(r => (
                <TouchableOpacity key={r} style={[styles.chip, aiForm.route_type === r && styles.chipActive]} onPress={() => setAiForm({ ...aiForm, route_type: r })}>
                  <Text style={[styles.chipText, aiForm.route_type === r && styles.chipTextActive]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.inputRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>重量(kg)</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={aiForm.weight} onChangeText={v => setAiForm({ ...aiForm, weight: v })} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>体积(cbm)</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={aiForm.volume} onChangeText={v => setAiForm({ ...aiForm, volume: v })} />
              </View>
            </View>

            <Text style={styles.label}>货物类型</Text>
            <View style={styles.chipRow}>
              {CARGO_TYPES.map(c => (
                <TouchableOpacity key={c} style={[styles.chip, aiForm.cargo_type === c && styles.chipActive]} onPress={() => setAiForm({ ...aiForm, cargo_type: c })}>
                  <Text style={[styles.chipText, aiForm.cargo_type === c && styles.chipTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.quoteBtn} onPress={handleAIQuote}>
              <Text style={styles.quoteBtnText}>获取报价</Text>
            </TouchableOpacity>

            {aiResult && (
              <View style={styles.resultCard}>
                <Text style={styles.resultPrice}>¥{aiResult.estimated_price}</Text>
                <Text style={styles.resultCalc}>{aiResult.calculation}</Text>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakItem}>基础运费: ¥{aiResult.breakdown?.base_freight}</Text>
                  <Text style={styles.breakItem}>燃油附加: ¥{aiResult.breakdown?.fuel_surcharge}</Text>
                </View>
                <Text style={styles.validText}>有效期至: {aiResult.valid_until}</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  aiBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f59e0b', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, gap: 4 },
  aiBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  card: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 8, borderRadius: 12, padding: 14 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  company: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  cardMid: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  route: { fontSize: 13, color: '#64748b' },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detail: { fontSize: 12, color: '#94a3b8' },
  price: { fontSize: 18, fontWeight: '700', color: '#2563eb' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 6, marginTop: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  chipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText: { fontSize: 13, color: '#64748b' },
  chipTextActive: { color: '#fff' },
  inputRow: { flexDirection: 'row', gap: 12 },
  input: { backgroundColor: '#f8fafc', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  quoteBtn: { backgroundColor: '#f59e0b', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  quoteBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  resultCard: { backgroundColor: '#f0fdf4', borderRadius: 12, padding: 14, marginTop: 14, borderLeftWidth: 3, borderLeftColor: '#16a34a' },
  resultPrice: { fontSize: 28, fontWeight: '700', color: '#16a34a' },
  resultCalc: { fontSize: 12, color: '#64748b', marginTop: 4 },
  breakdownRow: { marginTop: 8 },
  breakItem: { fontSize: 13, color: '#334155', marginBottom: 2 },
  validText: { fontSize: 11, color: '#94a3b8', marginTop: 6 },
});
