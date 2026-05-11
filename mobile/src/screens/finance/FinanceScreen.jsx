import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
} from 'react-native';
import client from '../../api/client';
import StatCard from '../../components/StatCard';
import EmptyState from '../../components/EmptyState';

export default function FinanceScreen() {
  const [credits, setCredits] = useState([]);
  const [summary, setSummary] = useState({});
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await client.get('/api/credits/list');
      if (res.ok) {
        setCredits(res.credits || []);
        setSummary(res.summary || {});
      }
    } catch {}
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); };

  const getScoreColor = (s) => {
    if (s >= 700) return ['#f0fdf4', '#16a34a'];
    if (s >= 500) return ['#fefce8', '#ca8a04'];
    return ['#fef2f2', '#dc2626'];
  };

  const getDayColor = (d) => {
    if (d > 60) return '#dc2626';
    if (d > 30) return '#f59e0b';
    return '#16a34a';
  };

  const renderItem = ({ item }) => {
    const [scoreBg, scoreC] = getScoreColor(item.credit_score);
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.company}>{item.company_name}</Text>
          <Text style={[styles.riskBadge, { color: item.days_aged > 60 ? '#dc2626' : item.days_aged > 30 ? '#f59e0b' : '#16a34a' }]}>
            {item.days_aged > 60 ? '高风险' : item.days_aged > 30 ? '需关注' : '正常'}
          </Text>
        </View>
        <View style={styles.scoreRow}>
          <View style={[styles.scoreBox, { backgroundColor: scoreBg }]}>
            <Text style={[styles.scoreVal, { color: scoreC }]}>{item.credit_score}</Text>
            <Text style={[styles.scoreLabel, { color: scoreC }]}>信用评分</Text>
          </View>
          <View style={styles.financeInfo}>
            <View style={styles.finRow}>
              <Text style={styles.finLabel}>欠款</Text>
              <Text style={styles.finVal}>¥{(item.balance_due / 10000).toFixed(1)}万</Text>
            </View>
            <View style={styles.finRow}>
              <Text style={styles.finLabel}>账龄</Text>
              <Text style={[styles.finVal, { color: getDayColor(item.days_aged) }]}>{item.days_aged}天</Text>
            </View>
            <View style={styles.finRow}>
              <Text style={styles.finLabel}>使用率</Text>
              <Text style={styles.finVal}>{item.usage_rate || 0}%</Text>
            </View>
          </View>
        </View>
        <View style={styles.progressBg}>
          <View style={[styles.progressBar, { width: `${Math.min(item.usage_rate || 0, 100)}%`, backgroundColor: (item.usage_rate || 0) > 70 ? '#dc2626' : '#2563eb' }]} />
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>财务与信用</Text>
      </View>

      <View style={styles.summaryRow}>
        <StatCard title="应收总额" value={`¥${((summary.total_balance || 0) / 10000).toFixed(1)}万`} color="#2563eb" bg="#eff6ff" />
        <StatCard title="逾期应收" value={`¥${((summary.overdue || 0) / 10000).toFixed(1)}万`} color="#dc2626" bg="#fef2f2" />
      </View>

      <FlatList
        data={credits}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<EmptyState icon="🛡️" title="暂无信用数据" />}
        contentContainerStyle={credits.length === 0 ? { flex: 1 } : { paddingBottom: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  summaryRow: { flexDirection: 'row', paddingHorizontal: 10, paddingTop: 12 },
  card: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 8, borderRadius: 12, padding: 14 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  company: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  riskBadge: { fontSize: 12, fontWeight: '600' },
  scoreRow: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  scoreBox: { borderRadius: 10, padding: 10, alignItems: 'center', minWidth: 80 },
  scoreVal: { fontSize: 22, fontWeight: '700' },
  scoreLabel: { fontSize: 10, marginTop: 2 },
  financeInfo: { flex: 1, gap: 4 },
  finRow: { flexDirection: 'row', justifyContent: 'space-between' },
  finLabel: { fontSize: 12, color: '#94a3b8' },
  finVal: { fontSize: 14, fontWeight: '600', color: '#334155' },
  progressBg: { height: 4, backgroundColor: '#f1f5f9', borderRadius: 2 },
  progressBar: { height: 4, borderRadius: 2 },
});
