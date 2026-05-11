import { View, Text, StyleSheet } from 'react-native';

export default function StatCard({ title, value, sub, color = '#2563eb', bg = '#eff6ff' }) {
  return (
    <View style={[styles.card, { backgroundColor: bg, borderLeftColor: color }]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={[styles.value, { color }]}>{value}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    margin: 5,
    borderLeftWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  title: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  value: { fontSize: 22, fontWeight: '700' },
  sub: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
});
