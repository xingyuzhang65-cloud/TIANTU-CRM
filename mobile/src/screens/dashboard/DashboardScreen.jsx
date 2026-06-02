import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl,
  Dimensions, FlatList, Modal, Alert, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import client from '../../api/client';
import StatCard from '../../components/StatCard';
import ActivityTimeline from '../../components/ActivityTimeline';
import MomentsFeed from '../../components/MomentsFeed';
import { useAuth } from '../../context/AuthContext';

const SCREEN_W = Dimensions.get('window').width;
const BANNER_W = SCREEN_W - 32;

const BANNER_IMG_BASE = 'http://localhost:8000/static/uploads';

const BANNERS = [
  { id: '1', title: '美森快船 · 限时特惠', sub: '上海 → 洛杉矶  12天极速达', tag: '海运特惠', color: '#2563eb', grad: ['#1e40af', '#3b82f6'], image: `${BANNER_IMG_BASE}/banner_ship.jpg`, detail: '美森快船6月特惠：华东-美西 12天极速达\n\n📦 20GP ¥18,000起 ｜ 40GP ¥28,000起\n📦 40HQ ¥32,000起\n\n🎁 满10柜赠1柜\n📅 活动截止：2026年6月30日\n☎️ 联系专属客服锁定舱位' },
  { id: '2', title: '中欧班列 · 旺季保舱', sub: '西安 → 汉堡 / 杜伊斯堡  18天', tag: '铁运专线', color: '#ea580c', grad: ['#9a3412', '#f97316'], image: `${BANNER_IMG_BASE}/banner_train.jpg`, detail: '中欧班列·长安号 6月保舱计划\n\n🚂 西安→汉堡 18天 ｜ 西安→杜伊斯堡 19天\n\n📦 40HQ ¥42,000起（含两端拖车）\n🎁 签约年框客户享9折\n📅 活动截止：2026年7月15日\n☎️ 舱位有限，先到先得' },
  { id: '3', title: '东南亚空派 · 48h极速', sub: '深圳/广州 → 曼谷/河内/雅加达', tag: '空运快线', color: '#16a34a', grad: ['#166534', '#22c55e'], image: `${BANNER_IMG_BASE}/banner_plane.jpg`, detail: '东南亚空派特快专线\n\n✈️ 深圳/广州直飞东南亚各枢纽\n⏱ 48小时极速派送\n\n📦 ¥8.5/KG起（含燃油）\n📦 100KG+ ¥7.2/KG\n🎁 首单立减¥500\n📅 长期有效\n☎️ 询价即享专属方案' },
  { id: '4', title: '美线FBA · 一站式入仓', sub: '全国30城揽收 → 美国FBA仓库', tag: 'FBA头程', color: '#7c3aed', grad: ['#5b21b6', '#a78bfa'], image: `${BANNER_IMG_BASE}/banner_warehouse.jpg`, detail: '亚马逊FBA头程运输\n\n🚢 海派/空派/快递三种渠道\n📦 全国30+城市上门揽收\n\n🏭 覆盖ONT8 / LAX9 / LGB8等热门仓库\n💰 海派 ¥6.5/KG起\n🎁 新客首票免操作费\n📅 长期有效\n☎️ 专属FBA顾问一对一服务' },
  { id: '5', title: '卡航中亚 · 陆运新通道', sub: '喀什 → 比什凯克 / 塔什干  7天', tag: '卡航陆运', color: '#f59e0b', grad: ['#b45309', '#fbbf24'], image: `${BANNER_IMG_BASE}/banner_truck.jpg`, detail: '中亚卡航陆运专线\n\n🚛 喀什口岸出境\n📍 比什凯克 7天 ｜ 塔什干 9天\n\n📦 整车/拼车均可\n💰 拼车 ¥3,200/方起\n🎁 首次合作享95折\n📅 活动截止：2026年8月31日\n☎️ 中亚线路专属客服' },
];

