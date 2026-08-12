import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, TextInput, Image,
  ScrollView, Dimensions, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client, { resolveBackendUrl } from '../api/client';

// Conditional import: expo-image-picker for native, file input for web
let ImagePicker = null;
if (Platform.OS !== 'web') {
  try { ImagePicker = require('expo-image-picker'); } catch {}
}

const SCREEN_W = Dimensions.get('window').width;

const TYPE_COLORS = {
  DAILY: { bg: '#eff6ff', text: '#2563eb', label: '日常' },
  ACTIVITY: { bg: '#f0fdf4', text: '#16a34a', label: '业务' },
  SYSTEM_KPI: { bg: '#fefce8', text: '#ca8a04', label: '战报' },
};

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
      // Web: use the original File object
      formData.append('files', img._file);
    } else {
      // Native: use React Native's file format
      formData.append('files', {
        uri: img.uri,
        name: img.fileName || 'photo.jpg',
        type: img.mimeType || 'image/jpeg',
      });
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

export default function MomentsFeed() {
  const [moments, setMoments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [composeVisible, setComposeVisible] = useState(false);
  const [composeText, setComposeText] = useState('');
  const [composeType, setComposeType] = useState('DAILY');
  const [composeVisible2, setComposeVisible2] = useState('ALL');
  const [selectedImages, setSelectedImages] = useState([]);
  const [posting, setPosting] = useState(false);
  const [detailMoment, setDetailMoment] = useState(null);
  const [detailComments, setDetailComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState(null);

  const fetchMoments = useCallback(async () => {
    try {
      const res = await client.get('/api/v1/crm/moments', { params: { page: 1, page_size: 20 } });
      if (res.ok) setMoments(res.items || []);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMoments(); }, [fetchMoments]);

  const handleLike = async (momentId) => {
    try {
      const res = await client.post(`/api/v1/crm/moments/${momentId}/like`);
      if (res.ok) {
        setMoments(prev => prev.map(m => {
          if (m.id !== momentId) return m;
          const delta = res.action === 'liked' ? 1 : -1;
          return { ...m, user_liked: res.action === 'liked', like_count: m.like_count + delta };
        }));
        if (detailMoment && detailMoment.id === momentId) {
          setDetailMoment(prev => ({
            ...prev,
            user_liked: res.action === 'liked',
            like_count: prev.like_count + (res.action === 'liked' ? 1 : -1),
          }));
        }
      }
    } catch {}
  };

  const pickImages = async () => {
    if (Platform.OS === 'web') {
      // Use HTML file input for web
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;
      input.onchange = (e) => {
        const files = Array.from(e.target.files).slice(0, 9 - selectedImages.length);
        const newImages = files.map(f => ({ uri: URL.createObjectURL(f), fileName: f.name, mimeType: f.type, _file: f }));
        setSelectedImages(prev => [...prev, ...newImages].slice(0, 9));
      };
      input.click();
      return;
    }
    if (!ImagePicker) return;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert('需要相册权限才能选择图片');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 9 - selectedImages.length,
      });
      if (!result.canceled && result.assets) {
        setSelectedImages(prev => [...prev, ...result.assets].slice(0, 9));
      }
    } catch {}
  };

  const removeImage = (idx) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmitPost = async () => {
    const text = composeText.trim();
    if (!text && selectedImages.length === 0) return;
    setPosting(true);
    try {
      let mediaUrls = [];
      if (selectedImages.length > 0) {
        mediaUrls = await uploadImages(selectedImages);
      }

      const res = await client.post('/api/v1/crm/moments', {
        content: text || '分享图片',
        type: composeType,
        visible_type: composeVisible2,
        media_urls: JSON.stringify(mediaUrls),
      });
      if (res.ok) {
        setComposeText('');
        setSelectedImages([]);
        setComposeVisible(false);
        fetchMoments();
      }
    } catch {}
    setPosting(false);
  };

  const openDetail = async (moment) => {
    setDetailMoment(moment);
    setDetailComments(moment.comments || []);
    setCommentText('');
  };

  const handleComment = async () => {
    const text = commentText.trim();
    if (!text || !detailMoment) return;
    try {
      const res = await client.post(`/api/v1/crm/moments/${detailMoment.id}/comment`, { comment_text: text });
      if (res.ok) {
        setDetailComments(prev => [...prev, {
          id: Date.now(),
          user_name: res.comment?.user_name || '我',
          comment_text: text,
          created_at: new Date().toISOString(),
        }]);
        setCommentText('');
        setMoments(prev => prev.map(m =>
          m.id === detailMoment.id ? { ...m, comment_count: m.comment_count + 1 } : m
        ));
      }
    } catch {}
  };

  const renderImages = (urls, large = false) => {
    if (!urls || urls.length === 0) return null;
    const count = urls.length;
    const imgSize = large ? (SCREEN_W - 64) / 2 : 80;
    const containerWidth = large ? SCREEN_W - 64 : 240;
    return (
      <View style={[styles.imageGrid, { width: containerWidth }]}>
        {urls.map((url, i) => (
          <TouchableOpacity key={i} onPress={() => setLightboxUrl(url)}>
            <Image
              source={{ uri: url }}
              style={[
                styles.feedImage,
                count === 1 ? { width: large ? containerWidth : 200, height: large ? 180 : 150 } :
                count === 2 ? { width: (containerWidth - 4) / 2, height: imgSize } :
                { width: (containerWidth - 8) / 3, height: imgSize },
              ]}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderMomentCard = ({ item: m }) => {
    const typeStyle = TYPE_COLORS[m.type] || TYPE_COLORS.DAILY;
    // Build full baseURL for images
    const imageUrls = (m.media_urls || []).map(resolveBackendUrl);
    return (
      <TouchableOpacity
        style={[styles.card, m.type === 'SYSTEM_KPI' && styles.cardKpi]}
        onPress={() => openDetail(m)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(m.user?.name || '?')[0]}</Text>
          </View>
          <View style={styles.cardMeta}>
            <View style={styles.nameRow}>
              <Text style={styles.userName} numberOfLines={1}>{m.user?.name}</Text>
              <View style={[styles.typeBadge, { backgroundColor: typeStyle.bg }]}>
                <Text style={[styles.typeBadgeText, { color: typeStyle.text }]}>{typeStyle.label}</Text>
              </View>
            </View>
            <Text style={styles.time}>{formatTime(m.created_at)}</Text>
          </View>
        </View>
        {m.content ? <Text style={styles.content} numberOfLines={3}>{m.content}</Text> : null}
        {imageUrls.length > 0 && (
          <View style={styles.miniImages}>
            {imageUrls.slice(0, 3).map((url, i) => (
              <Image key={i} source={{ uri: url }} style={styles.miniImg} resizeMode="cover" />
            ))}
            {imageUrls.length > 3 && (
              <View style={styles.moreOverlay}>
                <Text style={styles.moreText}>+{imageUrls.length - 3}</Text>
              </View>
            )}
          </View>
        )}
        <View style={styles.cardFooter}>
          {m.link_client ? (
            <Text style={styles.clientLink} numberOfLines={1}>🔗 {m.link_client.company_name}</Text>
          ) : (
            <Text style={styles.visBadge}>{m.visible_type === 'ALL' ? '🌐 全公司' : '🏢 本部门'}</Text>
          )}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleLike(m.id)}>
              <Ionicons name={m.user_liked ? 'heart' : 'heart-outline'} size={16} color={m.user_liked ? '#ef4444' : '#94a3b8'} />
              <Text style={[styles.actionCount, m.user_liked && { color: '#ef4444' }]}>{m.like_count}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => openDetail(m)}>
              <Ionicons name="chatbubble-outline" size={14} color="#94a3b8" />
              <Text style={styles.actionCount}>{m.comment_count}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const detailImageUrls = detailMoment ? (detailMoment.media_urls || []).map(resolveBackendUrl) : [];

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>📱 团队动态</Text>
        <TouchableOpacity style={styles.postBtn} onPress={() => setComposeVisible(true)}>
          <Ionicons name="add-circle-outline" size={18} color="#fff" />
          <Text style={styles.postBtnText}>发布</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ padding: 20 }} color="#2563eb" />
      ) : moments.length === 0 ? (
        <Text style={styles.empty}>暂无动态，快去发布第一条吧~</Text>
      ) : (
        <FlatList
          horizontal
          data={moments.slice(0, 10)}
          keyExtractor={m => String(m.id)}
          renderItem={renderMomentCard}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          style={styles.list}
        />
      )}

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
                <Text style={[styles.sendText, posting && { opacity: 0.5 }]}>
                  {posting ? '发布中...' : '发布'}
                </Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.composeInput}
              placeholder="分享你的工作动态..."
              value={composeText}
              onChangeText={setComposeText}
              multiline
              maxLength={2000}
              autoFocus
            />
            {/* 图片选择 */}
            {selectedImages.length > 0 && (
              <ScrollView horizontal style={styles.imageSelector} contentContainerStyle={{ padding: 16, gap: 8 }}>
                {selectedImages.map((img, i) => (
                  <View key={i} style={styles.selectedImgWrap}>
                    <Image source={{ uri: img.uri }} style={styles.selectedImg} />
                    <TouchableOpacity style={styles.removeImgBtn} onPress={() => removeImage(i)}>
                      <Ionicons name="close-circle" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity style={styles.addPhotoBtn} onPress={pickImages}>
              <Ionicons name="images-outline" size={18} color="#2563eb" />
              <Text style={styles.addPhotoText}>选择图片 ({selectedImages.length}/9)</Text>
            </TouchableOpacity>
            <View style={styles.composeRow}>
              <Text style={styles.composeLabel}>类型</Text>
              <View style={styles.typeRow}>
                {['DAILY', 'ACTIVITY', 'SYSTEM_KPI'].map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeChip, composeType === t && styles.typeChipActive]}
                    onPress={() => setComposeType(t)}
                  >
                    <Text style={[styles.typeChipText, composeType === t && styles.typeChipTextActive]}>
                      {TYPE_COLORS[t].label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.composeRow}>
              <Text style={styles.composeLabel}>可见</Text>
              <View style={styles.typeRow}>
                {[{ value: 'ALL', label: '全公司' }, { value: 'DEPT', label: '本部门' }].map(v => (
                  <TouchableOpacity
                    key={v.value}
                    style={[styles.typeChip, composeVisible2 === v.value && styles.typeChipActive]}
                    onPress={() => setComposeVisible2(v.value)}
                  >
                    <Text style={[styles.typeChipText, composeVisible2 === v.value && styles.typeChipTextActive]}>
                      {v.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* 详情/评论弹窗 */}
      <Modal visible={!!detailMoment} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setDetailMoment(null)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>动态详情</Text>
              <View style={{ width: 24 }} />
            </View>
            {detailMoment && (
              <>
                <ScrollView style={styles.detailScroll}>
                  <View style={styles.detailBody}>
                    <View style={styles.detailHeader}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{(detailMoment.user?.name || '?')[0]}</Text>
                      </View>
                      <View>
                        <Text style={styles.userName}>{detailMoment.user?.name}</Text>
                        <Text style={styles.time}>{formatTime(detailMoment.created_at)}</Text>
                      </View>
                    </View>
                    {detailMoment.content ? <Text style={styles.detailContent}>{detailMoment.content}</Text> : null}
                    {detailImageUrls.length > 0 && (
                      <View style={styles.detailImages}>
                        {detailImageUrls.map((url, i) => (
                          <TouchableOpacity key={i} onPress={() => setLightboxUrl(url)}>
                            <Image source={{ uri: url }} style={styles.detailImg} resizeMode="cover" />
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                    <View style={styles.detailActions}>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => handleLike(detailMoment.id)}>
                        <Ionicons name={detailMoment.user_liked ? 'heart' : 'heart-outline'} size={20} color={detailMoment.user_liked ? '#ef4444' : '#94a3b8'} />
                        <Text style={[styles.actionCount, detailMoment.user_liked && { color: '#ef4444' }]}>{detailMoment.like_count}</Text>
                      </TouchableOpacity>
                      <Text style={styles.detailCommentCount}>{detailComments.length} 条评论</Text>
                    </View>
                  </View>
                  <FlatList
                    data={detailComments}
                    keyExtractor={(c, i) => String(c.id || i)}
                    style={styles.commentList}
                    scrollEnabled={false}
                    renderItem={({ item: c }) => (
                      <View style={styles.commentItem}>
                        <Text style={styles.commentUser}>{c.user_name}</Text>
                        {c.reply_to_user_name ? <Text style={styles.commentReply}> 回复 {c.reply_to_user_name}</Text> : null}
                        <Text style={styles.commentBody}>{c.comment_text}</Text>
                      </View>
                    )}
                    ListEmptyComponent={<Text style={styles.emptyComments}>暂无评论</Text>}
                  />
                </ScrollView>
                <View style={styles.commentInputRow}>
                  <TextInput
                    style={styles.commentInput}
                    placeholder="写评论..."
                    value={commentText}
                    onChangeText={setCommentText}
                    maxLength={500}
                  />
                  <TouchableOpacity onPress={handleComment} disabled={!commentText.trim()}>
                    <Ionicons name="send" size={22} color={commentText.trim() ? '#2563eb' : '#cbd5e1'} />
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* 图片灯箱 */}
      <Modal visible={!!lightboxUrl} transparent onRequestClose={() => setLightboxUrl(null)}>
        <TouchableOpacity style={styles.lightbox} activeOpacity={1} onPress={() => setLightboxUrl(null)}>
          <TouchableOpacity style={styles.lightboxClose} onPress={() => setLightboxUrl(null)}>
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>
          {lightboxUrl && (
            <Image source={{ uri: lightboxUrl }} style={styles.lightboxImg} resizeMode="contain" />
          )}
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  postBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2563eb', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, gap: 4 },
  postBtnText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  list: { maxHeight: 240 },
  listContent: { paddingHorizontal: 16, gap: 10 },
  card: { width: 270, backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  cardKpi: { backgroundColor: '#fefce8', borderColor: '#fde68a' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  cardMeta: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  userName: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
  typeBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 },
  typeBadgeText: { fontSize: 9, fontWeight: '600' },
  time: { fontSize: 10, color: '#94a3b8', marginTop: 1 },
  content: { fontSize: 13, lineHeight: 20, color: '#334155', marginBottom: 8 },

  // Mini images in card
  miniImages: { flexDirection: 'row', gap: 4, marginBottom: 8 },
  miniImg: { width: 56, height: 56, borderRadius: 6 },
  moreOverlay: { width: 56, height: 56, borderRadius: 6, backgroundColor: 'rgba(0,0,0,.5)', justifyContent: 'center', alignItems: 'center' },
  moreText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  cardFooter: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 8 },
  visBadge: { fontSize: 10, color: '#94a3b8', flex: 1 },
  clientLink: { fontSize: 11, color: '#2563eb', flex: 1 },
  actions: { flexDirection: 'row', gap: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  actionCount: { fontSize: 12, color: '#94a3b8' },
  empty: { textAlign: 'center', color: '#94a3b8', padding: 20, fontSize: 13 },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  sendText: { fontSize: 15, fontWeight: '600', color: '#2563eb' },

  // Compose
  composeInput: { paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, minHeight: 80, textAlignVertical: 'top' },
  addPhotoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8 },
  addPhotoText: { fontSize: 13, color: '#2563eb' },
  imageSelector: { maxHeight: 90 },
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

  // Detail
  detailScroll: { maxHeight: '70%' },
  detailBody: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  detailContent: { fontSize: 15, lineHeight: 24, color: '#334155', marginBottom: 12 },
  detailImages: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 12 },
  detailImg: { width: (SCREEN_W - 48) / 3 - 4, height: (SCREEN_W - 48) / 3 - 4, borderRadius: 6 },
  detailActions: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  detailCommentCount: { fontSize: 13, color: '#94a3b8' },
  commentList: { paddingHorizontal: 16 },
  commentItem: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  commentUser: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
  commentReply: { fontSize: 12, color: '#2563eb' },
  commentBody: { fontSize: 13, color: '#334155', marginTop: 2 },
  emptyComments: { textAlign: 'center', color: '#94a3b8', padding: 16, fontSize: 13 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9', gap: 8 },
  commentInput: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 14, borderWidth: 1, borderColor: '#e2e8f0' },

  // Image grid in card
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 8 },
  feedImage: { borderRadius: 6 },

  // Lightbox
  lightbox: { flex: 1, backgroundColor: 'rgba(0,0,0,.95)', justifyContent: 'center', alignItems: 'center' },
  lightboxClose: { position: 'absolute', top: 50, right: 20, zIndex: 1 },
  lightboxImg: { width: '100%', height: '70%' },
});
