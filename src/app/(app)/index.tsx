import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../features/auth/AuthProvider';

const CARDS = [
  {
    title: 'Audit Gemba',
    subtitle: 'Évaluation terrain des 5M',
    colors: ['#3B82F6', '#2563EB'] as const,
    route: '/(app)/gemba',
  },
  {
    title: 'Audit 5S',
    subtitle: 'Organisation & standards',
    colors: ['#10B981', '#059669'] as const,
    route: '/(app)/audit5s',
  },
  {
    title: 'Utilisateurs',
    subtitle: 'Gérer les membres',
    colors: ['#8B5CF6', '#7C3AED'] as const,
    route: '/(app)/users',
  },
  {
    title: 'Configuration Entreprise',
    subtitle: 'Nom, logo, paramètres',
    colors: ['#F59E0B', '#D97706'] as const,
    route: '/(app)/settings',
  },
];

export default function HomeScreen() {
  const { user } = useAuth();

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Animated.View entering={FadeInDown.duration(500)} style={styles.hero}>
        <Text style={styles.hello}>Bienvenue</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <Text style={styles.hint}>Sélectionnez une action ci-dessous</Text>
      </Animated.View>

      <View style={styles.grid}>
        {CARDS.map((c, i) => (
          <Animated.View
            key={c.route}
            entering={FadeInDown.delay(150 + i * 90).duration(500)}
            style={styles.cardWrap}
          >
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(c.route as any);
              }}
            >
              <LinearGradient
                colors={c.colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.card}
              >
                <Text style={styles.cardTitle}>{c.title}</Text>
                <Text style={styles.cardSub}>{c.subtitle}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  hero: { marginBottom: 28 },
  hello: { fontSize: 28, fontWeight: '900', color: '#0F172A', letterSpacing: 1 },
  email: { fontSize: 14, color: '#2563EB', fontWeight: '700', marginTop: 4 },
  hint: { fontSize: 13, color: '#64748B', marginTop: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  cardWrap: { width: '100%', maxWidth: 340 },
  card: {
    borderRadius: 20,
    padding: 22,
    minHeight: 120,
    justifyContent: 'space-between',
    shadowColor: '#1E3A8A',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
  },
  cardTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', letterSpacing: 0.5 },
  cardSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 6 },
});
