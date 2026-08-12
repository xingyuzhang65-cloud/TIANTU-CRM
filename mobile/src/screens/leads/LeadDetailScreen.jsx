import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  Alert, ActivityIndicator, Modal, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import client, { resolveBackendUrl } from '../../api/client';
import StatusBadge from '../../components/StatusBadge';

const FOLLOW_STATUSES = ['未联系', '初步沟通', '意向强烈', '暂无意向', '无效信息'];
const POOL_COLORS = { 0: 'blue', 1: 'yellow', 2: 'green' };
const POOL_LABELS = { 0: '公海', 1: '私海', 2: '已转化' };

export default function LeadDetailScreen({ route, navigation }) {
  const { leadId } = route.params;
  const [lead, setLead] = useState(null);
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFollowForm, setShowFollowForm] = useState(false);
  const [followStatus, setFollowStatus] = useState('初步沟通');
  const [followContent, setFollowContent] = useState('');
  const [nextFollow, setNextFollow] = useState('');
  const [followImages, setFollowImages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  const fetchDetail = async () => {
    try {
      const res = await client.get(`/api/leads/${leadId}`);
      if (res.ok) {
        setLead(res.lead);
        setFollowUps(res.follow_ups || []);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchDetail(); }, [leadId]);

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

  const handleFollowUp = async () => {
    if (!followContent.trim()) { Alert.alert('提示', '请输入跟进内容'); return; }
    setSaving(true);
    try {
      const imageUrls = await uploadImages();
      const res = await client.post(`/api/leads/${leadId}/follow-up`, {
        status: followStatus, content: followContent,
        image_urls: JSON.stringify(imageUrls),
        next_follow_at: nextFollow || '', created_by: '张晓明',
      });
      if (res.ok) {
        Alert.alert('成功', res.msg);
        setShowFollowForm(false);
        setFollowContent('');
        setFollowImages([]);
        fetchDetail();
      }
    } catch (e) { Alert.alert('错误', e.message); }
    setSaving(false);
  };

  const handleConvert = async (type) => {
    try {
      const res = await client.post(`/api/leads/${leadId}/convert`, {
        convert_type: type, operator: '张晓明',
      });
      if (res.ok) { Alert.alert('成功', res.msg); fetchDetail(); }
      else Alert.alert('提示', res.msg);
    } catch (e) { Alert.alert('错误', e.message); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#2563eb" /></View>;
  if (!lead) return <View style={styles.center}><Text>信息加载失败</Text></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>线索详情</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.body}>
        <View style={styles.topCard}>
          <View style={styles.topRow}>
            <Text style={styles.company}>{lead.company_name}</Text>
            <StatusBadge label={POOL_LABELS[lead.lead_status] || ''} color={POOL_COLORS[lead.lead_status] || 'gray'} size="lg" />
          </View>
          {lead.reclaim_countdown_hours !== null && lead.reclaim_countdown_hours !== undefined && (
            <Text style={[styles.countdownBanner, lead.reclaim_countdown_hours < 24 && styles.urgentBanner]}>
              回收倒计时: {lead.reclaim_countdown_hours} 小时
            </Text>
          )}
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoItem}><Text style={styles.infoLabel}>联系人</Text><Text style={styles.infoVal}>{lead.contact_name || '-'}</Text></View>
          <View style={styles.infoItem}><Text style={styles.infoLabel}>手机号</Text><Text style={styles.infoVal}>{lead.contact_mobile}</Text></View>
          <View style={styles.infoItem}><Text style={styles.infoLabel}>邮箱</Text><Text style={styles.infoVal}>{lead.email || '-'}</Text></View>
          <View style={styles.infoItem}><Text style={styles.infoLabel}>目标市场</Text><Text style={styles.infoVal}>{lead.target_market || '-'}</Text></View>
          <View style={styles.infoItem}><Text style={styles.infoLabel}>物流偏好</Text><Text style={styles.infoVal}>{lead.logistics_type || '-'}</Text></View>
          <View style={styles.infoItem}><Text style={styles.infoLabel}>负责人</Text><Text style={styles.infoVal}>{lead.owner || '未分配'}</Text></View>
        </View>

        {lead.lead_status === 1 && (
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionBtn, styles.convertBtn]} onPress={() => handleConvert('customer')}>
              <Text style={styles.actionBtnText}>转为客户</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>跟进记录 ({followUps.length})</Text>
            <TouchableOpacity style={styles.addFollowBtn} onPress={() => setShowFollowForm(true)}>
              <Ionicons name="add-circle-outline" size={22} color="#2563eb" />
            </TouchableOpacity>
          </View>
          {followUps.map((f, i) => {
            const isSystem = f.created_by === '系统' || f.status === '新建';
            return (
            <View key={f.id || i} style={styles.followCard}>
              <View style={styles.timelineRow}>
                <View style={[styles.timelineDot, isSystem && { backgroundColor: '#94a3b8' }]} />
                <View style={styles.timelineLine} />
              </View>
              <View style={styles.followBody}>
                <View style={styles.followHeader}>
                  <StatusBadge label={f.status} color={isSystem ? 'gray' : 'blue'} />
                  <View style={styles.followMeta}>
                    {isSystem && <Text style={styles.systemTag}>系统</Text>}
                    <Text style={styles.followBy}>{f.created_by}</Text>
                  </View>
                </View>
                <Text style={styles.followContent}>{f.content}</Text>
              {f.image_urls ? (
                <View style={styles.followImages}>
                  {(function() {
                    try {
                      const urls = JSON.parse(f.image_urls);
                      return urls.map((url, idx) => (
                        <TouchableOpacity key={idx} onPress={() => setPreviewImage(resolveImageUrl(url))}>
                          <Image source={{ uri: resolveImageUrl(url) }} style={styles.followThumb} />
                        </TouchableOpacity>
                      ));
                    } catch(e) { return null; }
                  })()}
                </View>
              ) : null}
              <Text style={styles.followTime}>{f.created_at?.slice(0, 16)}</Text>
            </View>
          </View>
          );})}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={showFollowForm} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>添加跟进</Text>
            <ScrollView style={{ maxHeight: '100%' }} showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>跟进状态</Text>
              <View style={styles.statusRow}>
                {FOLLOW_STATUSES.map(s => (
                  <TouchableOpacity key={s} style={[styles.statusChip, followStatus === s && styles.statusChipActive]} onPress={() => setFollowStatus(s)}>
                    <Text style={[styles.statusChipText, followStatus === s && styles.statusChipTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>跟进内容</Text>
              <TextInput style={styles.textArea} multiline placeholder="请输入跟进内容..." value={followContent} onChangeText={setFollowContent} />
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
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowFollowForm(false)}>
                  <Text style={styles.cancelText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.5 }]} onPress={handleFollowUp} disabled={saving}>
                  <Text style={styles.saveText}>{saving ? '保存中...' : '保存'}</Text>
                </TouchableOpacity>
              </View>
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
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#0f172a' },
  body: { flex: 1 },
  topCard: { backgroundColor: '#fff', margin: 16, borderRadius: 12, padding: 16 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  company: { fontSize: 20, fontWeight: '700', color: '#0f172a', flex: 1 },
  countdownBanner: { marginTop: 10, fontSize: 13, color: '#f59e0b', fontWeight: '600', backgroundColor: '#fefce8', padding: 8, borderRadius: 8, overflow: 'hidden' },
  urgentBanner: { color: '#dc2626', backgroundColor: '#fef2f2' },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 12, padding: 12 },
  infoItem: { width: '50%', padding: 8 },
  infoLabel: { fontSize: 11, color: '#94a3b8', marginBottom: 2 },
  infoVal: { fontSize: 15, color: '#334155', fontWeight: '500' },
  actionRow: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 12, gap: 10 },
  actionBtn: { flex: 1, backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  convertBtn: { backgroundColor: '#16a34a' },
  actionBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  section: { marginTop: 20, paddingHorizontal: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  addFollowBtn: { padding: 4 },
  followCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 10, paddingVertical: 10, paddingRight: 12, marginBottom: 8 },
  timelineRow: { width: 30, alignItems: 'center', paddingTop: 4 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2563eb', zIndex: 1 },
  timelineLine: { flex: 1, width: 2, backgroundColor: '#e2e8f0', marginTop: -2 },
  followBody: { flex: 1 },
  followHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  followMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  systemTag: { fontSize: 10, fontWeight: '600', color: '#94a3b8', backgroundColor: '#f1f5f9', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, overflow: 'hidden' },
  followBy: { fontSize: 12, color: '#94a3b8' },
  followContent: { fontSize: 14, color: '#334155', lineHeight: 20 },
  followTime: { fontSize: 11, color: '#94a3b8', marginTop: 6 },
  followImages: { flexDirection: 'row', gap: 6, marginTop: 6 },
  followThumb: { width: 64, height: 64, borderRadius: 6, backgroundColor: '#f1f5f9' },
  // Modal — centered card
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modal: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 500, maxHeight: '85%' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8, marginTop: 12 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  statusChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  statusChipText: { fontSize: 13, color: '#64748b' },
  statusChipTextActive: { color: '#fff' },
  textArea: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 12, fontSize: 14, minHeight: 80, borderWidth: 1, borderColor: '#e2e8f0', textAlignVertical: 'top' },
  // Image picker
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  imageWrapper: { position: 'relative' },
  thumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: '#f1f5f9' },
  removeImgBtn: { position: 'absolute', top: -6, right: -6 },
  addImgBtn: { width: 72, height: 72, borderRadius: 8, borderWidth: 1.5, borderColor: '#e2e8f0', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  addImgText: { fontSize: 10, color: '#94a3b8', marginTop: 2 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#f1f5f9' },
  cancelText: { color: '#64748b', fontWeight: '600' },
  saveBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#2563eb' },
  saveText: { color: '#fff', fontWeight: '600' },
  // Full image preview
  previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  previewCloseBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
  previewImage: { width: '100%', height: '80%' },
});
