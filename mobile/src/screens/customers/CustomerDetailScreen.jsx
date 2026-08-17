import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  ActivityIndicator, Alert, Dimensions, Modal, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import * as ImagePicker from 'expo-image-picker';
import client, { resolveBackendUrl } from '../../api/client';
import StatusBadge from '../../components/StatusBadge';

const SCREEN_W = Dimensions.get('window').width;

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
  const [followImages, setFollowImages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [aiInsight, setAiInsight] = useState(null);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [meetingSummary, setMeetingSummary] = useState(null);
  const [activities, setActivities] = useState([]);

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
        setActivities(custRes.activities || []);
      }
      if (trendRes.ok) setTrend(trendRes.trend || []);
    } catch {}
    setLoading(false);
  }, [customerId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resolveImageUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return resolveBackendUrl(url);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets) {
      setFollowImages(prev => [...prev, ...result.assets]);
    }
  };

  const removeImage = (index) => {
    setFollowImages(prev => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async () => {
    const urls = [];
    for (const img of followImages) {
      if (img.uri && !img.uri.startsWith('http')) {
        try {
          const formData = new FormData();
          const filename = img.uri.split('/').pop() || 'photo.jpg';
          if (img.uri.startsWith('blob:')) {
            const blob = await (await fetch(img.uri)).blob();
            formData.append('file', blob, filename);
          } else {
            formData.append('file', { uri: img.uri, name: filename, type: 'image/jpeg' });
          }
          const uploadRes = await fetch(`${client.defaults.baseURL}/api/upload/follow-up-image`, {
            method: 'POST',
            body: formData,
          });
          const uploadData = await uploadRes.json();
          if (uploadData.ok) urls.push(uploadData.url);
        } catch {}
      }
    }
    return urls;
  };

  const handleFollow = async () => {
    if (!followContent.trim()) { Alert.alert('提示', '请输入内容'); return; }
    setSaving(true);
    try {
      const imageUrls = await uploadImages();
      const res = await client.post(`/api/customer/${customerId}/add-activity?activity_type=${followType}&content=${encodeURIComponent(followContent)}&image_urls=${encodeURIComponent(JSON.stringify(imageUrls))}&created_by=张晓明`);
      if (res.ok) { Alert.alert('成功', res.msg); setShowFollow(false); setFollowContent(''); setFollowImages([]); fetchData(); }
    } catch (e) { Alert.alert('错误', e.message); }
    setSaving(false);
  };

  const handleAIInsight = async () => {
    try {
      const res = await client.get('/api/ai/customer_insight', { params: { customer_id: customerId } });
      if (res.ok) setAiInsight(res);
    } catch {}
  };

  const handleVoiceStructure = async () => {
    setAiProcessing(true);
    try {
      const res = await client.get('/api/ai/voice_log', {
        params: { customer_name: cust?.company_name, content: followContent || '电话沟通确认客户需求' },
      });
      if (res.ok) {
        setFollowContent(res.structured_log || followContent);
        Alert.alert('AI整理完成', `已生成结构化跟进内容，质量评分：${res.quality_check?.评分 || '完成'}`);
      }
    } catch (e) {
      Alert.alert('AI整理失败', e.message);
    } finally {
      setAiProcessing(false);
    }
  };

  const handleMeetingSummary = async () => {
    setAiProcessing(true);
    try {
      const res = await client.get('/api/ai/meeting_summary', { params: { meeting_type: '客户拜访' } });
      if (res.ok) {
        setMeetingSummary(res);
        setFollowType('meeting');
        setFollowContent([
          ...(res.post_meeting?.key_topics || []),
          ...(res.post_meeting?.action_items || []).map(item => `行动项：${item}`),
        ].join('\n'));
      }
    } catch (e) {
      Alert.alert('会议总结失败', e.message);
    } finally {
      setAiProcessing(false);
    }
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
        {/* Header card */}
        <View style={styles.topCard}>
          <View style={styles.topRow}>
            <Text style={styles.company} numberOfLines={1}>{cust.company_name}</Text>
            <StatusBadge label={cust.customer_level} color="green" size="lg" />
          </View>
          <View style={styles.tags}>
            <StatusBadge label={cust.lifecycle_label || cust.lifecycle_status} color="blue" />
            <StatusBadge label={cust.customer_type || '直客'} color={cust.customer_type === '同行' ? 'orange' : 'green'} />
            {cust.order_frequency_tag ? <StatusBadge label={cust.order_frequency_tag} color="purple" /> : null}
          </View>
        </View>

        {/* KYC detail card */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>客户画像</Text>
          <View style={styles.kycCard}>
            <View style={styles.kycRow}>
              <View style={styles.kycItem}>
                <Text style={styles.kycLabel}>客户类型</Text>
                <Text style={styles.kycVal}>{cust.customer_type || '直客'}</Text>
              </View>
              <View style={styles.kycItem}>
                <Text style={styles.kycLabel}>主要市场</Text>
                <Text style={styles.kycVal}>{cust.main_market || '-'}</Text>
              </View>
            </View>
            <View style={styles.kycRow}>
              <View style={styles.kycItem}>
                <Text style={styles.kycLabel}>主营类目</Text>
                <Text style={styles.kycVal}>{cust.main_category || '-'}</Text>
              </View>
              <View style={styles.kycItem}>
                <Text style={styles.kycLabel}>偏好品名</Text>
                <Text style={styles.kycVal}>{cust.cargo_preferences || '-'}</Text>
              </View>
            </View>
            <View style={styles.kycRow}>
              <View style={styles.kycItem}>
                <Text style={styles.kycLabel}>发货频率</Text>
                <Text style={styles.kycVal}>{cust.shipping_frequency || '-'}</Text>
              </View>
              <View style={styles.kycItem}>
                <Text style={styles.kycLabel}>常用路线</Text>
                <Text style={styles.kycVal}>{cust.usual_routes || '-'}</Text>
              </View>
            </View>
            <View style={styles.kycRow}>
              <View style={styles.kycItem}>
                <Text style={styles.kycLabel}>出口资质</Text>
                <Text style={styles.kycVal}>{cust.export_qualification || '-'}</Text>
              </View>
              <View style={styles.kycItem}>
                <Text style={styles.kycLabel}>合作起始</Text>
                <Text style={styles.kycVal}>{cust.cooperation_since || '-'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Metrics */}
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

        {/* Contact info */}
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
                  <Text style={styles.oppAmount}>{(o.amount / 10000).toFixed(1)}万</Text>
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

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>跟进记录 ({activities.length})</Text>
            <TouchableOpacity style={styles.addFollowBtn} onPress={() => setShowFollow(true)}>
              <Ionicons name="add-circle-outline" size={22} color="#2563eb" />
            </TouchableOpacity>
          </View>
          {activities.length > 0 ? activities.map((a, i) => {
            const isSystem = a.activity_type === 'status_change';
            return (
              <View key={a.id || i} style={styles.followCard}>
                <View style={styles.timelineRow}>
                  <View style={[styles.timelineDot, isSystem && { backgroundColor: '#94a3b8' }]} />
                  <View style={styles.timelineLine} />
                </View>
                <View style={styles.followBody}>
                  <View style={styles.followHeader}>
                    <View style={styles.followMeta}>
                      {isSystem && <Text style={styles.systemTag}>系统事件</Text>}
                      <Text style={styles.followBy}>{a.created_by}</Text>
                    </View>
                    <Text style={styles.followTime}>{a.created_at?.slice(0, 16)}</Text>
                  </View>
                  <Text style={styles.followContent}>{a.content}</Text>
                {a.image_urls ? (
                  <View style={styles.followImages}>
                    {(function() {
                      try {
                        const urls = JSON.parse(a.image_urls);
                        return urls.map((url, idx) => (
                          <TouchableOpacity key={idx} onPress={() => setPreviewImage(resolveImageUrl(url))}>
                            <Image source={{ uri: resolveImageUrl(url) }} style={styles.followThumb} />
                          </TouchableOpacity>
                        ));
                      } catch(e) { return null; }
                    })()}
                  </View>
                ) : null}
                </View>
              </View>
            );}) : null}
          </View>

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

      {/* FAB - opens centered modal */}
      <TouchableOpacity style={styles.fab} onPress={() => { setFollowType('call'); setFollowContent(''); setFollowImages([]); setShowFollow(true); }}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Follow-up Modal — centered card */}
      <Modal visible={showFollow} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.followModal}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowFollow(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>添加跟进</Text>
              <View style={{ width: 24 }} />
            </View>
            <ScrollView style={{ maxHeight: '100%' }} showsVerticalScrollIndicator={false}>
              <Text style={styles.followLabel}>跟进方式</Text>
              <View style={styles.followTypeRow}>
                {['call', 'meeting', 'email', 'visit'].map(t => (
                  <TouchableOpacity key={t} style={[styles.typeChip, followType === t && styles.typeChipActive]} onPress={() => setFollowType(t)}>
                    <Text style={[styles.typeText, followType === t && styles.typeTextActive]}>
                      {{ call: '📞 电话', meeting: '🤝 会议', email: '📧 邮件', visit: '🏢 拜访' }[t]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.followLabel}>跟进内容</Text>
              <TextInput style={styles.followInput} placeholder="输入跟进内容..." value={followContent} onChangeText={setFollowContent} multiline autoFocus />
              <View style={styles.aiFollowTools}>
                <TouchableOpacity style={styles.aiFollowTool} onPress={handleVoiceStructure} disabled={aiProcessing}>
                  <Ionicons name="mic-outline" size={17} color="#2563eb" />
                  <Text style={styles.aiFollowToolText}>AI整理跟进</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.aiFollowTool} onPress={handleMeetingSummary} disabled={aiProcessing}>
                  <Ionicons name="document-text-outline" size={17} color="#ea580c" />
                  <Text style={[styles.aiFollowToolText, { color: '#ea580c' }]}>生成会议纪要</Text>
                </TouchableOpacity>
              </View>
              {meetingSummary && (
                <View style={styles.meetingBrief}>
                  <Text style={styles.meetingBriefTitle}>会前简报</Text>
                  <Text style={styles.meetingBriefText}>{meetingSummary.pre_meeting?.brief}</Text>
                  {meetingSummary.post_meeting?.risk_flag ? <Text style={styles.meetingRisk}>风险：{meetingSummary.post_meeting.risk_flag}</Text> : null}
                </View>
              )}
              <Text style={styles.followLabel}>图片附件（可选）</Text>
              <View style={styles.imageGrid}>
                {followImages.map((img, idx) => (
                  <View key={idx} style={styles.imageWrapper}>
                    <Image source={{ uri: img.uri }} style={styles.thumb} />
                    <TouchableOpacity style={styles.removeImgBtn} onPress={() => removeImage(idx)}>
                      <Ionicons name="close-circle" size={20} color="#dc2626" />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.addImgBtn} onPress={pickImage}>
                  <Ionicons name="images-outline" size={28} color="#94a3b8" />
                  <Text style={styles.addImgText}>添加图片</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={[styles.followBtn, saving && { opacity: 0.5 }]} onPress={handleFollow} disabled={saving}>
                <Text style={styles.followBtnText}>{saving ? '保存中...' : '保存跟进记录'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Image fullscreen preview */}
      <Modal visible={!!previewImage} transparent animationType="fade">
        <View style={styles.previewOverlay}>
          <TouchableOpacity style={styles.previewCloseBtn} onPress={() => setPreviewImage(null)}>
            <Ionicons name="close-circle" size={36} color="#fff" />
          </TouchableOpacity>
          {previewImage ? (
            <Image source={{ uri: previewImage }} style={styles.previewImage} resizeMode="contain" />
          ) : null}
        </View>
      </Modal>
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
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  addFollowBtn: { padding: 4 },

  // KYC card
  kycCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14 },
  kycRow: { flexDirection: 'row', marginBottom: 2 },
  kycItem: { flex: 1, paddingVertical: 10, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  kycLabel: { fontSize: 11, color: '#94a3b8', marginBottom: 4 },
  kycVal: { fontSize: 14, color: '#334155', fontWeight: '500' },

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
  // Modal — centered card
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  followModal: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 500, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a', flex: 1, textAlign: 'center' },
  followLabel: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8, marginTop: 8 },
  followTypeRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  typeChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f1f5f9' },
  typeChipActive: { backgroundColor: '#2563eb' },
  typeText: { fontSize: 13, color: '#64748b' },
  typeTextActive: { color: '#fff' },
  followInput: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 12, fontSize: 14, minHeight: 60, borderWidth: 1, borderColor: '#e2e8f0', textAlignVertical: 'top' },
  aiFollowTools: { flexDirection: 'row', gap: 8, marginTop: 9 },
  aiFollowTool: { flex: 1, minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#eff6ff', borderRadius: 8 },
  aiFollowToolText: { fontSize: 12, fontWeight: '600', color: '#2563eb' },
  meetingBrief: { backgroundColor: '#fff7ed', borderRadius: 8, padding: 10, marginTop: 9 },
  meetingBriefTitle: { fontSize: 12, fontWeight: '700', color: '#9a3412' },
  meetingBriefText: { fontSize: 11, lineHeight: 17, color: '#475569', marginTop: 4 },
  meetingRisk: { fontSize: 11, lineHeight: 17, color: '#dc2626', marginTop: 4 },
  // Image picker
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  imageWrapper: { position: 'relative' },
  thumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: '#f1f5f9' },
  removeImgBtn: { position: 'absolute', top: -6, right: -6 },
  addImgBtn: { width: 72, height: 72, borderRadius: 8, borderWidth: 1.5, borderColor: '#e2e8f0', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  addImgText: { fontSize: 10, color: '#94a3b8', marginTop: 2 },
  followBtn: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  followBtnText: { color: '#fff', fontWeight: '600' },

  // Follow-up history — timeline
  followCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 10, paddingVertical: 10, paddingRight: 12, marginBottom: 8 },
  timelineRow: { width: 30, alignItems: 'center', paddingTop: 4 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2563eb', zIndex: 1 },
  timelineLine: { flex: 1, width: 2, backgroundColor: '#e2e8f0', marginTop: -2 },
  followBody: { flex: 1 },
  followMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  systemTag: { fontSize: 10, fontWeight: '600', color: '#94a3b8', backgroundColor: '#f1f5f9', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, overflow: 'hidden' },
  followImages: { flexDirection: 'row', gap: 6, marginTop: 6 },
  followThumb: { width: 64, height: 64, borderRadius: 6, backgroundColor: '#f1f5f9' },
  followHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  followBy: { fontSize: 13, fontWeight: '600', color: '#2563eb' },
  followTime: { fontSize: 11, color: '#94a3b8' },
  followContent: { fontSize: 14, color: '#334155', lineHeight: 20 },
  // Full image preview
  previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  previewCloseBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
  previewImage: { width: '100%', height: '80%' },
});
