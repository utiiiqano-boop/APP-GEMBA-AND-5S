import { View, Text, StyleSheet } from 'react-native';
export default function SettingsScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Configuration Entreprise</Text>
      <Text style={styles.sub}>Nom, logo, préférences — à venir</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  title: { fontSize: 24, fontWeight: '900', color: '#0F172A' },
  sub: { color: '#64748B', marginTop: 8 },
});
