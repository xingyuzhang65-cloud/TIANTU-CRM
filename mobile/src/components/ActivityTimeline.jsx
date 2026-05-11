import { View, Text, StyleSheet } from 'react-native';

const TYPE_ICONS = {
  call: '📞', visit: '🏢', meeting: '🤝', email: '📧',
  quote: '💰', complaint: '⚠️', status_change: '🔄',
};

export default function ActivityTimeline({ activities }) {
  if (!activities || activities.length === 0) return null;
  return (
    <View style={styles.container}>
      {activities.map((a, i) => (
        <View key={a.id || i} style={styles.row}>
          <View style={styles.line}>
            <Text style={styles.dot}>{TYPE_ICONS[a.activity_type] || '📌'}</Text>
            {i < activities.length - 1 && <View style={styles.connector} />}
          </View>
          <View style={styles.content}>
            <Text style={styles.text} numberOfLines={2}>{a.content}</Text>
            <View style={styles.meta}>
              <Text style={styles.by}>{a.created_by || ''}</Text>
              <Text style={styles.time}>{a.created_at?.slice(0, 16) || ''}</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 4 },
  row: { flexDirection: 'row', minHeight: 50 },
  line: { alignItems: 'center', width: 36 },
  dot: { fontSize: 16, marginTop: 2 },
  connector: { flex: 1, width: 2, backgroundColor: '#e2e8f0', marginVertical: 2 },
  content: { flex: 1, paddingBottom: 14, paddingLeft: 4 },
  text: { fontSize: 14, color: '#334155', lineHeight: 20 },
  meta: { flexDirection: 'row', marginTop: 4, gap: 12 },
  by: { fontSize: 11, color: '#64748b' },
  time: { fontSize: 11, color: '#94a3b8' },
});
