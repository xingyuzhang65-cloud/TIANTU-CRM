import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, Dimensions,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import client from '../../api/client';
import StatCard from '../../components/StatCard';
import ActivityTimeline from '../../components/ActivityTimeline';
import { useAuth } from '../../context/AuthContext';

const SCREEN_W = Dimensions.get('window').width;

export default function DashboardScreen() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await client.get('/api/analytics/summary');
      if (res.ok) setData(res);
    } catch {}
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const cards = data?.cards || [];
  const health = data?.health_distribution || [];

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>早上好 👋</Text>
          <Text style={styles.name}>{user?.name || '销售经理'}</Text>
        </View>
        <Text style={styles.date}>{new Date().toLocaleDateString('zh-CN')}</Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statsRow}>
          <StatCard title="客户总数" value={cards[0]?.value || '--'} sub={cards[0]?.sub || ''} color="#2563eb" bg="#eff6ff" />
          <StatCard title="活跃运单" value={cards[1]?.value || '--'} sub={cards[1]?.sub || ''} color="#16a34a" bg="#f0fdf4" />
        </View>
        <View style={styles.statsRow}>
          <StatCard title="营收总额" value={cards[2]?.value || '--'} color="#ea580c" bg="#fff7ed" />
          <StatCard title="应收余额" value={cards[3]?.value || '--'} color="#dc2626" bg="#fef2f2" />
        </View>
      </View>

      {health.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>客户健康分布</Text>
          <View style={styles.healthRow}>
            {health.map((h, i) => (
              <View key={i} style={styles.healthItem}>
                <View style={[styles.healthBar, { backgroundColor: h.color, width: `${Math.max(h.value / Math.max(...health.map(x => x.value || 1)) * 100, 15)}%` }]} />
                <Text style={styles.healthLabel}>{h.name}</Text>
                <Text style={styles.healthValue}>{h.value}家</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>月度趋势 (营收 · 万元)</Text>
        <LineChart
          data={{
            labels: ['1月', '2月', '3月', '4月', '5月'],
            datasets: [
              { data: [42, 38, 51, 59, 68], color: () => '#2563eb', strokeWidth: 2 },
              { data: [28, 24, 33, 38, 45], color: () => '#16a34a', strokeWidth: 2 },
            ],
          }}
          width={SCREEN_W - 48}
          height={200}
          yAxisSuffix="万"
          chartConfig={{
            backgroundColor: '#fff',
            backgroundGradientFrom: '#fff',
            backgroundGradientTo: '#fff',
            decimalCount: 0,
            color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
            labelColor: () => '#94a3b8',
            propsForDots: { r: '4', strokeWidth: '1' },
          }}
          bezier
          style={styles.chart}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>最近动态</Text>
        <ActivityTimeline activities={[
          { id: 1, activity_type: 'call', content: '联系思科达电子确认Q3发货计划', created_by: user?.name || '', created_at: new Date().toISOString() },
          { id: 2, activity_type: 'status_change', content: '客户富通国际 意向客户 → 已报价', created_by: '李强', created_at: new Date().toISOString() },
          { id: 3, activity_type: 'email', content: '发送美森快船报价方案给华盛物流', created_by: user?.name || '', created_at: new Date().toISOString() },
        ]} />
      </View>

      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, backgroundColor: '#fff' },
  greeting: { fontSize: 14, color: '#64748b' },
  name: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginTop: 2 },
  date: { fontSize: 13, color: '#94a3b8' },
  statsGrid: { paddingHorizontal: 10, paddingTop: 16 },
  statsRow: { flexDirection: 'row', marginBottom: 6 },
  section: { marginTop: 20, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginBottom: 12 },
  healthRow: { gap: 8 },
  healthItem: { marginBottom: 8 },
  healthBar: { height: 28, borderRadius: 6, justifyContent: 'center', paddingLeft: 10 },
  healthLabel: { position: 'absolute', left: 10, top: 5, fontSize: 12, fontWeight: '600', color: '#fff' },
  healthValue: { fontSize: 12, color: '#64748b', marginTop: 2 },
  chart: { borderRadius: 12, marginLeft: -8 },
});
