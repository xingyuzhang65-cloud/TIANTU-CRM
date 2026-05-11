import { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';

const QUICK_ACTIONS = [
  { key: 'insight', label: '客户洞察', icon: '🔍', desc: '分析客户健康度与风险' },
  { key: 'quote', label: '智能报价', icon: '💰', desc: '快速估算运费' },
  { key: 'churn', label: '流失预警', icon: '⚠️', desc: '扫描高流失风险客户' },
  { key: 'voice', label: '语音录单', icon: '🎙️', desc: '模拟语音转销售记录' },
  { key: 'meeting', label: '会议总结', icon: '📋', desc: '生成拜访会议纪要' },
];

export default function AIAssistantScreen() {
  const [messages, setMessages] = useState([
    { type: 'bot', text: '你好！我是 ShareAI 智能助手，可以帮你：\n\n🔍 客户洞察\n💰 智能报价\n⚠️ 流失预警\n🎙️ 语音录单\n📋 会议总结\n\n请点击下方快捷操作或直接输入内容～' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const addMessage = (type, text) => {
    setMessages(prev => [...prev, { type, text }]);
  };

  const handleQuickAction = async (key) => {
    addMessage('user', `[快捷操作] ${QUICK_ACTIONS.find(a => a.key === key)?.label}`);
    setLoading(true);
    try {
      let res;
      switch (key) {
        case 'insight':
          res = await client.get('/api/ai/customer_insight', { params: { customer_id: 1 } });
          if (res.ok) {
            addMessage('bot', `📊 ${res.customer_name} 客户洞察\n\n风险等级: ${res.risk_level}\n健康评分: ${res.health_score}\n\n${res.insights?.join('\n\n')}\n\n💡 建议: ${res.risk_action}`);
          }
          break;
        case 'quote':
          res = await client.get('/api/ai/smart_quote', { params: { route_type: '海派', weight: 100, volume: 1, cargo_type: '普货', incoterms: 'FOB' } });
          if (res.ok) {
            addMessage('bot', `💰 智能报价结果\n\n运输方式: ${res.route_type}\n计费重量: ${res.chargeable_weight}kg\n预估价格: ¥${res.estimated_price}\n\n📋 费用明细:\n· 基础运费: ¥${res.breakdown?.base_freight}\n· 燃油附加: ¥${res.breakdown?.fuel_surcharge}\n· 预估总价: ¥${res.breakdown?.estimated_total}\n\n有效期至: ${res.valid_until}`);
          }
          break;
        case 'churn':
          res = await client.get('/api/ai/churn_prediction');
          if (res.ok) {
            const items = res.items?.slice(0, 5).map(i => `• ${i.company_name} (${i.risk_score}分) - ${i.factors?.join('，')}`).join('\n');
            addMessage('bot', `⚠️ 流失预警报告\n\n高风险客户: ${res.high_risk_count}家\n\n${items}\n\n建议优先跟进高风险客户。`);
          }
          break;
        case 'voice':
          res = await client.get('/api/ai/voice_log', { params: { customer_name: '思科达', content: '电话沟通确认发货需求' } });
          if (res.ok) {
            addMessage('bot', `🎙️ 语音录单结果\n\n${res.structured_log}\n\n质量检查:\n· 完整度: ${res.quality_check?.完整度}\n· 风险词汇: ${res.quality_check?.风险词汇}\n· 评分: ${res.quality_check?.评分}\n\n标签: ${res.auto_tags?.join('，')}`);
          }
          break;
        case 'meeting':
          res = await client.get('/api/ai/meeting_summary', { params: { meeting_type: '客户拜访' } });
          if (res.ok) {
            addMessage('bot', `📋 会议总结\n\n关键议题:\n${res.post_meeting?.key_topics?.map(t => `• ${t}`).join('\n')}\n\n待办事项:\n${res.post_meeting?.action_items?.map(a => `• ${a}`).join('\n')}\n\n${res.post_meeting?.risk_flag ? `⚠️ ${res.post_meeting.risk_flag}` : ''}\n\n${res.auto_fill_crm || ''}`);
          }
          break;
      }
    } catch (e) {
      addMessage('bot', `❌ 出错了: ${e.message}`);
    }
    setLoading(false);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    addMessage('user', text);
    setInput('');

    // Simple keyword matching
    if (text.includes('报价') || text.includes('运费')) {
      await handleQuickAction('quote');
    } else if (text.includes('洞察') || text.includes('分析') || text.includes('客户')) {
      await handleQuickAction('insight');
    } else if (text.includes('流失') || text.includes('预警') || text.includes('风险')) {
      await handleQuickAction('churn');
    } else if (text.includes('录单') || text.includes('语音') || text.includes('记录')) {
      await handleQuickAction('voice');
    } else if (text.includes('会议') || text.includes('总结') || text.includes('复盘')) {
      await handleQuickAction('meeting');
    } else {
      addMessage('bot', '你可以尝试以下指令：\n\n• "查看客户洞察"\n• "计算运费报价"\n• "流失预警分析"\n• "语音录单"\n• "会议总结"\n\n或者点击下方快捷操作按钮～');
    }
  };

  const renderMessage = ({ item }) => (
    <View style={[styles.msgBubble, item.type === 'user' ? styles.userBubble : styles.botBubble]}>
      <Text style={[styles.msgText, item.type === 'user' ? styles.userText : styles.botText]}>{item.text}</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Text style={styles.title}>AI 智能助手</Text>
        <Text style={styles.subtitle}>ShareAI · 跨境物流智能工作台</Text>
      </View>

      <View style={styles.actionsRow}>
        <FlatList
          horizontal
          data={QUICK_ACTIONS}
          keyExtractor={a => a.key}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item: a }) => (
            <TouchableOpacity style={styles.actionChip} onPress={() => handleQuickAction(a.key)} disabled={loading}>
              <Text style={styles.actionIcon}>{a.icon}</Text>
              <Text style={styles.actionLabel}>{a.label}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <FlatList
        data={messages}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderMessage}
        style={styles.msgList}
        contentContainerStyle={{ padding: 12 }}
        ListFooterComponent={loading ? <ActivityIndicator style={{ padding: 10 }} color="#2563eb" /> : null}
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="输入指令，如：查看客户洞察"
          value={input}
          onChangeText={setInput}
          multiline
        />
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={loading}>
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 10, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  subtitle: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  actionsRow: { backgroundColor: '#fff', paddingBottom: 12, paddingLeft: 12 },
  actionChip: { alignItems: 'center', backgroundColor: '#f1f5ff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginRight: 8 },
  actionIcon: { fontSize: 22 },
  actionLabel: { fontSize: 11, color: '#64748b', marginTop: 4 },
  msgList: { flex: 1 },
  msgBubble: { maxWidth: '85%', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#2563eb' },
  botBubble: { alignSelf: 'flex-start', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  msgText: { fontSize: 14, lineHeight: 22 },
  userText: { color: '#fff' },
  botText: { color: '#334155' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  input: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, maxHeight: 80, borderWidth: 1, borderColor: '#e2e8f0' },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
});
