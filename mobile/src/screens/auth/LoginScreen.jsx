import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('提示', '请输入手机号和密码');
      return;
    }
    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (e) {
      Alert.alert('登录失败', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <Text style={styles.logo}>🚢</Text>
        <Text style={styles.title}>跨境物流CRM</Text>
        <Text style={styles.subtitle}>销售团队移动工作台</Text>
      </View>
      <View style={styles.form}>
        <Text style={styles.label}>手机号</Text>
        <TextInput
          style={styles.input}
          placeholder="请输入手机号"
          keyboardType="phone-pad"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
        <Text style={styles.label}>密码</Text>
        <View style={styles.pwRow}>
          <TextInput
            style={[styles.input, styles.pwInput]}
            placeholder="请输入密码"
            secureTextEntry={!showPw}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity style={styles.pwToggle} onPress={() => setShowPw(!showPw)}>
            <Text>{showPw ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>登 录</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate('Register')}>
          <Text style={styles.linkText}>还没有账号？立即注册</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f5ff' },
  header: { alignItems: 'center', paddingTop: 100, paddingBottom: 40 },
  logo: { fontSize: 64, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '700', color: '#1e3a5f' },
  subtitle: { fontSize: 14, color: '#6b7fa8', marginTop: 6 },
  form: { paddingHorizontal: 32 },
  label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 6, marginTop: 16 },
  input: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  pwRow: { flexDirection: 'row', alignItems: 'center' },
  pwInput: { flex: 1 },
  pwToggle: { position: 'absolute', right: 16, top: 14 },
  btn: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 32 },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  linkBtn: { alignItems: 'center', marginTop: 20 },
  linkText: { color: '#2563eb', fontSize: 14 },
});
