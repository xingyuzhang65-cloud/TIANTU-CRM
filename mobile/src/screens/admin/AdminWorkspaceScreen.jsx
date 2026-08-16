import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl,
  TextInput, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import client from '../../api/client';
import StatusBadge from '../../components/StatusBadge';

const SCREEN_W = Dimensions.get('window').width;

const MODULES = [
  { key: 'customers', title: '客户视图', icon: 'people-outline' },
  { key: 'risk', title: '风控授信', icon: 'shield-checkmark-outline' },
  { key: 'analytics', title: '经营分析', icon: 'stats-chart-outline' },
  { key: 'ai', title: 'AI助手', icon: 'sparkles-outline' },
];

const CUSTOMER_TABS = [
  { key: 'my', label: '我的客户' },
  { key: 'pool', label: '公司池' },
  { key: 'expiring', label: '即将掉保' },
  { key: 'all', label: '全部' },
  { key: 'closed', label: '成交客户' },
];

const tabDesc = {
  my: '销售个人维护中的客户，重点处理跟进状态和保护期。',
  pool: '公司公海客户，支持领取、分配和重新归属。',
  expiring: '保护期临近到期，需要尽快补充有效跟进。',
  all: '管理视角聚合全部客户，用于全局检索和分派。',
  closed: '已成交客户，重点关注复购、账期和服务体验。',
};

const statusColor = {
  我的客户: 'blue',
  公司池: 'orange',
  即将掉保: 'red',
  成交客户: 'green',
  全部客户: 'gray',
};

const currencyWan = (value) => {
  const n = Number(value || 0);
  if (!n) return '0万';
  return `${(n / 10000).toFixed(n >= 100000 ? 1 : 2)}万`;
};

const fmtDate = (value) => {
  if (!value) return '-';
  return String(value).slice(0, 10);
};

function Section({ title, action, children }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

function MetricCard({ label, value, sub, color = '#2563eb', icon = 'analytics-outline' }) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      {sub ? <Text style={styles.metricSub} numberOfLines={1}>{sub}</Text> : null}
    </View>
  );
}

