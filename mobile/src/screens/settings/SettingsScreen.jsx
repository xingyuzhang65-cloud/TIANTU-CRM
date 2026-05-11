import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const [config, setConfig] = useState({
    reclaim_no_follow_days: '7',
    reclaim_no_convert_days: '30',
    claim_daily_limit: '5',
    claim_private_limit: '50',
  });
  const [saving, setSaving] = useState(false);
  const [reclaiming, setReclaiming] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await client.get('/api/config');
        if (res.ok) setConfig(prev => ({ ...prev, ...res.config }));
      } catch {}
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await client.post('/api/config', {
        reclaim_no_follow_days: String(config.reclaim_no_follow_days),
        reclaim_no_convert_days: String(config.reclaim_no_convert_days),
        claim_daily_limit: String(config.claim_daily_limit),
        claim_private_limit: String(config.claim_private_limit),
      });
      if (res.ok) Alert.alert('成功', '配置已保存');
    } catch (e) { Alert.alert('错误', e.message); }
    setSaving(false);
  };

  const handleReclaim = async () => {
    setReclaiming(true);
    try {
      const res = await client.post('/api/leads/reclaim');
      if (res.ok) Alert.alert('成功', `已回收 ${res.reclaimed} 条线索`);
    } catch (e) { Alert.alert('错误', e.message); }
    setReclaiming(false);
  };

  const handleLogout = () => {
    Alert.alert('退出登录', '确定要退出吗？', [
      { text: '取消', style: 'cancel' },
      { text: '确定', onPress: logout },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>设置</Text>
      </View>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(user?.name || 'U')[0]}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{user?.name || '用户'}</Text>
          <Text style={styles.profilePhone}>{user?.phone || user?.username || ''}</Text>
          <Text style={styles.profileRole}>{user?.role === 'admin' ? '管理员' : '销售顾问'}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>公海池参数配置</Text>
        <View style={styles.configCard}>
          <View style={styles.configRow}>
            <View style={styles.configLabel}>
              <Text style={styles.configTitle}>未跟进回收 (N天)</Text>
              <Text style={styles.configDesc}>线索N天未跟进自动回公海</Text>
            </View>
            <TextInput style={styles.configInput} keyboardType="numeric" value={config.reclaim_no_follow_days} onChangeText={v => setConfig({ ...config, reclaim_no_follow_days: v })} />
          </View>
          <View style={styles.configRow}>
            <View style={styles.configLabel}>
              <Text style={styles.configTitle}>未转化回收 (M天)</Text>
              <Text style={styles.configDesc}>线索M天未转化自动回公海</Text>
            </View>
            <TextInput style={styles.configInput} keyboardType="numeric" value={config.reclaim_no_convert_days} onChangeText={v => setConfig({ ...config, reclaim_no_convert_days: v })} />
          </View>
          <View style={styles.configRow}>
            <View style={styles.configLabel}>
              <Text style={styles.configTitle}>每日认领上限 (X条)</Text>
              <Text style={styles.configDesc}>每人每天最多认领线索数</Text>
            </View>
            <TextInput style={styles.configInput} keyboardType="numeric" value={config.claim_daily_limit} onChangeText={v => setConfig({ ...config, claim_daily_limit: v })} />
          </View>
          <View style={[styles.configRow, { borderBottomWidth: 0 }]}>
            <View style={styles.configLabel}>
              <Text style={styles.configTitle}>私海容量上限 (Y条)</Text>
              <Text style={styles.configDesc}>每人私海最多持有线索数</Text>
            </View>
            <TextInput style={styles.configInput} keyboardType="numeric" value={config.claim_private_limit} onChangeText={v => setConfig({ ...config, claim_private_limit: v })} />
          </View>
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>保存配置</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.reclaimBtn} onPress={handleReclaim} disabled={reclaiming}>
          {reclaiming ? <ActivityIndicator color="#fff" /> : <Text style={styles.reclaimText}>手动回收线索</Text>}
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color="#dc2626" />
        <Text style={styles.logoutText}>退出登录</Text>
      </TouchableOpacity>

      <Text style={styles.version}>跨境物流CRM v1.0 · Mobile</Text>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginTop: 16, borderRadius: 12, padding: 16, gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 24, fontWeight: '700', color: '#fff' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '600', color: '#0f172a' },
  profilePhone: { fontSize: 13, color: '#64748b', marginTop: 2 },
  profileRole: { fontSize: 12, color: '#2563eb', marginTop: 2 },
  section: { marginTop: 20, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginBottom: 10 },
  configCard: { backgroundColor: '#fff', borderRadius: 12, padding: 4 },
  configRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  configLabel: { flex: 1 },
  configTitle: { fontSize: 14, fontWeight: '600', color: '#334155' },
  configDesc: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  configInput: { backgroundColor: '#f8fafc', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 16, fontWeight: '600', color: '#2563eb', textAlign: 'center', minWidth: 60, borderWidth: 1, borderColor: '#e2e8f0' },
  saveBtn: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  saveText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  reclaimBtn: { backgroundColor: '#16a34a', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  reclaimText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  logoutBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginHorizontal: 16, marginTop: 24, paddingVertical: 14, borderRadius: 10, backgroundColor: '#fef2f2', gap: 6 },
  logoutText: { color: '#dc2626', fontWeight: '600', fontSize: 15 },
  version: { textAlign: 'center', marginTop: 16, fontSize: 12, color: '#cbd5e1' },
});
