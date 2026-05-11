import { View, Text, StyleSheet } from 'react-native';

const COLORS = {
  blue: ['#eff6ff', '#2563eb'],
  green: ['#f0fdf4', '#16a34a'],
  yellow: ['#fefce8', '#ca8a04'],
  red: ['#fef2f2', '#dc2626'],
  purple: ['#faf5ff', '#9333ea'],
  gray: ['#f8fafc', '#64748b'],
  orange: ['#fff7ed', '#ea580c'],
};

export default function StatusBadge({ label, color = 'blue', size = 'sm' }) {
  const [bg, text] = COLORS[color] || COLORS.blue;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: text, fontSize: size === 'lg' ? 14 : 11 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
  text: { fontWeight: '600' },
});
