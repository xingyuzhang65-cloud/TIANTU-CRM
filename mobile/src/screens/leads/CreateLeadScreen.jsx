import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';

const LOGISTICS_TYPES = ['FBA', '一件代发', '小包', '空派', '海派'];
const TARGET_MARKETS = ['美国', '欧洲', '中东', '东南亚', '日韩', '澳洲', '南美', '非洲'];

export default function CreateLeadScreen({ navigation }) {
  const [form, setForm] = useState({
    company_name: '', contact_name: '', contact_mobile: '', phone: '',
    email: '', source: '', country: '', target_market: '', logistics_type: '', product_interest: '',
  });

  const handleChange = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    if (!form.company_name.trim() || !form.contact_mobile.trim()) {
      Alert.alert('提示', '公司名称和手机号为必填项');
      return;
    }
    try {
      const res = await client.post('/api/leads/create', form);
      if (res.ok) {
        Alert.alert('成功', res.msg, [{ text: '确定', onPress: () => navigation.goBack() }]);
      } else if (res.duplicate) {
        Alert.alert('重复提示', res.msg);
      } else {
        Alert.alert('提示', res.msg);
      }
    } catch (e) { Alert.alert('错误', e.message); }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>新建线索</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>公司名称 <Text style={styles.required}>*</Text></Text>
        <TextInput style={styles.input} placeholder="请输入公司名称" value={form.company_name} onChangeText={v => handleChange('company_name', v)} />

        <Text style={styles.label}>联系人</Text>
        <TextInput style={styles.input} placeholder="请输入联系人姓名" value={form.contact_name} onChangeText={v => handleChange('contact_name', v)} />

        <Text style={styles.label}>手机号 <Text style={styles.required}>*</Text></Text>
        <TextInput style={styles.input} placeholder="请输入手机号" keyboardType="phone-pad" value={form.contact_mobile} onChangeText={v => handleChange('contact_mobile', v)} />

        <Text style={styles.label}>邮箱</Text>
        <TextInput style={styles.input} placeholder="请输入邮箱" keyboardType="email-address" value={form.email} onChangeText={v => handleChange('email', v)} autoCapitalize="none" />

        <Text style={styles.label}>物流偏好</Text>
        <View style={styles.chipRow}>
          {LOGISTICS_TYPES.map(t => (
            <TouchableOpacity key={t} style={[styles.chip, form.logistics_type === t && styles.chipActive]} onPress={() => handleChange('logistics_type', t)}>
              <Text style={[styles.chipText, form.logistics_type === t && styles.chipTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>目标市场</Text>
        <View style={styles.chipRow}>
          {TARGET_MARKETS.slice(0, 6).map(m => (
            <TouchableOpacity key={m} style={[styles.chip, form.target_market === m && styles.chipActive]} onPress={() => handleChange('target_market', m)}>
              <Text style={[styles.chipText, form.target_market === m && styles.chipTextActive]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>线索来源</Text>
        <TextInput style={styles.input} placeholder="如: 展会/社媒/转介绍" value={form.source} onChangeText={v => handleChange('source', v)} />

        <Text style={styles.label}>国家</Text>
        <TextInput style={styles.input} placeholder="客户所在国家" value={form.country} onChangeText={v => handleChange('country', v)} />

        <Text style={styles.label}>意向产品 / 备注</Text>
        <TextInput style={[styles.input, styles.textArea]} multiline placeholder="可选填写" value={form.product_interest} onChangeText={v => handleChange('product_interest', v)} />

        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
          <Text style={styles.submitText}>创建线索</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, backgroundColor: '#fff' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#0f172a' },
  body: { flex: 1, paddingHorizontal: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#334155', marginTop: 16, marginBottom: 6 },
  required: { color: '#dc2626' },
  input: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, borderWidth: 1, borderColor: '#e2e8f0', color: '#0f172a' },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  chipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText: { fontSize: 13, color: '#64748b' },
  chipTextActive: { color: '#fff' },
  submitBtn: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 28 },
  submitText: { color: '#fff', fontSize: 17, fontWeight: '600' },
});
