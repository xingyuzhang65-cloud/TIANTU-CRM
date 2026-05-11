import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  ActivityIndicator, Alert, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import client from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import ActivityTimeline from '../../components/ActivityTimeline';

const SCREEN_W = Dimensions.get('window').width;
const STAGES = [
  { key: 'developing', label: '开发中', color: 'blue' },
  { key: 'negotiating', label: '报价谈判', color: 'orange' },
  { key: 'cooperating', label: '合作中', color: 'green' },
  { key: 'archived', label: '已归档', color: 'gray' },
];

export default function CustomerDetailScreen({ route, navigation }) {
  const { customerId } = route.params;
  const [cust, setCust] = useState(null);
  const [opps, setOpps] = useState([]);
  const [orders, setOrders] = useState([]);
  const [credit, setCredit] = useState(null);
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFollow, setShowFollow] = useState(false);
  const [followType, setFollowType] = useState('call');
  const [followContent, setFollowContent] = useState('');
  const [aiInsight, setAiInsight] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [custRes, trendRes] = await Promise.all([
        client.get(`/api/customers/${customerId}`),
        client.get(`/api/customers/${customerId}/trend`),
      ]);
      if (custRes.customer) {
        setCust(custRes.customer);
        setOpps(custRes.opportunities || []);
        setOrders(custRes.orders || []);
        setCredit(custRes.credit);
      }
      if (trendRes.ok) setTrend(trendRes.trend || []);
    } catch {}
    setLoading(false);
  }, [customerId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleTransition = async (stage) => {
    try {
      const res = await client.post(`/api/customer/${customerId}/transition?to_status=${stage}&operator=张晓明`);
      if (res.ok) { Alert.alert('成功', res.msg); fetchData(); }
      else Alert.alert('失败', res.msg);
    } catch (e) { Alert.alert('错误', e.message); }
  };

  const handleFollow = async () => {
    if (!followContent.trim()) { Alert.alert('提示', '请输入内容'); return; }
    try {
      const res = await client.post(`/api/customer/${customerId}/add-activity?activity_type=${followType}&content=${encodeURIComponent(followContent)}&created_by=张晓明`);
      if (res.ok) { Alert.alert('成功', res.msg); setShowFollow(false); setFollowContent(''); fetchData(); }
    } catch (e) { Alert.alert('错误', e.message); }
  };

  const handleAIInsight = async () => {
    try {
      const res = await client.get('/api/ai/customer_insight', { params: { customer_id: customerId } });
      if (res.ok) setAiInsight(res);
    } catch {}
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#2563eb" /></View>;
  if (!cust) return <View style={styles.center}><Text>信息加载失败</Text></View>;

  const trendLabels = trend.slice(-6).map(t => t.label || '');
  const trendData = trend.slice(-6).map(t => t.volume || 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{cust.company_name}</Text>
        <TouchableOpacity onPress={handleAIInsight}>
          <Ionicons name="bulb" size={22} color="#f59e0b" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body}>
        <View style={styles.topCard}>
          <View style={styles.topRow}>
            <Text style={styles.company} numberOfLines={1}>{cust.company_name}</Text>
            <StatusBadge label={cust.customer_level} color="green" size="lg" />
          </View>
          <View style={styles.tags}>
            <StatusBadge label={cust.lifecycle_label || cust.lifecycle_status} color="blue" />
            {cust.order_frequency_tag ? <StatusBadge label={cust.order_frequency_tag} color="purple" /> : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>生命周期阶段</Text>
          <View style={styles.stageRow}>
            {STAGES.map(s => (
              <TouchableOpacity
                key={s.key}
                style={[styles.stageBtn, cust.lifecycle_status === s.key && { backgroundColor: '#2563eb' }]}
                onPress={() => handleTransition(s.key)}
              >
                <Text style={[styles.stageText, cust.lifecycle_status === s.key && { color: '#fff' }]}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricVal}>{(cust.volume_mom > 0 ? '+' : '')}{(cust.volume_mom || 0).toFixed(1)}%</Text>
            <Text style={styles.metricLbl}>货量环比 MoM</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricVal}>{(cust.avg_monthly_revenue / 10000).toFixed(1)}万</Text>
            <Text style={styles.metricLbl}>月均营收</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricVal}>{cust.monthly_order_count || 0}</Text>
            <Text style={styles.metricLbl}>近30天运单</Text>
          </View>
        </View>

        {trendData.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>6个月货量走势</Text>
            <LineChart
              data={{ labels: trendLabels, datasets: [{ data: trendData.length > 0 ? trendData : [0] }] }}
              width={SCREEN_W - 64}
              height={180}
              yAxisSuffix="kg"
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
        )}

        <View style={styles.infoGrid}>
          <View style={styles.infoItem}><Text style={styles.infoLabel}>联系人</Text><Text style={styles.infoVal}>{cust.contact_name || '-'}</Text></View>
          <View style={styles.infoItem}><Text style={styles.infoLabel}>电话</Text><Text style={styles.infoVal}>{cust.phone || '-'}</Text></View>
          <View style={styles.infoItem}><Text style={styles.infoLabel}>邮箱</Text><Text style={styles.infoVal}>{cust.email || '-'}</Text></View>
          <View style={styles.infoItem}><Text style={styles.infoLabel}>国家</Text><Text style={styles.infoVal}>{cust.country || '-'}</Text></View>
        </View>

        {credit && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>信用概览</Text>
            <View style={styles.creditCard}>
              <View style={styles.creditRow}>
                <Text style={styles.creditLabel}>信用评分</Text>
                <Text style={[styles.creditVal, { color: credit.credit_score >= 700 ? '#16a34a' : credit.credit_score >= 500 ? '#f59e0b' : '#dc2626' }]}>{credit.credit_score}</Text>
              </View>
              <View style={styles.creditRow}>
                <Text style={styles.creditLabel}>当前欠款</Text>
                <Text style={styles.creditVal}>{(credit.balance_due / 10000).toFixed(1)}万</Text>
              </View>
              <View style={styles.creditRow}>
                <Text style={styles.creditLabel}>账龄</Text>
                <Text style={[styles.creditVal, { color: credit.days_aged > 60 ? '#dc2626' : credit.days_aged > 30 ? '#f59e0b' : '#334155' }]}>{credit.days_aged}天</Text>
              </View>
            </View>
          </View>
        )}

        {opps.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>商机 ({opps.length})</Text>
            {opps.map(o => (
              <View key={o.id} style={styles.oppCard}>
                <Text style={styles.oppName}>{o.name}</Text>
                <View style={styles.oppRow}>
                  <StatusBadge label={o.stage} color="blue" />
                  <Text style={styles.oppAmount}>¥{(o.amount / 10000).toFixed(1)}万</Text>
                  <Text style={styles.oppProb}>赢率 {o.win_probability}%</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {orders.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>最近运单</Text>
            {orders.slice(0, 5).map(o => (
              <View key={o.id} style={styles.orderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderTN}>{o.tracking_number}</Text>
                  <Text style={styles.orderRoute}>{o.route_detail}</Text>
                </View>
                <StatusBadge label={o.status} color={o.has_exception ? 'red' : 'green'} />
              </View>
            ))}
          </View>
        )}

        {aiInsight && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>AI 客户洞察</Text>
            <View style={styles.aiCard}>
              <Text style={styles.aiRisk}>风险等级: {aiInsight.risk_level} <Text style={{ color: aiInsight.risk_color }}>●</Text></Text>
              {aiInsight.insights?.map((s, i) => (
                <Text key={i} style={styles.aiText}>• {s}</Text>
              ))}
              <Text style={styles.aiAction}>建议: {aiInsight.risk_action}</Text>
            </View>
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => setShowFollow(!showFollow)}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {showFollow && (
        <View style={styles.followPanel}>
          <View style={styles.followTypeRow}>
            {['call', 'meeting', 'email', 'visit'].map(t => (
              <TouchableOpacity key={t} style={[styles.typeChip, followType === t && styles.typeChipActive]} onPress={() => setFollowType(t)}>
                <Text style={[styles.typeText, followType === t && styles.typeTextActive]}>
                  {{ call: '📞 电话', meeting: '🤝 会议', email: '📧 邮件', visit: '🏢 拜访' }[t]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput style={styles.followInput} placeholder="输入跟进内容..." value={followContent} onChangeText={setFollowContent} multiline />
          <TouchableOpacity style={styles.followBtn} onPress={handleFollow}>
            <Text style={styles.followBtnText}>保存跟进</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, backgroundColor: '#fff' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#0f172a', flex: 1, marginHorizontal: 12 },
  body: { flex: 1 },
  topCard: { backgroundColor: '#fff', margin: 16, borderRadius: 12, padding: 16 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  company: { fontSize: 20, fontWeight: '700', color: '#0f172a', flex: 1 },
  tags: { flexDirection: 'row', gap: 8, marginTop: 10 },
  section: { marginTop: 16, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginBottom: 10 },
  stageRow: { flexDirection: 'row', gap: 8 },
  stageBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center' },
  stageText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  metricsRow: { flexDirection: 'row', paddingHorizontal: 11, marginTop: 16 },
  metricCard: { flex: 1, backgroundColor: '#fff', margin: 5, borderRadius: 10, padding: 12, alignItems: 'center' },
  metricVal: { fontSize: 18, fontWeight: '700', color: '#2563eb' },
  metricLbl: { fontSize: 11, color: '#94a3b8', marginTop: 4 },
  chart: { borderRadius: 12, marginLeft: -16 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 12, padding: 8, marginTop: 16 },
  infoItem: { width: '50%', padding: 8 },
  infoLabel: { fontSize: 11, color: '#94a3b8', marginBottom: 2 },
  infoVal: { fontSize: 15, color: '#334155', fontWeight: '500' },
  creditCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12 },
  creditRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  creditLabel: { fontSize: 14, color: '#64748b' },
  creditVal: { fontSize: 16, fontWeight: '600', color: '#334155' },
  oppCard: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8 },
  oppName: { fontSize: 15, fontWeight: '600', color: '#0f172a', marginBottom: 6 },
  oppRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  oppAmount: { fontSize: 14, fontWeight: '600', color: '#2563eb' },
  oppProb: { fontSize: 12, color: '#94a3b8' },
  orderRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 6 },
  orderTN: { fontSize: 14, fontWeight: '600', color: '#334155' },
  orderRoute: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  aiCard: { backgroundColor: '#fffbe6', borderRadius: 12, padding: 14, borderLeftWidth: 3, borderLeftColor: '#f59e0b' },
  aiRisk: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginBottom: 8 },
  aiText: { fontSize: 13, color: '#334155', lineHeight: 20, marginBottom: 2 },
  aiAction: { fontSize: 14, fontWeight: '600', color: '#2563eb', marginTop: 8 },
  fab: { position: 'absolute', right: 20, bottom: 30, width: 56, height: 56, borderRadius: 28, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 6 },
  followPanel: { position: 'absolute', bottom: 100, left: 16, right: 16, backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 8 },
  followTypeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  typeChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f1f5f9' },
  typeChipActive: { backgroundColor: '#2563eb' },
  typeText: { fontSize: 13, color: '#64748b' },
  typeTextActive: { color: '#fff' },
  followInput: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 12, fontSize: 14, minHeight: 60, borderWidth: 1, borderColor: '#e2e8f0', textAlignVertical: 'top' },
  followBtn: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  followBtnText: { color: '#fff', fontWeight: '600' },
});
