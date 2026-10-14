import { useEffect, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { colors, ui } from './AppUI';

export default function AppFeedback() {
  const [dialog, setDialog] = useState(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const original = Alert.alert;
    Alert.alert = (title, message, buttons) => setDialog({ title, message, buttons: buttons?.length ? buttons : [{ text: '知道了' }] });
    return () => { Alert.alert = original; };
  }, []);
  return <Modal visible={!!dialog} transparent animationType="fade" onRequestClose={() => setDialog(null)}><View style={[ui.overlay, { justifyContent: 'center', padding: 24 }]}><View accessibilityRole="alert" style={[ui.card, { width: '100%', maxWidth: 360, padding: 24 }]}><Text style={{ color: colors.ink, fontWeight: '700', fontSize: 19 }}>{dialog?.title}</Text><ScrollView style={{ maxHeight: 300, marginVertical: 16 }}><Text style={{ fontSize: 14, lineHeight: 23, color: colors.muted }}>{dialog?.message}</Text></ScrollView><View style={{ flexDirection: 'row', gap: 10 }}>{dialog?.buttons.map((button, index) => <Pressable key={index} accessibilityRole="button" onPress={() => { setDialog(null); button.onPress?.(); }} style={[ui.button, { flex: 1, backgroundColor: button.style === 'cancel' ? '#EFF2F7' : button.style === 'destructive' ? colors.danger : colors.primary }]}><Text style={[ui.buttonText, button.style === 'cancel' && { color: colors.muted }]}>{button.text || '确定'}</Text></Pressable>)}</View></View></View></Modal>;
}

export async function copyText(text) {
  if (Platform.OS === 'web') {
    try { await navigator.clipboard.writeText(text); Alert.alert('复制成功', '内容已复制到剪贴板'); }
    catch { Alert.alert('请复制以下内容', text); }
  } else Alert.alert('内容', text);
}

export async function localImageUrls(images) {
  return Promise.all(images.map(async image => {
    const blob = image._file || await (await fetch(image.uri)).blob();
    if (blob.size > 2000000) throw new Error('请选择 2MB 以内的图片');
    return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
  }));
}
