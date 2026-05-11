import { View, Text, StyleSheet } from 'react-native';

export default function EmptyState({ icon = '📭', title = '暂无数据', desc = '' }) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      {desc ? <Text style={styles.desc}>{desc}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  icon: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '600', color: '#64748b' },
  desc: { fontSize: 13, color: '#94a3b8', marginTop: 6, textAlign: 'center' },
});