export default function AdminWorkspaceScreen({ navigation }) {
  const [activeModule, setActiveModule] = useState('customers');
  const [activeCustomerTab, setActiveCustomerTab] = useState('my');
  const [keyword, setKeyword] = useState('');
  const [summary, setSummary] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [customerCounts, setCustomerCounts] = useState({});
  const [credits, setCredits] = useState([]);
  const [creditSummary, setCreditSummary] = useState(null);
  const [churnItems, setChurnItems] = useState([]);
  const [aiQuote, setAiQuote] = useState(null);
  const [voiceLog, setVoiceLog] = useState(null);
  const [meeting, setMeeting] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const loadSummary = useCallback(async () => {
    const res = await client.get('/api/analytics/summary');
    if (res.ok) setSummary(res);
  }, []);

  const loadCustomers = useCallback(async () => {
    const params = {
      tab: activeCustomerTab,
      keyword: keyword.trim() || undefined,
      page_size: 30,
    };
    try {
      const res = await client.get('/api/crm/customers', { params });
      if (res.ok) {
        setCustomers(res.records || []);
        setCustomerCounts(res.tab_counts || {});
        return;
      }
    } catch {}

    const fallback = await client.get('/api/customers/list', {
      params: {
        stage: activeCustomerTab === 'pool'
          ? 'churned'
          : activeCustomerTab === 'closed'
            ? 'cooperating'
            : activeCustomerTab === 'expiring'
              ? 'cooperating'
              : activeCustomerTab === 'my'
                ? 'cooperating'
                : undefined,
        sub_tab: activeCustomerTab === 'expiring' ? 'credit_risk' : undefined,
        keyword: keyword.trim() || undefined,
      },
    });
    if (fallback.ok) {
      const list = fallback.customers || [];
      setCustomers(list.map((item) => ({
        id: item.id,
        customer_name: item.company_name,
        company_name: item.company_name,
        masked_mobile: item.phone ? `${String(item.phone).slice(0, 3)}****${String(item.phone).slice(-4)}` : '-',
        owner: item.owner || '',
        ownership_status: activeCustomerTab === 'pool'
          ? 'COMPANY_POOL'
          : activeCustomerTab === 'closed'
            ? 'CLOSED_CUSTOMER'
            : activeCustomerTab === 'expiring'
              ? 'EXPIRING_PROTECTION'
              : 'MY_CUSTOMER',
        ownership_label: activeCustomerTab === 'pool'
          ? '公司池'
          : activeCustomerTab === 'closed'
            ? '成交客户'
            : activeCustomerTab === 'expiring'
              ? '即将掉保'
              : '我的客户',
        follow_status_label: item.lifecycle_label || '跟进中',
        latest_follow: item.latest_follow,
        protect_expire_at: item.protect_expire_at,
        closed_at: item.closed_at,
        tags: [item.customer_type, item.customer_level, item.main_category].filter(Boolean),
      })));
      setCustomerCounts({
        my: fallback.customers?.filter?.(() => true)?.length || 0,
        pool: activeCustomerTab === 'pool' ? list.length : 0,
        expiring: activeCustomerTab === 'expiring' ? list.length : 0,
        all: list.length,
        closed: activeCustomerTab === 'closed' ? list.length : 0,
      });
    }
  }, [activeCustomerTab, keyword]);

  const loadCredits = useCallback(async () => {
    const res = await client.get('/api/credits/list');
    if (res.ok) {
      setCredits(res.credits || []);
      setCreditSummary(res.summary || null);
    }
  }, []);

  const loadChurn = useCallback(async () => {
    const res = await client.get('/api/ai/churn_prediction');
    if (res.ok) setChurnItems(res.items || []);
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([
      loadSummary(),
      loadCustomers(),
      loadCredits(),
      loadChurn(),
    ]);
  }, [loadSummary, loadCustomers, loadCredits, loadChurn]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const cards = summary?.cards || [];
  const stageCounts = summary?.stage_counts || {};
  const healthDistribution = summary?.health_distribution || [];

  const customerRows = useMemo(() => customers.map((item) => ({
    id: item.id,
    name: item.customer_name || item.company_name,
    company: item.company_name,
    mobile: item.masked_mobile || item.phone || item.mobile,
    owner: item.owner || item.owner_name || '未分配',
    ownership: item.ownership_label || item.ownership_status || '我的客户',
    follow: item.follow_status_label || item.lifecycle_label || '跟进中',
    latest: item.latest_follow?.content || item.latest_follow || '暂无最近跟进',
    latestTime: item.latest_follow?.created_at || item.last_followup_at,
    protectTime: item.protect_expire_at || item.closed_at,
    tags: item.tags || [],
  })), [customers]);

  const openBatchAction = (name) => {
    Alert.alert(name, '移动端已保留该管理操作入口，可对接后台批量执行。');
  };

  const runSmartQuote = async () => {
    setLoadingAi(true);
    try {
      const res = await client.get('/api/ai/smart_quote', {
        params: { route_type: '海派', weight: 1200, volume: 8.5, cargo_type: '带电产品', incoterms: 'DDP' },
      });
      if (res.ok) setAiQuote(res);
    } catch (e) {
      Alert.alert('AI报价失败', e.message);
    }
    setLoadingAi(false);
  };

  const runVoiceLog = async () => {
    setLoadingAi(true);
    try {
      const res = await client.get('/api/ai/voice_log', {
        params: { customer_name: '深圳思科达电子有限公司', content: '电话确认 Q3 美森包舱和账期安排' },
      });
      if (res.ok) setVoiceLog(res);
    } catch (e) {
      Alert.alert('语音录单失败', e.message);
    }
    setLoadingAi(false);
  };

  const runMeeting = async () => {
    setLoadingAi(true);
    try {
      const res = await client.get('/api/ai/meeting_summary', {
        params: { meeting_type: '客户拜访' },
      });
      if (res.ok) setMeeting(res);
    } catch (e) {
      Alert.alert('会议总结失败', e.message);
    }
    setLoadingAi(false);
  };

  const renderCustomers = () => (
    <>
      <Section title="客户管理五视图">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
          {CUSTOMER_TABS.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.customerTab, activeCustomerTab === tab.key && styles.customerTabActive]}
              onPress={() => setActiveCustomerTab(tab.key)}
            >
              <Text style={[styles.customerTabText, activeCustomerTab === tab.key && styles.customerTabTextActive]}>{tab.label}</Text>
              <Text style={[styles.customerTabCount, activeCustomerTab === tab.key && styles.customerTabCountActive]}>
                {customerCounts[tab.key] || 0}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Text style={styles.helpText}>{tabDesc[activeCustomerTab]}</Text>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="搜索客户名称、公司或负责人"
            value={keyword}
            onChangeText={setKeyword}
            onSubmitEditing={loadCustomers}
          />
          {keyword ? (
            <TouchableOpacity onPress={() => setKeyword('')}>
              <Ionicons name="close-circle" size={18} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.bulkRow}>
          {['更新状态', '转移负责人', '退回公海', '导出列表'].map(action => (
            <TouchableOpacity key={action} style={styles.smallAction} onPress={() => openBatchAction(action)}>
              <Text style={styles.smallActionText}>{action}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Section>
      <View style={styles.listWrap}>
        {customerRows.map(item => (
          <TouchableOpacity key={item.id} style={styles.customerCard} onPress={() => setSelectedCustomer(item)}>
            <View style={styles.cardTop}>
              <Text style={styles.customerName} numberOfLines={1}>{item.name}</Text>
              <StatusBadge label={item.ownership} color={statusColor[item.ownership] || 'blue'} />
            </View>
            <Text style={styles.customerMeta} numberOfLines={1}>{item.company} · {item.mobile || '-'}</Text>
            <View style={styles.customerMid}>
              <View>
                <Text style={styles.miniLabel}>负责人</Text>
                <Text style={styles.miniValue}>{item.owner}</Text>
              </View>
              <View>
                <Text style={styles.miniLabel}>跟进状态</Text>
                <Text style={styles.miniValue}>{item.follow}</Text>
              </View>
              <View>
                <Text style={styles.miniLabel}>{activeCustomerTab === 'closed' ? '成交时间' : '保护到期'}</Text>
                <Text style={styles.miniValue}>{fmtDate(item.protectTime)}</Text>
              </View>
            </View>
            <Text style={styles.latestText} numberOfLines={2}>{item.latest}</Text>
          </TouchableOpacity>
        ))}
        {!customerRows.length ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>暂无客户数据</Text>
          </View>
        ) : null}
      </View>
    </>
  );

  const renderRisk = () => (
    <>
      <View style={styles.metricsGrid}>
        <MetricCard label="应收余额" value={currencyWan(creditSummary?.total_balance)} sub="全部授信客户" color="#dc2626" icon="wallet-outline" />
        <MetricCard label="超期应收" value={currencyWan(creditSummary?.overdue)} sub="账龄超过30天" color="#ea580c" icon="timer-outline" />
        <MetricCard label="高流失风险" value={String(churnItems.filter(i => i.risk_score >= 70).length)} sub="需销售介入" color="#7c3aed" icon="warning-outline" />
        <MetricCard label="黑名单客户" value={String(credits.filter(c => c.is_blacklisted).length)} sub="限制继续授信" color="#64748b" icon="ban-outline" />
      </View>
      <Section title="授信与账龄">
        {credits.map(item => {
          const risky = item.days_aged > 30 || item.usage_rate > 80 || item.is_blacklisted;
          return (
            <View key={item.id} style={[styles.riskCard, risky && styles.riskCardAlert]}>
              <View style={styles.cardTop}>
                <Text style={styles.customerName} numberOfLines={1}>{item.company_name}</Text>
                <StatusBadge
                  label={item.is_blacklisted ? '黑名单' : item.days_aged > 30 ? '超期' : '正常'}
                  color={item.is_blacklisted || item.days_aged > 30 ? 'red' : 'green'}
                />
              </View>
              <View style={styles.customerMid}>
                <View>
                  <Text style={styles.miniLabel}>信用评分</Text>
                  <Text style={styles.miniValue}>{item.credit_score}</Text>
                </View>
                <View>
                  <Text style={styles.miniLabel}>授信额度</Text>
                  <Text style={styles.miniValue}>{currencyWan(item.credit_limit)}</Text>
                </View>
                <View>
                  <Text style={styles.miniLabel}>欠款/账龄</Text>
                  <Text style={[styles.miniValue, item.days_aged > 30 && styles.dangerText]}>
                    {currencyWan(item.balance_due)} / {item.days_aged}天
                  </Text>
                </View>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.min(100, item.usage_rate || 0)}%`, backgroundColor: risky ? '#dc2626' : '#16a34a' }]} />
              </View>
              <Text style={styles.latestText}>{item.risk_notes || '暂无风险备注'}</Text>
            </View>
          );
        })}
      </Section>
      <Section title="AI流失预警">
        {churnItems.map(item => (
          <View key={item.customer_id} style={styles.aiRiskCard}>
            <View style={styles.cardTop}>
              <Text style={styles.customerName}>{item.company_name}</Text>
              <Text style={[styles.riskScore, item.risk_score >= 70 && styles.dangerText]}>{item.risk_score}</Text>
            </View>
            <Text style={styles.latestText}>{item.factors?.join(' · ') || '暂无异常因子'}</Text>
            <Text style={styles.aiAction}>建议：{item.action}</Text>
          </View>
        ))}
      </Section>
    </>
  );

  const renderAnalytics = () => {
    const trendData = [42, 38, 51, 59, 68];
    return (
      <>
        <View style={styles.metricsGrid}>
          <MetricCard label={cards[0]?.title || '客户总数'} value={String(cards[0]?.value || '--')} sub={cards[0]?.sub} color="#2563eb" icon="people-outline" />
          <MetricCard label={cards[1]?.title || '月运单量'} value={String(cards[1]?.value || '--')} sub={cards[1]?.sub} color="#16a34a" icon="cube-outline" />
          <MetricCard label={cards[2]?.title || '营收总额'} value={String(cards[2]?.value || '--')} color="#ea580c" icon="trending-up-outline" />
          <MetricCard label={cards[3]?.title || '应收余额'} value={String(cards[3]?.value || '--')} color="#dc2626" icon="cash-outline" />
        </View>
        <Section title="月度营收趋势">
          <LineChart
            data={{ labels: ['1月', '2月', '3月', '4月', '5月'], datasets: [{ data: trendData }] }}
            width={SCREEN_W - 48}
            height={190}
            yAxisSuffix="万"
            chartConfig={{
              backgroundColor: '#fff',
              backgroundGradientFrom: '#fff',
              backgroundGradientTo: '#fff',
              decimalCount: 0,
              color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
              labelColor: () => '#64748b',
              propsForDots: { r: '4', strokeWidth: '1' },
            }}
            bezier
            style={styles.chart}
          />
        </Section>
        <Section title="客户健康与阶段">
          <View style={styles.healthWrap}>
            {healthDistribution.map(item => (
              <View key={item.name} style={styles.healthRow}>
                <View style={[styles.healthDot, { backgroundColor: item.color }]} />
                <Text style={styles.healthName}>{item.name}</Text>
                <Text style={styles.healthValue}>{item.value}</Text>
              </View>
            ))}
          </View>
          <View style={styles.stageGrid}>
            {[
              ['开发中', stageCounts.developing],
              ['已报价', stageCounts.quoted],
              ['合作中', stageCounts.cooperating],
              ['已流失', stageCounts.churned],
            ].map(([name, value]) => (
              <View key={name} style={styles.stageBlock}>
                <Text style={styles.stageValue}>{value || 0}</Text>
                <Text style={styles.stageName}>{name}</Text>
              </View>
            ))}
          </View>
        </Section>
      </>
    );
  };

  const renderAi = () => (
    <>
      <Section
        title="ShareAI智能助手"
        action={loadingAi ? <ActivityIndicator size="small" color="#2563eb" /> : null}
      >
        <View style={styles.aiToolGrid}>
          <TouchableOpacity style={styles.aiTool} onPress={runSmartQuote}>
            <Ionicons name="calculator-outline" size={22} color="#2563eb" />
            <Text style={styles.aiToolTitle}>智能报价</Text>
            <Text style={styles.aiToolDesc}>路线、货量、品类自动核价</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.aiTool} onPress={runVoiceLog}>
            <Ionicons name="mic-outline" size={22} color="#16a34a" />
            <Text style={styles.aiToolTitle}>语音录单</Text>
            <Text style={styles.aiToolDesc}>跟进内容结构化入CRM</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.aiTool} onPress={runMeeting}>
            <Ionicons name="document-text-outline" size={22} color="#ea580c" />
            <Text style={styles.aiToolTitle}>会议总结</Text>
            <Text style={styles.aiToolDesc}>会前、会中、会后自动整理</Text>
          </TouchableOpacity>
        </View>
      </Section>
      {aiQuote && (
        <Section title="智能报价结果">
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>{aiQuote.route_type} · {aiQuote.cargo_type}</Text>
            <Text style={styles.resultPrice}>{currencyWan(aiQuote.price_breakdown?.本公司报价)}</Text>
            <Text style={styles.latestText}>竞品参考：{currencyWan(aiQuote.price_breakdown?.竞品均价)} · 节约比例 {aiQuote.price_breakdown?.节约比例}</Text>
            <Text style={styles.aiAction}>建议话术：{aiQuote.suggested_pitch}</Text>
          </View>
        </Section>
      )}
      {voiceLog && (
        <Section title="语音录单结果">
          <View style={styles.resultCard}>
            <Text style={styles.latestText}>{voiceLog.original_voice}</Text>
            <Text style={styles.resultTitle}>{voiceLog.structured_log}</Text>
            <Text style={styles.aiAction}>标签：{voiceLog.auto_tags?.join('、')} · 评分 {voiceLog.quality_check?.评分}</Text>
          </View>
        </Section>
      )}
      {meeting && (
        <Section title="会议总结结果">
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>会前简报</Text>
            <Text style={styles.latestText}>{meeting.pre_meeting?.brief}</Text>
            <Text style={styles.resultTitle}>行动项</Text>
            {(meeting.post_meeting?.action_items || []).map((item, index) => (
              <Text key={index} style={styles.bulletText}>• {item}</Text>
            ))}
            <Text style={styles.aiAction}>{meeting.auto_fill_crm}</Text>
          </View>
        </Section>
      )}
    </>
  );

  const renderCurrentModule = () => {
    if (activeModule === 'risk') return renderRisk();
    if (activeModule === 'analytics') return renderAnalytics();
    if (activeModule === 'ai') return renderAi();
    return renderCustomers();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>管理工作台</Text>
          <Text style={styles.subtitle}>补充管理端客户、风控、分析与AI能力</Text>
        </View>
        <TouchableOpacity style={styles.headerIcon} onPress={onRefresh}>
          <Ionicons name="refresh" size={20} color="#2563eb" />
        </TouchableOpacity>
      </View>
      <ScrollView
        style={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moduleRow}>
          {MODULES.map(item => (
            <TouchableOpacity
              key={item.key}
              style={[styles.moduleChip, activeModule === item.key && styles.moduleChipActive]}
              onPress={() => setActiveModule(item.key)}
            >
              <Ionicons name={item.icon} size={17} color={activeModule === item.key ? '#fff' : '#64748b'} />
              <Text style={[styles.moduleText, activeModule === item.key && styles.moduleTextActive]}>{item.title}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {renderCurrentModule()}
        <View style={{ height: 28 }} />
      </ScrollView>
      <Modal visible={!!selectedCustomer} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.cardTop}>
              <Text style={styles.modalTitle}>{selectedCustomer?.name}</Text>
              <TouchableOpacity onPress={() => setSelectedCustomer(null)}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>
            <Text style={styles.latestText}>{selectedCustomer?.company}</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalPrimary}
                onPress={() => {
                  const id = selectedCustomer?.id;
                  setSelectedCustomer(null);
                  if (id) navigation.navigate('LeadCustomers', {
                    screen: 'CustomerDetail',
                    params: { customerId: id },
                  });
                }}
              >
                <Text style={styles.modalPrimaryText}>查看客户详情</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalGhost} onPress={() => openBatchAction('转移负责人')}>
                <Text style={styles.modalGhostText}>转移负责人</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  subtitle: { fontSize: 12, color: '#64748b', marginTop: 3 },
  headerIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eff6ff' },
  body: { flex: 1 },
  moduleRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  moduleChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 13, paddingVertical: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  moduleChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  moduleText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  moduleTextActive: { color: '#fff' },
  section: { marginHorizontal: 16, marginTop: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10, gap: 8, marginTop: 2 },
  metricCard: { width: (SCREEN_W - 40) / 2, backgroundColor: '#fff', borderRadius: 12, padding: 13, borderWidth: 1, borderColor: '#eef2f7' },
  metricIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
  metricLabel: { fontSize: 12, color: '#64748b' },
  metricValue: { fontSize: 23, fontWeight: '800', marginTop: 3 },
  metricSub: { fontSize: 11, color: '#94a3b8', marginTop: 3 },
  tabRow: { gap: 8, paddingBottom: 8 },
  customerTab: { minWidth: 92, alignItems: 'center', borderRadius: 10, backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  customerTabActive: { backgroundColor: '#eff6ff', borderColor: '#93c5fd' },
  customerTabText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  customerTabTextActive: { color: '#2563eb' },
  customerTabCount: { fontSize: 16, color: '#94a3b8', fontWeight: '800', marginTop: 2 },
  customerTabCountActive: { color: '#2563eb' },
  helpText: { fontSize: 12, color: '#64748b', lineHeight: 18, marginBottom: 8 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  searchInput: { flex: 1, fontSize: 14, marginLeft: 8, color: '#334155' },
  bulkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  smallAction: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  smallActionText: { color: '#2563eb', fontSize: 12, fontWeight: '600' },
  listWrap: { marginTop: 2 },
  customerCard: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 8, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#eef2f7' },
  riskCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#eef2f7' },
  riskCardAlert: { borderLeftWidth: 4, borderLeftColor: '#dc2626' },
  aiRiskCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#f1f5f9' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
  customerName: { flex: 1, fontSize: 15, fontWeight: '700', color: '#0f172a' },
  customerMeta: { fontSize: 12, color: '#64748b', marginBottom: 10 },
  customerMid: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginVertical: 8 },
  miniLabel: { fontSize: 11, color: '#94a3b8', marginBottom: 3 },
  miniValue: { fontSize: 13, color: '#334155', fontWeight: '700' },
  latestText: { fontSize: 12, color: '#64748b', lineHeight: 18 },
  dangerText: { color: '#dc2626' },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: '#e2e8f0', overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', borderRadius: 3 },
  riskScore: { fontSize: 24, color: '#ea580c', fontWeight: '800' },
  aiAction: { fontSize: 12, color: '#2563eb', fontWeight: '600', marginTop: 8, lineHeight: 18 },
  chart: { borderRadius: 12, marginLeft: -8 },
  healthWrap: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 10 },
  healthRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  healthDot: { width: 9, height: 9, borderRadius: 5, marginRight: 8 },
  healthName: { flex: 1, color: '#475569', fontSize: 13 },
  healthValue: { color: '#0f172a', fontWeight: '800', fontSize: 15 },
  stageGrid: { flexDirection: 'row', gap: 8 },
  stageBlock: { flex: 1, backgroundColor: '#fff', borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#eef2f7' },
  stageValue: { fontSize: 20, color: '#0f172a', fontWeight: '800' },
  stageName: { fontSize: 11, color: '#64748b', marginTop: 3 },
  aiToolGrid: { flexDirection: 'row', gap: 8 },
  aiTool: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#eef2f7' },
  aiToolTitle: { fontSize: 13, color: '#0f172a', fontWeight: '700', marginTop: 8 },
  aiToolDesc: { fontSize: 11, color: '#64748b', lineHeight: 16, marginTop: 3 },
  resultCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#eef2f7' },
  resultTitle: { fontSize: 14, color: '#0f172a', fontWeight: '700', marginBottom: 6 },
  resultPrice: { fontSize: 26, color: '#2563eb', fontWeight: '800', marginBottom: 4 },
  bulletText: { fontSize: 12, color: '#475569', lineHeight: 19 },
  emptyBox: { marginHorizontal: 16, marginTop: 8, borderRadius: 12, padding: 28, alignItems: 'center', backgroundColor: '#fff' },
  emptyText: { color: '#94a3b8', fontSize: 13 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 16, padding: 18 },
  modalTitle: { flex: 1, fontSize: 17, color: '#0f172a', fontWeight: '800' },
  modalActions: { marginTop: 16, gap: 10 },
  modalPrimary: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  modalGhost: { backgroundColor: '#eff6ff', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalGhostText: { color: '#2563eb', fontSize: 14, fontWeight: '700' },
});
