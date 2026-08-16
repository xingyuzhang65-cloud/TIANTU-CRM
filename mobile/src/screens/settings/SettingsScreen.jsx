import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  Alert, ActivityIndicator, Modal, KeyboardAvoidingView, Platform,
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
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

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

  const closePasswordModal = () => {
    if (changingPassword) return;
    setPasswordModalVisible(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswords(false);
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('提示', '请完整填写三个密码字段');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('提示', '新密码至少6位');
      return;
    }
    if (newPassword.length > 128) {
      Alert.alert('提示', '新密码不能超过128位');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('提示', '两次输入的新密码不一致');
      return;
    }
    if (currentPassword === newPassword) {
      Alert.alert('提示', '新密码不能与当前密码相同');
      return;
    }

    setChangingPassword(true);
    try {
      const res = await client.post('/api/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      if (!res.ok) throw new Error(res.msg || '修改密码失败');
      setPasswordModalVisible(false);
      Alert.alert('修改成功', '请使用新密码重新登录');
      await logout();
    } catch (e) {
      Alert.alert('修改失败', e.message);
    } finally {
      setChangingPassword(false);
    }
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

      <View style={styles.securitySection}>
        <Text style={styles.sectionTitle}>账号安全</Text>
        <TouchableOpacity style={styles.securityCard} onPress={() => setPasswordModalVisible(true)}>
          <View style={styles.securityIcon}>
            <Ionicons name="key-outline" size={21} color="#2563eb" />
          </View>
          <View style={styles.securityInfo}>
            <Text style={styles.securityTitle}>修改密码</Text>
            <Text style={styles.securityDesc}>定期更新密码，保障账号安全</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
        </TouchableOpacity>
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

      <Modal visible={passwordModalVisible} transparent animationType="fade" onRequestClose={closePasswordModal}>
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>修改密码</Text>
                <Text style={styles.modalSubtitle}>修改后需要重新登录</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={closePasswordModal} disabled={changingPassword}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.passwordLabel}>当前密码</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                placeholder="请输入当前密码"
                secureTextEntry={!showPasswords}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                autoCapitalize="none"
              />
            </View>

            <Text style={styles.passwordLabel}>新密码</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                placeholder="至少6位"
                secureTextEntry={!showPasswords}
                value={newPassword}
                onChangeText={setNewPassword}
                autoCapitalize="none"
              />
            </View>

            <Text style={styles.passwordLabel}>确认新密码</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                placeholder="请再次输入新密码"
                secureTextEntry={!showPasswords}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                autoCapitalize="none"
                onSubmitEditing={handleChangePassword}
              />
            </View>

            <TouchableOpacity style={styles.visibilityRow} onPress={() => setShowPasswords(!showPasswords)}>
              <Ionicons name={showPasswords ? 'eye-off-outline' : 'eye-outline'} size={18} color="#64748b" />
              <Text style={styles.visibilityText}>{showPasswords ? '隐藏密码' : '显示密码'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.passwordSubmit} onPress={handleChangePassword} disabled={changingPassword}>
              {changingPassword ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="shield-checkmark-outline" size={19} color="#fff" />
                  <Text style={styles.passwordSubmitText}>确认修改</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  securitySection: { marginTop: 20, paddingHorizontal: 16 },
  securityCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#eef2f7' },
  securityIcon: { width: 38, height: 38, borderRadius: 8, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  securityInfo: { flex: 1, marginLeft: 12 },
  securityTitle: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  securityDesc: { fontSize: 12, color: '#94a3b8', marginTop: 3 },
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
  modalBackdrop: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(15,23,42,.48)', padding: 22 },
  modalCard: { width: '100%', maxWidth: 420, alignSelf: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 18 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  modalTitle: { fontSize: 19, fontWeight: '700', color: '#0f172a' },
  modalSubtitle: { fontSize: 12, color: '#64748b', marginTop: 3 },
  closeButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  passwordLabel: { fontSize: 13, fontWeight: '600', color: '#334155', marginTop: 13, marginBottom: 6 },
  passwordRow: { flexDirection: 'row', alignItems: 'center' },
  passwordInput: { flex: 1, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 13, paddingVertical: 12, fontSize: 15, color: '#0f172a' },
  visibilityRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, alignSelf: 'flex-start' },
  visibilityText: { fontSize: 12, color: '#64748b' },
  passwordSubmit: { minHeight: 46, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2563eb', borderRadius: 8, marginTop: 20 },
  passwordSubmitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
