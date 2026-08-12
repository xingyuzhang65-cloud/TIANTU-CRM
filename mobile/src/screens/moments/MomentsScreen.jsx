import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, TextInput, Image,
  RefreshControl, Dimensions, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client, { resolveBackendUrl } from '../../api/client';

const TYPE_COLORS = {
  DAILY: { bg: '#eff6ff', text: '#2563eb', label: '日常' },
  ACTIVITY: { bg: '#f0fdf4', text: '#16a34a', label: '业务' },
  SYSTEM_KPI: { bg: '#fefce8', text: '#ca8a04', label: '战报' },
};

const SCREEN_W = Dimensions.get('window').width;

function formatTime(t) {
  if (!t) return '';
  const d = new Date(t);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';
  return d.toLocaleDateString('zh-CN');
}

async function uploadImages(images) {
  if (images.length === 0) return [];
  const formData = new FormData();
  images.forEach(img => {
    if (img._file) {
      formData.append('files', img._file);
    } else {
      formData.append('files', { uri: img.uri, name: img.fileName || 'photo.jpg', type: img.mimeType || 'image/jpeg' });
    }
  });
  try {
    const res = await client.post('/api/upload/multiple', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    if (res.ok) return res.urls;
  } catch {}
  return [];
}

export default function MomentsScreen() {
  const [moments, setMoments] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [composeVisible, setComposeVisible] = useState(false);
  const [composeText, setComposeText] = useState('');
  const [composeType, setComposeType] = useState('DAILY');
  const [composeVisible2, setComposeVisible2] = useState('ALL');
  const [selectedImages, setSelectedImages] = useState([]);
  const [posting, setPosting] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState(null);

  const fetchMoments = useCallback(async (pg = 1, append = false) => {
    try {
      const res = await client.get('/api/v1/crm/moments', { params: { page: pg, page_size: 10 } });
      if (res.ok) {
        setMoments(prev => append ? [...prev, ...res.items] : res.items);
        setHasMore(res.has_more);
        setPage(pg);
      }
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchMoments(); }, [fetchMoments]);

  const onRefresh = () => { setRefreshing(true); fetchMoments(1, false); };
  const loadMore = () => { if (hasMore && !loading) { setLoading(true); fetchMoments(page + 1, true); } };

  const handleLike = async (momentId) => {
    try {
      const res = await client.post(`/api/v1/crm/moments/${momentId}/like`);
      if (res.ok) {
        setMoments(prev => prev.map(m => {
          if (m.id !== momentId) return m;
          const delta = res.action === 'liked' ? 1 : -1;
          return { ...m, user_liked: res.action === 'liked', like_count: m.like_count + delta };
        }));
      }
    } catch {}
  };

  const pickImages = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*'; input.multiple = true;
      input.onchange = (e) => {
        const files = Array.from(e.target.files).slice(0, 9 - selectedImages.length);
        const newImages = files.map(f => ({ uri: URL.createObjectURL(f), fileName: f.name, mimeType: f.type, _file: f }));
        setSelectedImages(prev => [...prev, ...newImages].slice(0, 9));
      };
      input.click();
      return;
    }
  };

  const removeImage = (idx) => setSelectedImages(prev => prev.filter((_, i) => i !== idx));

  const handleSubmitPost = async () => {
    const text = composeText.trim();
    if (!text && selectedImages.length === 0) return;
    setPosting(true);
    try {
      let mediaUrls = [];
      if (selectedImages.length > 0) mediaUrls = await uploadImages(selectedImages);

      const res = await client.post('/api/v1/crm/moments', {
        content: text || '分享图片', type: composeType, visible_type: composeVisible2,
        media_urls: JSON.stringify(mediaUrls),
      });
      if (res.ok) {
        setComposeText(''); setSelectedImages([]); setComposeVisible(false);
        fetchMoments(1, false);
      }
    } catch {}
    setPosting(false);
  };

  const fullUrl = resolveBackendUrl;

  const renderItem = ({ item: m }) => {
    const ts = TYPE_COLORS[m.type] || TYPE_COLORS.DAILY;
    const urls = (m.media_urls || []).map(fullUrl);
    return (
      <View style={[styles.card, m.type === 'SYSTEM_KPI' && styles.cardKpi]}>
        <View style={styles.cardHeader}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{(m.user?.name || '?')[0]}</Text></View>
          <View style={styles.cardMeta}>
            <View style={styles.nameRow}>
              <Text style={styles.userName}>{m.user?.name}</Text>
              <View style={[styles.typeBadge, { backgroundColor: ts.bg }]}>
                <Text style={[styles.typeBadgeText, { color: ts.text }]}>{ts.label}</Text>
              </View>
            </View>
            <Text style={styles.time}>{formatTime(m.created_at)}</Text>
          </View>
        </View>
        {m.content ? <Text style={styles.content}>{m.content}</Text> : null}
        {urls.length > 0 && (
          <View style={styles.imageGrid}>
            {urls.map((url, i) => (
              <TouchableOpacity key={i} onPress={() => setLightboxUrl(url)}>
                <Image source={{ uri: url }} style={[
                  styles.feedImg,
                  urls.length === 1 ? { width: SCREEN_W - 68, height: 200 } :
                  urls.length === 2 ? { width: (SCREEN_W - 72) / 2, height: 140 } :
                  { width: (SCREEN_W - 76) / 3, height: 100 },
                ]} resizeMode="cover" />
              </TouchableOpacity>
            ))}
          </View>
        )}
        <View style={styles.cardFooter}>
          {m.link_client ? <Text style={styles.clientLink}>🔗 {m.link_client.company_name}</Text> : <Text style={styles.visBadge}>{m.visible_type === 'ALL' ? '🌐 全公司' : '🏢 本部门'}</Text>}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleLike(m.id)}>
              <Ionicons name={m.user_liked ? 'heart' : 'heart-outline'} size={16} color={m.user_liked ? '#ef4444' : '#94a3b8'} />
              <Text style={[styles.actionCount, m.user_liked && { color: '#ef4444' }]}>{m.like_count}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}>
              <Ionicons name="chatbubble-outline" size={14} color="#94a3b8" />
              <Text style={styles.actionCount}>{m.comment_count}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📱 团队广场</Text>
        <TouchableOpacity style={styles.postBtn} onPress={() => setComposeVisible(true)}>
          <Ionicons name="create-outline" size={18} color="#fff" />
          <Text style={styles.postBtnText}>发布</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={moments}
        keyExtractor={m => String(m.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={loading ? <ActivityIndicator style={{ padding: 16 }} color="#2563eb" /> : null}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>暂无动态，赶紧发布第一条吧~</Text> : null}
      />

      {/* 发布弹窗 */}
      <Modal visible={composeVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => { setComposeVisible(false); setSelectedImages([]); }}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>发布动态</Text>
              <TouchableOpacity onPress={handleSubmitPost} disabled={posting}>
                <Text style={[styles.sendText, posting && { opacity: 0.5 }]}>{posting ? '发布中...' : '发布'}</Text>
              </TouchableOpacity>
            </View>
            <TextInput style={styles.composeInput} placeholder="分享你的工作动态..." value={composeText} onChangeText={setComposeText} multiline maxLength={2000} autoFocus />
            {selectedImages.length > 0 && (
              <FlatList horizontal data={selectedImages} keyExtractor={(_, i) => String(i)}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
                renderItem={({ item: img, index: i }) => (
                  <View style={styles.selectedImgWrap}>
                    <Image source={{ uri: img.uri }} style={styles.selectedImg} />
                    <TouchableOpacity style={styles.removeImgBtn} onPress={() => removeImage(i)}>
                      <Ionicons name="close-circle" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}
            <TouchableOpacity style={styles.addPhotoBtn} onPress={pickImages}>
              <Ionicons name="images-outline" size={18} color="#2563eb" />
              <Text style={styles.addPhotoText}>选择图片 ({selectedImages.length}/9)</Text>
            </TouchableOpacity>
            <View style={styles.composeRow}>
              <Text style={styles.composeLabel}>类型</Text>
              <View style={styles.typeRow}>
                {['DAILY', 'ACTIVITY', 'SYSTEM_KPI'].map(t => (
                  <TouchableOpacity key={t} style={[styles.typeChip, composeType === t && styles.typeChipActive]} onPress={() => setComposeType(t)}>
                    <Text style={[styles.typeChipText, composeType === t && styles.typeChipTextActive]}>{TYPE_COLORS[t].label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.composeRow}>
              <Text style={styles.composeLabel}>可见</Text>
              <View style={styles.typeRow}>
                {[{ value: 'ALL', label: '全公司' }, { value: 'DEPT', label: '本部门' }].map(v => (
                  <TouchableOpacity key={v.value} style={[styles.typeChip, composeVisible2 === v.value && styles.typeChipActive]} onPress={() => setComposeVisible2(v.value)}>
                    <Text style={[styles.typeChipText, composeVisible2 === v.value && styles.typeChipTextActive]}>{v.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* 灯箱 */}
      <Modal visible={!!lightboxUrl} transparent onRequestClose={() => setLightboxUrl(null)}>
        <TouchableOpacity style={styles.lightbox} activeOpacity={1} onPress={() => setLightboxUrl(null)}>
          <TouchableOpacity style={styles.lightboxClose} onPress={() => setLightboxUrl(null)}>
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>
          {lightboxUrl && <Image source={{ uri: lightboxUrl }} style={styles.lightboxImg} resizeMode="contain" />}
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 14, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  postBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2563eb', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, gap: 4 },
  postBtnText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  listContent: { padding: 16, paddingBottom: 30 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 },
  cardKpi: { backgroundColor: '#fefce8', borderColor: '#fde68a' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cardMeta: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  userName: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  typeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  typeBadgeText: { fontSize: 10, fontWeight: '600' },
  time: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  content: { fontSize: 14, lineHeight: 22, color: '#334155', marginBottom: 10 },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 10 },
  feedImg: { borderRadius: 8 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10 },
  visBadge: { fontSize: 11, color: '#94a3b8', flex: 1 },
  clientLink: { fontSize: 11, color: '#2563eb', flex: 1 },
  actions: { flexDirection: 'row', gap: 14 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionCount: { fontSize: 13, color: '#94a3b8' },
  empty: { textAlign: 'center', color: '#94a3b8', padding: 40, fontSize: 14 },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  sendText: { fontSize: 15, fontWeight: '600', color: '#2563eb' },
  composeInput: { paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, minHeight: 80, textAlignVertical: 'top' },
  addPhotoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8 },
  addPhotoText: { fontSize: 13, color: '#2563eb' },
  selectedImgWrap: { position: 'relative' },
  selectedImg: { width: 70, height: 70, borderRadius: 8 },
  removeImgBtn: { position: 'absolute', top: -6, right: -6, backgroundColor: '#fff', borderRadius: 10 },
  composeRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 12 },
  composeLabel: { fontSize: 13, color: '#64748b', width: 32 },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  typeChipActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  typeChipText: { fontSize: 12, color: '#64748b' },
  typeChipTextActive: { color: '#2563eb', fontWeight: '600' },

  // Lightbox
  lightbox: { flex: 1, backgroundColor: 'rgba(0,0,0,.95)', justifyContent: 'center', alignItems: 'center' },
  lightboxClose: { position: 'absolute', top: 50, right: 20, zIndex: 1 },
  lightboxImg: { width: '100%', height: '70%' },
});
