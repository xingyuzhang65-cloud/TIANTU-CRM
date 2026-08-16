import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet,
  RefreshControl, Modal, Alert, Image, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import client from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';

const STAGE_OPTIONS = [
  { key: 'developing', label: '开发中' },
  { key: 'quoted', label: '已报价' },
  { key: 'cooperating', label: '合作中' },
  { key: 'churned', label: '已流失' },
];

// PRD V2.1: 每阶段二级子Tab筛选
const SUB_TABS = {
  developing: [
    { key: 'all', label: '全部' },
    { key: 'due_today', label: '今日待跟进' },
    { key: 'new_unreached', label: '新分配/未触达' },
    { key: 'long_idle', label: '长期未跟进' },
  ],
  quoted: [
    { key: 'all', label: '全部' },
    { key: 'negotiating', label: '报价谈判中' },
    { key: 'high_win', label: '高赢率商机' },
  ],
  cooperating: [
    { key: 'all', label: '全部' },
    { key: 'active', label: '活跃走货' },
    { key: 'declining', label: '货量下滑预警' },
    { key: 'credit_risk', label: '信用与账期异常' },
  ],
  churned: [
    { key: 'all', label: '全部' },
    { key: 'in_protection', label: '待复盘流失' },
    { key: 'pool', label: '公海流失池' },
    { key: 'blacklist', label: '恶意/坏账黑名单' },
  ],
};

const STAGE_TO_LEAD_STATUS = {
  developing: 'lead',
  quoted: 'negotiating',
  cooperating: 'active',
  churned: 'disqualified',
};

const STAGE_TO_CUST_STATUS = {
  developing: 'new',
  quoted: 'negotiating',
  cooperating: 'active',
  churned: 'disqualified',
};

const STAGE_COLORS = {
  developing: '#2563eb',
  quoted: '#ea580c',
  cooperating: '#16a34a',
  churned: '#dc2626',
};

const FOLLOW_TYPES = [
  { key: 'call', label: '📞 电话' },
  { key: 'meeting', label: '🤝 会议' },
  { key: 'email', label: '📧 邮件' },
  { key: 'visit', label: '🏢 拜访' },
];