export default function DashboardScreen() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [bannerIdx, setBannerIdx] = useState(0);
  const [adModal, setAdModal] = useState(null);
  const [imgErrors, setImgErrors] = useState({});
  const bannerRef = useRef(null);
  const timerRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await client.get('/api/analytics/summary');
      if (res.ok) setData(res);
    } catch {}
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Banner auto-rotate
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setBannerIdx(prev => {
        const next = (prev + 1) % BANNERS.length;
        bannerRef.current?.scrollToIndex?.({ index: next, animated: true, viewPosition: 0.5 });
        return next;
      });
    }, 3500);
    return () => clearInterval(timerRef.current);
  }, []);

  const onBannerScroll = (e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / BANNER_W);
    if (idx !== bannerIdx) setBannerIdx(idx);
  };

  const goToBanner = (idx) => {
    setBannerIdx(idx);
    bannerRef.current?.scrollToIndex?.({ index: idx, animated: true, viewPosition: 0.5 });
    // Reset auto-rotate timer
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setBannerIdx(prev => {
        const next = (prev + 1) % BANNERS.length;
        bannerRef.current?.scrollToIndex?.({ index: next, animated: true, viewPosition: 0.5 });
        return next;
      });
    }, 3500);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const cards = data?.cards || [];

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>早上好 👋</Text>
          <Text style={styles.name}>{user?.name || '销售经理'}</Text>
        </View>
        <Text style={styles.date}>{new Date().toLocaleDateString('zh-CN')}</Text>
      </View>

      {/* Ad Banner Carousel */}
      <View style={styles.bannerWrap}>
        <FlatList
          ref={bannerRef}
          data={BANNERS}
          keyExtractor={item => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onBannerScroll}
          getItemLayout={(_, index) => ({ length: BANNER_W, offset: BANNER_W * index, index })}
          renderItem={({ item }) => {
            const showFallback = imgErrors[item.id];
            return (
            <TouchableOpacity
              style={styles.bannerCard}
              activeOpacity={0.97}
              onPress={() => setAdModal(item)}
            >
              {!showFallback && (
                <Image
                  source={{ uri: item.image }}
                  style={styles.bannerImage}
                  resizeMode="cover"
                  onError={() => setImgErrors(prev => ({ ...prev, [item.id]: true }))}
                />
              )}
              {showFallback && (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: item.grad[0] }]}>
                  <View style={[styles.bannerBgCircle, { backgroundColor: item.grad[1] }]} />
                  <View style={styles.bannerBgCircle2} />
                  <View style={[styles.bannerBgCircle, { top: 20, right: 20, width: 60, height: 60, backgroundColor: 'rgba(255,255,255,0.12)' }]} />
                </View>
              )}
              {/* Gradient overlay */}
              <View style={styles.bannerOverlay}>
                {/* Hot badge */}
                <View style={styles.hotBadge}>
                  <Ionicons name="flame" size={13} color="#fff" />
                  <Text style={styles.hotBadgeText}>限时活动</Text>
                </View>
                {/* Main content */}
                <View>
                  <Text style={styles.bannerTitle} numberOfLines={1}>{item.title}</Text>
                  <View style={styles.bannerSubRow}>
                    <Ionicons name="location" size={11} color="rgba(255,255,255,0.8)" />
                    <Text style={styles.bannerSub} numberOfLines={1}>{item.sub}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )}}
        />
        {/* Left/Right arrows */}
        <TouchableOpacity
          style={[styles.bannerArrow, styles.bannerArrowLeft]}
          onPress={() => goToBanner(bannerIdx === 0 ? BANNERS.length - 1 : bannerIdx - 1)}
        >
          <Ionicons name="chevron-back" size={18} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bannerArrow, styles.bannerArrowRight]}
          onPress={() => goToBanner((bannerIdx + 1) % BANNERS.length)}
        >
          <Ionicons name="chevron-forward" size={18} color="#fff" />
        </TouchableOpacity>
        {/* Dots */}
        <View style={styles.dotsRow}>
          {BANNERS.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => goToBanner(i)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <View style={[styles.dot, i === bannerIdx && styles.dotActive]} />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Ad Detail Modal */}
      <Modal visible={!!adModal} transparent animationType="slide">
        <View style={styles.adOverlay}>
          <View style={styles.adModal}>
            <View style={styles.adHeader}>
              <TouchableOpacity onPress={() => setAdModal(null)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
              <Text style={styles.adTag}>{adModal?.tag}</Text>
              <View style={{ width: 24 }} />
            </View>
            <Text style={styles.adTitle}>{adModal?.title}</Text>
            <Text style={styles.adSub}>{adModal?.sub}</Text>
            <View style={styles.adDivider} />
            <Text style={styles.adDetail}>{adModal?.detail}</Text>
            <TouchableOpacity style={[styles.adAction, { backgroundColor: adModal?.color || '#2563eb' }]} onPress={() => { setAdModal(null); Alert.alert('已联系', '客服将尽快与您沟通确认'); }}>
              <Text style={styles.adActionText}>立即咨询</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.quickSection}>
        <View style={styles.quickRow}>
          {[
            { key: 'order', label: '下单', icon: 'cart', color: '#2563eb', bg: '#eff6ff' },
            { key: 'service', label: '服务', icon: 'headset', color: '#16a34a', bg: '#f0fdf4' },
            { key: 'cargo', label: '品名', icon: 'cube', color: '#ea580c', bg: '#fff7ed' },
            { key: 'warehouse', label: '预留仓', icon: 'archive', color: '#7c3aed', bg: '#f5f3ff' },
          ].map(item => (
            <TouchableOpacity
              key={item.key}
              style={styles.quickItem}
              onPress={() => Alert.alert(item.label, `${item.label}功能开发中`)}
            >
              <View style={[styles.quickIcon, { backgroundColor: item.bg }]}>
                <Ionicons name={item.icon} size={24} color={item.color} />
              </View>
              <Text style={styles.quickLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.quickRow}>
          {[
            { key: 'clockin', label: '打卡', icon: 'checkmark-circle', color: '#0891b2', bg: '#ecfeff' },
            { key: 'workorder', label: '工单', icon: 'construct', color: '#db2777', bg: '#fdf2f8' },
            { key: 'todo', label: '待办', icon: 'list', color: '#ca8a04', bg: '#fefce8' },
          ].map(item => (
            <TouchableOpacity
              key={item.key}
              style={styles.quickItem}
              onPress={() => Alert.alert(item.label, `${item.label}功能开发中`)}
            >
              <View style={[styles.quickIcon, { backgroundColor: item.bg }]}>
                <Ionicons name={item.icon} size={24} color={item.color} />
              </View>
              <Text style={styles.quickLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
          <View style={styles.quickItem} />
        </View>
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

      <View style={styles.section}>
        <MomentsFeed />
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
  // Banner
  bannerWrap: { marginTop: 14, marginHorizontal: 16, position: 'relative' },
  bannerCard: { width: BANNER_W, height: 170, borderRadius: 16, overflow: 'hidden', backgroundColor: '#1e293b' },
  bannerImage: { width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 },
  bannerOverlay: { flex: 1, justifyContent: 'space-between', padding: 16,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  hotBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, backgroundColor: 'rgba(239,68,68,0.85)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 4 },
  hotBadgeText: { fontSize: 11, color: '#fff', fontWeight: '700' },
  bannerTitle: { fontSize: 19, fontWeight: '800', color: '#fff', marginBottom: 6, letterSpacing: 0.5, textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  bannerSubRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bannerSub: { fontSize: 12, color: 'rgba(255,255,255,0.9)', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4, flex: 1 },
  bannerBgCircle: { position: 'absolute', top: -40, right: -20, width: 140, height: 140, borderRadius: 70 },
  bannerBgCircle2: { position: 'absolute', bottom: -40, left: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.06)' },
  // Arrows
  bannerArrow: { position: 'absolute', top: 70, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },
  bannerArrowLeft: { left: 0 },
  bannerArrowRight: { right: 0 },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#d1d5db' },
  dotActive: { backgroundColor: '#2563eb', width: 16 },
  // Ad modal
  adOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,.4)', justifyContent: 'flex-end' },
  adModal: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '80%' },
  adHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  adTag: { fontSize: 12, fontWeight: '700', color: '#64748b', backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6 },
  adTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  adSub: { fontSize: 13, color: '#94a3b8', marginBottom: 12 },
  adDivider: { height: 1, backgroundColor: '#e2e8f0', marginBottom: 12 },
  adDetail: { fontSize: 14, color: '#334155', lineHeight: 22 },
  adAction: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  adActionText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  quickRow: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 16, gap: 10 },
  quickSection: { paddingBottom: 4 },

  quickItem: { flex: 1, alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingVertical: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1 },
  quickIcon: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  quickLabel: { fontSize: 12, fontWeight: '600', color: '#334155' },
  statsGrid: { paddingHorizontal: 10, paddingTop: 16 },
  statsRow: { flexDirection: 'row', marginBottom: 6 },
  section: { marginTop: 20, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginBottom: 12 },
  chart: { borderRadius: 12, marginLeft: -8 },
});
