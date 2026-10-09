import { View, Text, StyleSheet } from 'react-native';
export default function Audit5SScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Audit 5S</Text>
      <Text style={styles.sub}>Bientôt disponible</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  title: { fontSize: 28, fontWeight: '900', color: '#0F172A' },
  sub: { color: '#64748B', marginTop: 8 },
});
