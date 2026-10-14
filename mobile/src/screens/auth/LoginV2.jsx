import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { colors, ui } from '../../components/AppUI';

export default function LoginV2({ navigation }) {
  const { login } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('123456');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setError('');
    if (!username.trim() || !password.trim()) { setError('请输入账号和密码'); return; }
    setLoading(true);
    try { await login(username.trim(), password); } catch (e) { setError(e.message || '登录失败，请重试'); } finally { setLoading(false); }
  };
  return <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 30, paddingVertical: 44 }}><View style={[ui.row, { gap: 12, marginBottom: 48 }]}><View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="layers-outline" size={25} color="#fff" /></View><View><Text style={{ color: colors.ink, fontSize: 18, fontWeight: '700' }}>天图 CRM</Text><Text style={{ color: colors.muted, fontSize: 11, marginTop: 4, letterSpacing: 1 }}>跨境物流 · 销售工作台</Text></View></View><Text style={{ fontSize: 30, lineHeight: 42, fontWeight: '700', letterSpacing: -1, color: colors.ink }}>欢迎回来</Text><Text style={{ fontSize: 14, color: colors.muted, marginTop: 9, marginBottom: 34 }}>客户、报价与运单，都在你的掌握之中。</Text><Text style={{ fontSize: 13, color: colors.ink, fontWeight: '600', marginBottom: 8 }}>账号</Text><TextInput accessibilityLabel="账号" style={[ui.input, { backgroundColor: '#fff', minHeight: 52 }]} value={username} onChangeText={v => { setUsername(v); setError(''); }} placeholder="手机号 / 管理员账号" autoCapitalize="none" autoComplete="username" /><Text style={{ fontSize: 13, color: colors.ink, fontWeight: '600', marginTop: 22, marginBottom: 8 }}>密码</Text><View style={{ position: 'relative' }}><TextInput accessibilityLabel="密码" style={[ui.input, { backgroundColor: '#fff', minHeight: 52, paddingRight: 52 }]} value={password} onChangeText={v => { setPassword(v); setError(''); }} secureTextEntry={!showPassword} autoComplete="current-password" placeholder="请输入密码" onSubmitEditing={submit} /><Pressable accessibilityRole="button" accessibilityLabel="显示或隐藏密码" onPress={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 0, top: 0, width: 50, height: 52, justifyContent: 'center', alignItems: 'center' }}><Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={19} color={colors.muted} /></Pressable></View>{!!error && <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 13, lineHeight: 19, marginTop: 12 }}>{error}</Text>}<Pressable accessibilityRole="button" accessibilityLabel="登录" disabled={loading} onPress={submit} style={[ui.button, { minHeight: 52, marginTop: 30 }]}>{loading ? <ActivityIndicator color="#fff" /> : <><Text style={[ui.buttonText, { fontSize: 16 }]}>登录工作台</Text><Ionicons name="arrow-forward" size={18} color="#fff" /></>}</Pressable><Text style={{ textAlign: 'center', color: colors.muted, fontSize: 11, marginTop: 14 }}>演示账号 admin / 123456</Text><Pressable accessibilityRole="button" onPress={() => navigation.navigate('Register')} style={{ alignSelf: 'center', padding: 14, marginTop: 16 }}><Text style={{ fontSize: 13, color: colors.primary }}>还没有账号？立即注册</Text></Pressable><View style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: 24, marginTop: 36 }}><Text style={{ textAlign: 'center', color: '#9BA7B8', fontSize: 11 }}>天图跨境物流 · 连接客户，连接世界</Text></View></ScrollView></KeyboardAvoidingView>;
}
