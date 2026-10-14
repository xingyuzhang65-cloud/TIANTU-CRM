import { Platform, View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const colors = { ink: '#182B43', muted: '#78869A', primary: '#2458D3', navy: '#1E3A5F', bg: '#F4F6FA', border: '#E7ECF2', light: '#EDF2FF', success: '#18836A', warning: '#B77418', danger: '#C54949' };
export const APP_WIDTH = 480;
export function createAppStyles(styles) {
  const palette = { '#2563eb': colors.primary, '#0f172a': colors.ink, '#334155': colors.ink, '#64748b': colors.muted, '#94a3b8': '#96A3B6', '#f8fafc': colors.bg, '#e2e8f0': colors.border, '#16a34a': colors.success, '#dc2626': colors.danger, '#ea580c': colors.warning };
  const convert = value => typeof value === 'string' ? palette[value.toLowerCase()] || value : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, v]) => [key, convert(v)])) : value;
  const result = convert(styles);
  if (result.header) Object.assign(result.header, { paddingTop: 24, paddingHorizontal: 22, paddingBottom: 20, backgroundColor: colors.bg });
  if (result.title) Object.assign(result.title, { fontSize: 25, letterSpacing: -.5, color: colors.ink });
  for (const key of ['card', 'profileCard', 'configCard', 'securityCard', 'topCard', 'kycCard', 'infoGrid', 'creditCard']) if (result[key]) Object.assign(result[key], { borderRadius: 18, borderWidth: 1, borderColor: colors.border, shadowOpacity: 0, elevation: 0 });
  if (result.profileCard) result.profileCard.marginHorizontal = 22;
  if (result.topCard) Object.assign(result.topCard, { margin: 22, padding: 18 });
  if (result.section) result.section.paddingHorizontal = 22;
  if (result.infoGrid) result.infoGrid.marginHorizontal = 22;
  if (result.metricsRow) result.metricsRow.paddingHorizontal = 17;
  if (result.chart) result.chart.marginLeft = 0;
  if (result.configInput) Object.assign(result.configInput, { width: 74, minWidth: 74, flexBasis: 74, flexGrow: 0, flexShrink: 0 });
  if (result.configLabel) result.configLabel.paddingRight = 14;
  if (result.cardKpi) Object.assign(result.cardKpi, { backgroundColor: '#fff', borderColor: colors.border });
  if (result.listContent) result.listContent.paddingHorizontal = 0;
  if (result.card) Object.assign(result.card, { marginHorizontal: 22, padding: 17, marginTop: 0, marginBottom: 12 });
  if (result.segmentedBar) Object.assign(result.segmentedBar, { marginHorizontal: 22, marginTop: 0, marginBottom: 14, padding: 4, borderRadius: 12, backgroundColor: '#E9EEF5' });
  if (result.segment) Object.assign(result.segment, { minHeight: 38, justifyContent: 'center', borderRadius: 9 });
  if (result.searchBox) Object.assign(result.searchBox, { marginHorizontal: 22, marginTop: 0, marginBottom: 14, minHeight: 44, borderRadius: 12 });
  if (result.filterRow) Object.assign(result.filterRow, { backgroundColor: colors.bg, paddingHorizontal: 22, paddingBottom: 14, flexWrap: 'wrap', gap: 7 });
  if (result.filterChip) Object.assign(result.filterChip, { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 9, backgroundColor: '#E9EEF5' });
  if (result.filterChipText) result.filterChipText.fontSize = 11;
  for (const key of ['modalContent', 'formModal', 'detailModal', 'actionSheet']) if (result[key]) Object.assign(result[key], { width: '100%', maxWidth: APP_WIDTH, alignSelf: 'center' });
  return StyleSheet.create(result);
}
export const useContentWidth = () => Math.min(useWindowDimensions().width, Platform.OS === 'web' ? APP_WIDTH : 10000);

export function IconButton({ name, onPress, label, primary = false }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [ui.iconButton, primary && { backgroundColor: colors.primary }, pressed && { opacity: .7 }]}><Ionicons name={name} size={20} color={primary ? '#fff' : colors.ink} /></Pressable>;
}

export function ScreenHeader({ title, subtitle, children, back }) {
  return <View style={ui.header}>{back && <IconButton name="chevron-back" label="返回" onPress={back} />}<View style={{ flex: 1 }}><Text accessibilityRole="header" style={ui.title}>{title}</Text>{subtitle && <Text style={ui.subtitle}>{subtitle}</Text>}</View>{children}</View>;
}

export function SectionTitle({ title, action, onPress, count }) {
  return <View style={ui.sectionTitle}><View style={ui.row}><Text style={ui.sectionText}>{title}</Text>{count != null && <Text style={ui.count}>{count}</Text>}</View>{action && <Pressable accessibilityRole="button" onPress={onPress} style={ui.sectionAction}><Text style={ui.actionText}>{action}</Text><Ionicons name="chevron-forward" size={14} color={colors.muted} /></Pressable>}</View>;
}

export function Pill({ label, selected, onPress, count, tone }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[ui.pill, selected && ui.pillSelected]}><Text style={[ui.pillText, selected && { color: colors.primary }]}>{label}</Text>{count != null && <Text style={[ui.pillCount, selected && { color: colors.primary }]}>{count}</Text>}</Pressable>;
}

export function Tag({ label, tone = 'muted' }) {
  const color = colors[tone] || colors.muted;
  return <View style={[ui.tag, { backgroundColor: `${color}12` }]}><Text style={{ fontSize: 11, fontWeight: '600', color }}>{label}</Text></View>;
}

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 22, paddingTop: 24, paddingBottom: 20, backgroundColor: colors.bg },
  title: { fontSize: 25, fontWeight: '700', color: colors.ink, letterSpacing: -.5 },
  subtitle: { fontSize: 12, color: colors.muted, marginTop: 6, lineHeight: 18 },
  iconButton: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 24 },
  sectionText: { fontSize: 17, fontWeight: '700', color: colors.ink },
  count: { fontSize: 11, fontWeight: '600', color: colors.muted, backgroundColor: '#E8EDF4', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 6 },
  actionText: { color: colors.muted, fontSize: 12 },
  card: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 18 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 38, paddingHorizontal: 13, borderRadius: 11, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
  pillSelected: { borderColor: '#D7E2FF', backgroundColor: colors.light },
  pillText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  pillCount: { fontSize: 11, fontWeight: '600', color: '#9AA6B7' },
  tag: { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6 },
  input: { minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: '#F8FAFC', paddingHorizontal: 13, paddingVertical: 12, color: colors.ink, fontSize: 14 },
  button: { minHeight: 46, paddingHorizontal: 18, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  overlay: { flex: 1, backgroundColor: 'rgba(18,32,52,.4)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: APP_WIDTH, maxHeight: '88%', backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22 },
});
