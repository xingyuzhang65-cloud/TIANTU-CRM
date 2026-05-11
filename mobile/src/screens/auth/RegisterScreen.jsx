import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!phone.trim() || !password.trim()) {
      Alert.alert('提示', '手机号和密码不能为空');
      return;
    }
    if (password.length < 6) {
      Alert.alert('提示', '密码至少6位');
      return;
    }
    if (password !== confirmPw) {
      Alert.alert('提示', '两次密码输入不一致');
      return;
    }
    setLoading(true);
    try {
      await register(phone.trim(), password, name.trim(), phone.trim());
    } catch (e) {
      Alert.alert('注册失败', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.header}>
          <Text style={styles.logo}>📝</Text>
          <Text style={styles.title}>创建账号</Text>
          <Text style={styles.subtitle}>加入跨境物流销售团队</Text>
        </View>
        <View style={styles.form}>
          <Text style={styles.label}>姓名</Text>
          <TextInput style={styles.input} placeholder="请输入您的姓名" value={name} onChangeText={setName} />
          <Text style={styles.label}>手机号</Text>
          <TextInput style={styles.input} placeholder="请输入手机号" keyboardType="phone-pad" value={phone} onChangeText={setPhone} autoCapitalize="none" />
          <Text style={styles.label}>密码</Text>
          <TextInput style={styles.input} placeholder="至少6位密码" secureTextEntry value={password} onChangeText={setPassword} />
          <Text style={styles.label}>确认密码</Text>
          <TextInput style={styles.input} placeholder="再次输入密码" secureTextEntry value={confirmPw} onChangeText={setConfirmPw} />
          <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>注 册</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.linkText}>已有账号？返回登录</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#f0f5ff', paddingBottom: 40 },
  header: { alignItems: 'center', paddingTop: 60, paddingBottom: 30 },
  logo: { fontSize: 48, marginBottom: 10 },
  title: { fontSize: 24, fontWeight: '700', color: '#1e3a5f' },
  subtitle: { fontSize: 14, color: '#6b7fa8', marginTop: 6 },
  form: { paddingHorizontal: 32 },
  label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 13, fontSize: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  btn: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 28 },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  linkBtn: { alignItems: 'center', marginTop: 18 },
  linkText: { color: '#2563eb', fontSize: 14 },
});
