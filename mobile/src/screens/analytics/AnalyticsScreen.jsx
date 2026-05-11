import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl,
  Dimensions, Alert,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import client from '../../api/client';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';

const SCREEN_W = Dimensions.get('window').width;

export default function AnalyticsScreen() {
  const [data, setData] = useState(null);
  const [churnData, setChurnData] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [summaryRes, churnRes] = await Promise.all([
        client.get('/api/analytics/summary'),
        client.get('/api/ai/churn_prediction'),
      ]);
      if (summaryRes.ok) setData(summaryRes);
      if (churnRes.ok) setChurnData(churnRes.items || []);
    } catch {}
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); };

  const handleDiagnose = async (customerId) => {
    try {
      const res = await client.get('/api/ai/customer_insight', { params: { customer_id: customerId } });
      if (res.ok) {
        Alert.alert(
          `${res.customer_name} - AI诊断`,
          `${res.insights?.join('\n\n')}\n\n建议: ${res.risk_action}`,
        );
      }
    } catch {}
  };

  const cards = data?.cards || [];
  const healthDist = data?.health_distribution || [];

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.header}>
        <Text style={styles.title}>数据中心</Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statsRow}>
          {cards.slice(0, 2).map((c, i) => (
            <StatCard key={i} title={c.title} value={c.value} sub={c.sub} color={i === 0 ? '#2563eb' : '#16a34a'} bg={i === 0 ? '#eff6ff' : '#f0fdf4'} />
          ))}
        </View>
        <View style={styles.statsRow}>
          {cards.slice(2, 4).map((c, i) => (
            <StatCard key={i} title={c.title} value={c.value} color={i === 0 ? '#ea580c' : '#dc2626'} bg={i === 0 ? '#fff7ed' : '#fef2f2'} />
          ))}
        </View>
      </View>

      <View style={styles.chartSection}>
        <Text style={styles.sectionTitle}>客户健康分布</Text>
        <LineChart
          data={{
            labels: healthDist.map(h => h.name.slice(0, 2)),
            datasets: [{ data: healthDist.map(h => h.value) }],
          }}
          width={SCREEN_W - 64}
          height={180}
          chartConfig={{
            backgroundColor: '#fff',
            backgroundGradientFrom: '#fff',
            backgroundGradientTo: '#fff',
            decimalCount: 0,
            color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
            labelColor: () => '#94a3b8',
          }}
          style={styles.chart}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>流失预警 ({churnData.length})</Text>
        {churnData.slice(0, 8).map((item, i) => (
          <TouchableOpacity key={i} style={styles.churnCard} onPress={() => handleDiagnose(item.customer_id)}>
            <View style={styles.churnTop}>
              <Text style={styles.churnName}>{item.company_name}</Text>
              <View style={[styles.riskScore, { backgroundColor: item.risk_score >= 70 ? '#fef2f2' : '#fefce8' }]}>
                <Text style={{ color: item.risk_score >= 70 ? '#dc2626' : '#ca8a04', fontWeight: '700', fontSize: 14 }}>{item.risk_score}分</Text>
              </View>
            </View>
            <View style={styles.factors}>
              {item.factors?.map((f, j) => (
                <StatusBadge key={j} label={f} color="red" />
              ))}
            </View>
            <Text style={styles.churnAction}>{item.action}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  statsGrid: { paddingHorizontal: 10, paddingTop: 12 },
  statsRow: { flexDirection: 'row', marginBottom: 6 },
  chartSection: { marginTop: 20, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginBottom: 12 },
  chart: { borderRadius: 12, marginLeft: -10 },
  section: { marginTop: 20, paddingHorizontal: 16 },
  churnCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8 },
  churnTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  churnName: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  riskScore: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  factors: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  churnAction: { fontSize: 13, color: '#2563eb', fontWeight: '500' },
});