export default function LeadCustomerHomeScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [activeStage, setActiveStage] = useState('developing');
  const [activeSubTab, setActiveSubTab] = useState('all');
  const [stageCounts, setStageCounts] = useState({});
  const [reminders, setReminders] = useState([]);

  // Quick follow-up modal
  const [followVisible, setFollowVisible] = useState(false);
  const [followTarget, setFollowTarget] = useState(null);
  const [followType, setFollowType] = useState('call');
  const [followContent, setFollowContent] = useState('');
  const [followImages, setFollowImages] = useState([]);
  const [saving, setSaving] = useState(false);

  // Stage edit modal
  const [stageVisible, setStageVisible] = useState(false);
  const [stageTarget, setStageTarget] = useState(null);
  const [stageSaving, setStageSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const params = { stage: activeStage };
      if (activeSubTab !== 'all') params.sub_tab = activeSubTab;
      if (keyword.trim()) params.keyword = keyword.trim();

      const [leadsRes, custRes, summaryRes, remindersRes] = await Promise.all([
        client.get('/api/leads/list', { params: activeStage === 'developing' ? { keyword: keyword.trim() || undefined, pool: 'all' } : {} }),
        client.get('/api/customers/list', { params }),
        client.get('/api/analytics/summary'),
        client.get('/api/reminders/list'),
      ]);

      // Stage counts from analytics
      if (summaryRes.ok && summaryRes.stage_counts) {
        setStageCounts(summaryRes.stage_counts);
      }
      if (remindersRes.ok) {
        setReminders(remindersRes.reminders || []);
      }

      // Lead-level items (only for 开发中 stage)
      let leadItems = [];
      if (activeStage === 'developing') {
        leadItems = (leadsRes.ok ? leadsRes.leads || [] : []).map(l => ({
          id: `lead-${l.id}`,
          _type: 'lead',
          _leadId: l.id,
          company_name: l.company_name,
          contact_name: l.contact_name,
          contact_phone: l.contact_mobile,
          lifecycle_status: 'lead',
          lifecycle_label: '待跟进',
          lead_status: l.lead_status,
          target_market: l.target_market,
          logistics_type: l.logistics_type,
          follow_count: l.follow_count,
          owner: l.owner || '未分配',
          created_at: l.created_at,
          latest_follow: l.latest_follow,
        }));
      }

      // Customer items (with enriched fields per PRD)
      const custItems = (custRes.ok ? custRes.customers || [] : []).map(c => ({
        id: `cust-${c.id}`,
        _type: 'customer',
        _custId: c.id,
        company_name: c.company_name,
        contact_name: c.contact_name,
        contact_phone: c.phone,
        country: c.country,
        customer_type: c.customer_type || '直客',
        lifecycle_status: c.lifecycle_status,
        lifecycle_label: c.lifecycle_label || c.lifecycle_status,
        customer_level: c.customer_level,
        main_category: c.main_category,
        shipping_frequency: c.shipping_frequency,
        usual_routes: c.usual_routes,
        avg_monthly_revenue: c.avg_monthly_revenue,
        avg_monthly_volume: c.avg_monthly_volume,
        volume_mom: c.volume_mom,
        monthly_order_count: c.monthly_order_count,
        order_frequency_tag: c.order_frequency_tag,
        cooperation_since: c.cooperation_since,
        owner: c.owner || '',
        created_at: c.created_at,
        latest_follow: c.latest_follow,
        latest_order: c.latest_order,
        credit: c.credit,
        loss_reason: c.loss_reason,
        total_historical_revenue: c.total_historical_revenue,
        days_inactive: c.days_inactive,
      }));

      setItems([...leadItems, ...custItems]);
    } catch {}
  }, [keyword, activeStage, activeSubTab]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const onRefresh = async () => { setRefreshing(true); await fetchAll(); setRefreshing(false); };

  const switchStage = (stageKey) => {
    setActiveStage(stageKey);
    setActiveSubTab('all');
  };

  const FOLLOW_TYPE_ICONS = {
    call: '📞', meeting: '🤝', email: '📧', visit: '🏢',
    follow: '📝',
  };

  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return '';
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMin = Math.floor((now - then) / 60000);
    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin}分钟前`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}小时前`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 30) return `${diffDay}天前`;
    const diffMonth = Math.floor(diffDay / 30);
    return `${diffMonth}个月前`;
  };

  const getMomColor = (mom) => {
    if (mom == null) return '#94a3b8';
    if (mom > 5) return '#16a34a';
    if (mom < -20) return '#dc2626';
    if (mom < 0) return '#f59e0b';
    return '#94a3b8';
  };

  const getStageKey = (item) => {
    if (item._type === 'lead') return 'developing';
    if (item.lifecycle_status === 'negotiating') return 'quoted';
    if (item.lifecycle_status === 'active') return 'cooperating';
    if (item.lifecycle_status === 'disqualified') return 'churned';
    return 'developing';
  };

  const openFollow = (item) => {
    setFollowTarget(item);
    setFollowType('call');
    setFollowContent('');
    setFollowImages([]);
    setFollowVisible(true);
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
          // Handle both web blob URIs and native file URIs
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
    if (!followContent.trim()) { Alert.alert('提示', '请输入跟进内容'); return; }
    setSaving(true);
    try {
      const imageUrls = await uploadImages();
      const imageUrlsJson = JSON.stringify(imageUrls);

      if (followTarget._type === 'lead') {
        const res = await client.post(`/api/leads/${followTarget._leadId}/follow-up`, {
          status: followType === 'call' ? '初步沟通' : followType === 'visit' ? '意向强烈' : '初步沟通',
          content: followContent,
          image_urls: imageUrlsJson,
          created_by: '张晓明',
        });
        if (res.ok) Alert.alert('成功', res.msg);
      } else {
        const res = await client.post(
          `/api/customer/${followTarget._custId}/add-activity?activity_type=${followType}&content=${encodeURIComponent(followContent)}&image_urls=${encodeURIComponent(imageUrlsJson)}&created_by=张晓明`
        );
        if (res.ok) Alert.alert('成功', res.msg);
      }
      setFollowVisible(false);
      setFollowContent('');
      setFollowImages([]);
    } catch (e) { Alert.alert('错误', e.message); }
    setSaving(false);
  };

  const handleStageChange = async (stageKey) => {
    if (!stageTarget) return;
    setStageSaving(true);
    try {
      if (stageTarget._type === 'lead') {
        const status = STAGE_TO_LEAD_STATUS[stageKey];
        const res = await client.put(`/api/leads/${stageTarget._leadId}/stage?stage=${status}`);
        if (res.ok) Alert.alert('成功', res.msg);
      } else {
        const status = STAGE_TO_CUST_STATUS[stageKey];
        const res = await client.put(`/api/customer/${stageTarget._custId}/stage?stage=${status}`);
        if (res.ok) Alert.alert('成功', res.msg);
      }
      setStageVisible(false);
      setStageTarget(null);
      fetchAll();
    } catch (e) { Alert.alert('错误', e.message); }
    setStageSaving(false);
  };

  // ── 获取某客户/线索的待处理提醒 ──
  const getItemReminders = (item) => {
    return reminders.filter(r => {
      if (item._type === 'lead') return r.lead_id === item._leadId && !r.is_completed && !r.is_snoozed;
      return r.customer_id === item._custId && !r.is_completed && !r.is_snoozed;
    });
  };

  const snoozeReminder = async (remId, hours) => {
    await client.put(`/api/reminders/${remId}/snooze?delay_hours=${hours}`);
    setReminders(prev => prev.map(r => r.id === remId ? { ...r, is_snoozed: true } : r));
  };

  // ── Render card per-stage per PRD ──
  const renderItem = ({ item }) => {
    const isLead = item._type === 'lead';
    const stageColor = STAGE_COLORS[activeStage] || '#94a3b8';
    const navTarget = isLead
      ? () => navigation.navigate('LeadDetail', { leadId: item._leadId })
      : () => navigation.navigate('CustomerDetail', { customerId: item._custId });

    if (activeStage === 'developing') {
      // ── PRD: 开发中卡片 ──
      return (
        <TouchableOpacity style={styles.card} onPress={navTarget}>
          <View style={styles.cardTop}>
            <Text style={styles.company}>{item.company_name}</Text>
            <TouchableOpacity
              style={[styles.stageBadge, { backgroundColor: stageColor }]}
              onPress={(e) => { e.stopPropagation && e.stopPropagation(); setStageTarget(item); setStageVisible(true); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.stageBadgeText}>{isLead ? '待跟进' : item.lifecycle_label}</Text>
              <Ionicons name="caret-down" size={10} color="#fff" style={{ marginLeft: 3 }} />
            </TouchableOpacity>
          </View>
          <Text style={styles.devInfo}>{item.contact_name || '未知'} · {item.contact_phone || '-'} · {item.country || '中国'}</Text>
          <View style={styles.tags}>
            {item.target_market ? <StatusBadge label={item.target_market} color="purple" /> : null}
            {item.logistics_type ? <View style={{ width: 6 }} /> : null}
            {item.logistics_type ? <StatusBadge label={item.logistics_type} color="orange" /> : null}
          </View>
          {item.latest_follow && (
            <View style={styles.latestFollow}>
              <Text style={styles.latestFollowIcon}>📝</Text>
              <Text style={styles.latestFollowText} numberOfLines={1}>{item.latest_follow.content}</Text>
              <Text style={styles.latestFollowTime}>{formatRelativeTime(item.latest_follow.created_at)}</Text>
            </View>
          )}
          <View style={styles.cardActions}>
            <TouchableOpacity style={styles.actionBtn} onPress={(e) => { e.stopPropagation && e.stopPropagation(); openFollow(item); }}>
              <Ionicons name="create-outline" size={14} color="#2563eb" />
              <Text style={styles.actionBtnText}>录入跟进</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtnSecondary} onPress={(e) => { e.stopPropagation && e.stopPropagation(); /* TODO: 发起报价 */ }}>
              <Ionicons name="document-text-outline" size={14} color="#ea580c" />
              <Text style={[styles.actionBtnText, { color: '#ea580c' }]}>发起询价报价</Text>
            </TouchableOpacity>
          </View>
          {/* ── 跟进提醒预警条 (PRD V1.1) ── */}
          {getItemReminders(item).map(r => (
            <View key={r.id} style={styles.reminderBar}>
              <Ionicons name="alarm-outline" size={13} color="#dc2626" />
              <Text style={styles.reminderText} numberOfLines={2}>{r.content}</Text>
              <View style={styles.reminderActions}>
                <TouchableOpacity onPress={(e) => { e.stopPropagation(); snoozeReminder(r.id, 2); }}>
                  <Text style={styles.reminderSnooze}>延期提醒</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={(e) => { e.stopPropagation(); openFollow(item); }}>
                  <Text style={styles.reminderAction}>去写跟进</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </TouchableOpacity>
      );
    }

    if (activeStage === 'quoted') {
      // ── PRD: 已报价卡片 ──
      return (
        <TouchableOpacity style={styles.card} onPress={navTarget}>
          <View style={styles.cardTop}>
            <Text style={styles.company}>{item.company_name}</Text>
            <TouchableOpacity
              style={[styles.stageBadge, { backgroundColor: stageColor }]}
              onPress={(e) => { e.stopPropagation && e.stopPropagation(); setStageTarget(item); setStageVisible(true); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.stageBadgeText}>{item.lifecycle_label}</Text>
              <Ionicons name="caret-down" size={10} color="#fff" style={{ marginLeft: 3 }} />
            </TouchableOpacity>
          </View>
          <Text style={styles.devInfo}>联系人: {item.contact_name || '-'} · {item.contact_phone || '-'}</Text>
          {item.usual_routes ? <Text style={styles.routeInfo}>🚢 {item.usual_routes}</Text> : null}
          <View style={styles.tags}>
            <StatusBadge label={item.customer_type || '直客'} color="blue" />
            {item.main_category ? <><View style={{ width: 4 }} /><StatusBadge label={item.main_category} color="purple" /></> : null}
          </View>
          {item.latest_follow && (
            <View style={styles.latestFollow}>
              <Text style={styles.latestFollowIcon}>💬</Text>
              <Text style={styles.latestFollowText} numberOfLines={1}>{item.latest_follow.content}</Text>
              <Text style={styles.latestFollowTime}>{formatRelativeTime(item.latest_follow.created_at)}</Text>
            </View>
          )}
          <View style={styles.cardActions}>
            <TouchableOpacity style={styles.actionBtn} onPress={(e) => { e.stopPropagation && e.stopPropagation(); openFollow(item); }}>
              <Ionicons name="create-outline" size={14} color="#2563eb" />
              <Text style={styles.actionBtnText}>录入跟进</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtnSecondary} onPress={(e) => { e.stopPropagation && e.stopPropagation(); /* TODO: 修改报价 */ }}>
              <Ionicons name="pricetag-outline" size={14} color="#ea580c" />
              <Text style={[styles.actionBtnText, { color: '#ea580c' }]}>修改报价</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtnSecondary, { backgroundColor: '#f0fdf4' }]} onPress={(e) => { e.stopPropagation && e.stopPropagation(); }}>
              <Ionicons name="checkmark-circle-outline" size={14} color="#16a34a" />
              <Text style={[styles.actionBtnText, { color: '#16a34a' }]}>转为合作</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      );
    }

    if (activeStage === 'cooperating') {
      // ── PRD: 合作中卡片 ──
      const momColor = getMomColor(item.volume_mom);
      return (
        <TouchableOpacity style={styles.card} onPress={navTarget}>
          <View style={styles.cardTop}>
            <Text style={styles.company}>{item.company_name}</Text>
            <TouchableOpacity
              style={[styles.stageBadge, { backgroundColor: stageColor }]}
              onPress={(e) => { e.stopPropagation && e.stopPropagation(); setStageTarget(item); setStageVisible(true); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.stageBadgeText}>{item.lifecycle_label}</Text>
              <Ionicons name="caret-down" size={10} color="#fff" style={{ marginLeft: 3 }} />
            </TouchableOpacity>
          </View>
          <View style={styles.tags}>
            <StatusBadge label={item.customer_type || '直客'} color={item.customer_type === '同行' ? 'orange' : 'green'} />
            <View style={{ width: 4 }} />
            <StatusBadge label={item.customer_level || 'C'} color={item.customer_level === 'A' ? 'green' : item.customer_level === 'B' ? 'blue' : 'yellow'} />
            {item.order_frequency_tag && item.order_frequency_tag !== 'Inactive' ? <><View style={{ width: 4 }} /><StatusBadge label={item.order_frequency_tag} color="purple" /></> : null}
          </View>
          <View style={styles.metrics}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>月均营收</Text>
              <Text style={styles.metricVal}>{(item.avg_monthly_revenue / 10000).toFixed(1)}万</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>货量环比</Text>
              <Text style={[styles.metricVal, { color: momColor }]}>{item.volume_mom > 0 ? '+' : ''}{item.volume_mom?.toFixed(1) || 0}%</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>近30天运单</Text>
              <Text style={styles.metricVal}>{item.monthly_order_count || 0}票</Text>
            </View>
          </View>
          {item.latest_follow && (
            <View style={styles.latestFollow}>
              <Text style={styles.latestFollowIcon}>📝</Text>
              <Text style={styles.latestFollowText} numberOfLines={1}>{item.latest_follow.content}</Text>
              <Text style={styles.latestFollowTime}>{formatRelativeTime(item.latest_follow.created_at)}</Text>
            </View>
          )}
          {/* ── 跟进提醒预警条 ── */}
          {getItemReminders(item).map(r => (
            <View key={r.id} style={styles.reminderBar}>
              <Ionicons name="alarm-outline" size={13} color="#dc2626" />
              <Text style={styles.reminderText} numberOfLines={2}>{r.content}</Text>
              <View style={styles.reminderActions}>
                <TouchableOpacity onPress={(e) => { e.stopPropagation(); snoozeReminder(r.id, 2); }}>
                  <Text style={styles.reminderSnooze}>延期提醒</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={(e) => { e.stopPropagation(); openFollow(item); }}>
                  <Text style={styles.reminderAction}>去写跟进</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <View style={styles.cardActions}>
            <TouchableOpacity style={styles.actionBtn} onPress={(e) => { e.stopPropagation && e.stopPropagation(); openFollow(item); }}>
              <Ionicons name="create-outline" size={14} color="#2563eb" />
              <Text style={styles.actionBtnText}>录入跟进</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtnSecondary} onPress={(e) => { e.stopPropagation && e.stopPropagation(); }}>
              <Ionicons name="search-outline" size={14} color="#ea580c" />
              <Text style={[styles.actionBtnText, { color: '#ea580c' }]}>查单追踪</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      );
    }

    // ── PRD: 已流失卡片 ──
    return (
      <TouchableOpacity style={styles.card} onPress={navTarget}>
        <View style={styles.cardTop}>
          <Text style={styles.company}>{item.company_name}</Text>
          <TouchableOpacity
            style={[styles.stageBadge, { backgroundColor: stageColor }]}
            onPress={(e) => { e.stopPropagation && e.stopPropagation(); setStageTarget(item); setStageVisible(true); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.stageBadgeText}>已流失</Text>
            <Ionicons name="caret-down" size={10} color="#fff" style={{ marginLeft: 3 }} />
          </TouchableOpacity>
        </View>
        <View style={styles.lossMetrics}>
          <View style={styles.miniMetric}>
            <Text style={styles.miniMetricVal}>停发 {item.days_inactive || '?'} 天</Text>
          </View>
        </View>
        {item.latest_follow && (
          <View style={styles.latestFollow}>
            <Text style={styles.latestFollowIcon}>📝</Text>
            <Text style={styles.latestFollowText} numberOfLines={1}>{item.latest_follow.content}</Text>
            <Text style={styles.latestFollowTime}>{formatRelativeTime(item.latest_follow.created_at)}</Text>
          </View>
        )}
        {/* ── 跟进提醒预警条 ── */}
        {getItemReminders(item).map(r => (
          <View key={r.id} style={styles.reminderBar}>
            <Ionicons name="alarm-outline" size={13} color="#dc2626" />
            <Text style={styles.reminderText} numberOfLines={2}>{r.content}</Text>
            <View style={styles.reminderActions}>
              <TouchableOpacity onPress={(e) => { e.stopPropagation(); snoozeReminder(r.id, 2); }}>
                <Text style={styles.reminderSnooze}>延期提醒</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={(e) => { e.stopPropagation(); openFollow(item); }}>
                <Text style={styles.reminderAction}>去写跟进</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={(e) => { e.stopPropagation && e.stopPropagation(); openFollow(item); }}>
            <Ionicons name="create-outline" size={14} color="#2563eb" />
            <Text style={styles.actionBtnText}>录入跟进</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtnSecondary} onPress={(e) => { e.stopPropagation && e.stopPropagation(); }}>
            <Ionicons name="refresh-outline" size={14} color="#dc2626" />
            <Text style={[styles.actionBtnText, { color: '#dc2626' }]}>申请重新激活</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>线索与客户</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('CreateLead')}>
          <Ionicons name="add-circle" size={40} color="#2563eb" />
        </TouchableOpacity>
      </View>

      {/* ── PRD V2.1: 4-Stage Tab Bar ── */}
      <View style={styles.stageTabBar}>
        {STAGE_OPTIONS.map(opt => {
          const count = stageCounts[opt.key] || 0;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.stageTab, activeStage === opt.key && styles.stageTabActive]}
              onPress={() => switchStage(opt.key)}
            >
              <Text style={[styles.stageTabText, activeStage === opt.key && styles.stageTabTextActive]}>
                {opt.label}
              </Text>
              {count > 0 && (
                <View style={[styles.stageTabBadge, { backgroundColor: activeStage === opt.key ? STAGE_COLORS[opt.key] : '#cbd5e1' }]}>
                  <Text style={[styles.stageTabBadgeText, { color: activeStage === opt.key ? '#fff' : '#64748b' }]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Sub-tab filter row ── */}
      <View style={styles.subTabRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {(SUB_TABS[activeStage] || []).map(st => (
            <TouchableOpacity
              key={st.key}
              style={[styles.subTabChip, activeSubTab === st.key && styles.subTabChipActive]}
              onPress={() => setActiveSubTab(st.key)}
            >
              <Text style={[styles.subTabChipText, activeSubTab === st.key && styles.subTabChipTextActive]}>{st.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color="#94a3b8" />
        <TextInput style={styles.searchInput} placeholder="搜索公司名称..." value={keyword} onChangeText={setKeyword} onSubmitEditing={fetchAll} />
        {keyword ? <TouchableOpacity onPress={() => setKeyword('')}><Ionicons name="close-circle" size={18} color="#94a3b8" /></TouchableOpacity> : null}
      </View>

      <FlatList
        data={items}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<EmptyState icon="📋" title="暂无数据" desc="点击右上角 + 创建新线索" />}
        contentContainerStyle={items.length === 0 ? { flex: 1 } : { paddingBottom: 20 }}
      />

      {/* Quick Follow-up Modal — centered card */}
      <Modal visible={followVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setFollowVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
              <Text style={styles.modalTitle} numberOfLines={1}>
                添加跟进 - {followTarget?.company_name}
              </Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>跟进方式</Text>
              <View style={styles.typeRow}>
                {FOLLOW_TYPES.map(t => (
                  <TouchableOpacity
                    key={t.key}
                    style={[styles.typeChip, followType === t.key && styles.typeChipActive]}
                    onPress={() => setFollowType(t.key)}
                  >
                    <Text style={[styles.typeText, followType === t.key && styles.typeTextActive]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>跟进内容</Text>
              <TextInput
                style={styles.textArea}
                placeholder="请输入跟进内容..."
                value={followContent}
                onChangeText={setFollowContent}
                multiline
                autoFocus
              />

              <Text style={styles.label}>图片附件（可选）</Text>
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

              <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.5 }]} onPress={handleFollow} disabled={saving}>
                <Text style={styles.saveBtnText}>{saving ? '保存中...' : '保存跟进记录'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Stage Edit Modal */}
      <Modal visible={stageVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => { setStageVisible(false); setStageTarget(null); }}>
          <View style={styles.stageModalContent}>
            <Text style={styles.stageModalTitle}>
              编辑阶段 - {stageTarget?.company_name}
            </Text>
            <Text style={styles.stageModalSub}>
              当前: {stageTarget?.lifecycle_label || '开发中'}
            </Text>
            <View style={styles.stageOptionList}>
              {STAGE_OPTIONS.map(opt => {
                const currentKey = stageTarget ? getStageKey(stageTarget) : null;
                const isActive = currentKey === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.stageOption, isActive && { borderColor: STAGE_COLORS[opt.key], borderWidth: 2 }]}
                    onPress={() => handleStageChange(opt.key)}
                    disabled={stageSaving}
                  >
                    <View style={[styles.stageDot, { backgroundColor: STAGE_COLORS[opt.key] }]} />
                    <Text style={[styles.stageOptionLabel, isActive && { fontWeight: '700' }]}>
                      {opt.label}
                    </Text>
                    {isActive && <Ionicons name="checkmark" size={18} color={STAGE_COLORS[opt.key]} style={{ marginLeft: 'auto' }} />}
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={styles.stageCancelBtn}
              onPress={() => { setStageVisible(false); setStageTarget(null); }}
            >
              <Text style={styles.stageCancelText}>取消</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  addBtn: {},

  // ── PRD V2.1: Stage+Sub-tab bar ──
  stageTabBar: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 12, paddingBottom: 4, paddingTop: 8, gap: 4 },
  stageTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 8, backgroundColor: '#f8fafc', gap: 4 },
  stageTabActive: { backgroundColor: '#eff6ff' },
  stageTabText: { fontSize: 13, fontWeight: '500', color: '#64748b' },
  stageTabTextActive: { color: '#2563eb', fontWeight: '700' },
  stageTabBadge: { minWidth: 20, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  stageTabBadgeText: { fontSize: 11, fontWeight: '700' },
  subTabRow: { backgroundColor: '#fff', paddingBottom: 8, paddingHorizontal: 14 },
  subTabChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, backgroundColor: '#f1f5f9', marginRight: 6 },
  subTabChipActive: { backgroundColor: '#2563eb' },
  subTabChipText: { fontSize: 12, color: '#64748b' },
  subTabChipTextActive: { color: '#fff', fontWeight: '500' },

  // Search
  searchBox: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginVertical: 10, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  searchInput: { flex: 1, fontSize: 14, marginLeft: 8, color: '#334155' },

  // Cards
  card: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 8, borderRadius: 12, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  company: { fontSize: 16, fontWeight: '600', color: '#0f172a', flex: 1 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  quickFollowBtn: { padding: 4 },
  cardFootRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stageBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  stageBadgeText: { fontSize: 11, color: '#fff', fontWeight: '600' },
  cardBody: { marginBottom: 8 },
  info: { fontSize: 13, color: '#64748b', marginBottom: 6 },
  tags: { flexDirection: 'row', flexWrap: 'wrap' },
  cardMid: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  metrics: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#f8fafc', borderRadius: 8, padding: 10, marginBottom: 8 },
  metric: { alignItems: 'center' },
  metricLabel: { fontSize: 11, color: '#94a3b8', marginBottom: 2 },
  metricVal: { fontSize: 15, fontWeight: '600', color: '#334155' },
  latestFollow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingTop: 8, paddingBottom: 2 },
  latestFollowIcon: { fontSize: 12, marginRight: 4 },
  latestFollowText: { flex: 1, fontSize: 12, color: '#64748b', lineHeight: 17 },
  latestFollowTime: { fontSize: 11, color: '#94a3b8', marginLeft: 8 },
  cardFoot: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10 },
  contact: { fontSize: 12, color: '#94a3b8' },
  owner: { fontSize: 12, color: '#94a3b8' },
  // PRD V2.1: New card elements
  devInfo: { fontSize: 13, color: '#64748b', marginTop: 6, marginBottom: 4 },
  routeInfo: { fontSize: 12, color: '#64748b', marginTop: 4 },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: '#eff6ff', gap: 4 },
  actionBtnText: { fontSize: 12, fontWeight: '600', color: '#2563eb' },
  actionBtnSecondary: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: '#fff7ed', gap: 4 },
  // ── Reminder alert bar (PRD V1.1) ──
  reminderBar: { flexDirection: 'column', marginTop: 8, padding: 8, backgroundColor: '#fef2f2', borderRadius: 8, borderLeftWidth: 3, borderLeftColor: '#dc2626' },
  reminderText: { fontSize: 11, color: '#7f1d1d', lineHeight: 16, flex: 1, marginBottom: 4 },
  reminderActions: { flexDirection: 'row', gap: 8 },
  reminderSnooze: { fontSize: 11, color: '#64748b', paddingHorizontal: 6, paddingVertical: 2 },
  reminderAction: { fontSize: 11, fontWeight: '600', color: '#2563eb', paddingHorizontal: 6, paddingVertical: 2 },
  lossMetrics: { flexDirection: 'row', marginTop: 6, marginBottom: 2 },
  miniMetric: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#fef2f2', borderRadius: 6 },
  miniMetricVal: { fontSize: 12, fontWeight: '600', color: '#dc2626' },

  // Follow-up modal — centered card
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 500, maxHeight: '85%' },
  modalScroll: { maxHeight: '100%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a', flex: 1, textAlign: 'center' },
  label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8, marginTop: 8 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  typeChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, backgroundColor: '#f1f5f9' },
  typeChipActive: { backgroundColor: '#2563eb' },
  typeText: { fontSize: 13, color: '#64748b' },
  typeTextActive: { color: '#fff', fontWeight: '500' },
  textArea: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 12, fontSize: 14, minHeight: 80, borderWidth: 1, borderColor: '#e2e8f0', textAlignVertical: 'top' },
  // Image picker
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  imageWrapper: { position: 'relative' },
  thumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: '#f1f5f9' },
  removeImgBtn: { position: 'absolute', top: -6, right: -6 },
  addImgBtn: { width: 72, height: 72, borderRadius: 8, borderWidth: 1.5, borderColor: '#e2e8f0', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  addImgText: { fontSize: 10, color: '#94a3b8', marginTop: 2 },
  saveBtn: { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },

  // Stage edit modal
  stageModalContent: { backgroundColor: '#fff', marginHorizontal: 32, borderRadius: 16, padding: 20 },
  stageModalTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', textAlign: 'center', marginBottom: 4 },
  stageModalSub: { fontSize: 13, color: '#94a3b8', textAlign: 'center', marginBottom: 16 },
  stageOptionList: { gap: 8, marginBottom: 16 },
  stageOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  stageDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  stageOptionLabel: { fontSize: 15, color: '#334155', fontWeight: '500' },
  stageCancelBtn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#f1f5f9' },
  stageCancelText: { color: '#64748b', fontWeight: '600', fontSize: 15 },
});
