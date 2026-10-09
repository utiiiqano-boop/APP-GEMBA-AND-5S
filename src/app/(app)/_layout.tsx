import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, useWindowDimensions,
} from 'react-native';
import { Slot, router, usePathname } from 'expo-router';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, Easing, interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../features/auth/AuthProvider';

const NAV = [
  { label: 'Audit Gemba', route: '/(app)/gemba', icon: '◎' },
  { label: 'Audit 5S', route: '/(app)/audit5s', icon: '⬡' },
  { label: 'Tableau Gemba', route: '/(app)/gemba-tableau', icon: '▦' },
  { label: 'Tableau 5S', route: '/(app)/5s-tableau', icon: '▤' },
  { label: 'Contenu Audit', route: '/(app)/content-editor', icon: '✎' },
  { label: 'Utilisateurs', route: '/(app)/users', icon: '◉' },
  { label: 'Configuration Entreprise', route: '/(app)/settings', icon: '⚙' },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { signOut, user } = useAuth();
  const handleNav = (route: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(route as any);
    onNavigate?.();
  };
  return (
    <View style={styles.sidebarInner}>
      <View style={styles.brand}>
        <Text style={styles.brandGemba}>GEMBA</Text>
        <LinearGradient colors={['#3B82F6', '#2563EB']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.brandChip}>
          <Text style={styles.brandChipText}>5S</Text>
        </LinearGradient>
      </View>
      <View style={styles.userBox}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{(user?.email?.[0] ?? '?').toUpperCase()}</Text></View>
        <Text style={styles.userEmail} numberOfLines={1}>{user?.email}</Text>
      </View>
      <ScrollView style={styles.nav} showsVerticalScrollIndicator={false}>
        {NAV.map((item) => {
          const seg = item.route.replace('/(app)', '');
          const active = pathname === seg || (seg !== '/' && pathname.startsWith(seg));
          return (
            <TouchableOpacity
              key={item.route}
              onPress={() => handleNav(item.route)}
              style={[styles.navItem, active && styles.navItemActive]}
              activeOpacity={0.85}
            >
              <Text style={[styles.navIcon, active && styles.navIconActive]}>{item.icon}</Text>
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
              {active && <View style={styles.navDot} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <TouchableOpacity
        style={styles.signOut}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          signOut();
        }}
      >
        <Text style={styles.signOutText}>⏻  Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function AppLayout() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  const [menuOpen, setMenuOpen] = useState(false);
  const slide = useSharedValue(-320);
  const backdrop = useSharedValue(0);
  useEffect(() => {
    if (menuOpen) {
      slide.value = withSpring(0, { damping: 20, stiffness: 140 });
      backdrop.value = withTiming(1, { duration: 220 });
    } else {
      slide.value = withTiming(-320, { duration: 240, easing: Easing.in(Easing.cubic) });
      backdrop.value = withTiming(0, { duration: 220 });
    }
  }, [menuOpen]);
  const drawerStyle = useAnimatedStyle(() => ({ transform: [{ translateX: slide.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: interpolate(backdrop.value, [0, 1], [0, 0.5]) }));
  const openMenu = () => { Haptics.selectionAsync(); setMenuOpen(true); };
  const closeMenu = () => setMenuOpen(false);
  return (
    <View style={styles.root}>
      {isDesktop && (<View style={styles.sidebar}><SidebarContent /></View>)}
      <View style={styles.main}>
        {!isDesktop && (
          <View style={styles.topbar}>
            <TouchableOpacity onPress={openMenu} style={styles.burger} hitSlop={12}>
              <View style={styles.burgerLine} /><View style={styles.burgerLine} /><View style={styles.burgerLine} />
            </TouchableOpacity>
            <Text style={styles.topbarTitle}>GEMBA 5S</Text>
            <View style={{ width: 36 }} />
          </View>
        )}
        <Slot />
      </View>
      {!isDesktop && menuOpen && (
        <>
          <Animated.View style={[styles.backdrop, backdropStyle]}>
            <TouchableOpacity style={{ flex: 1 }} onPress={closeMenu} />
          </Animated.View>
          <Animated.View style={[styles.drawer, drawerStyle]}>
            <SidebarContent onNavigate={closeMenu} />
          </Animated.View>
        </>
      )}
    </View>
  );
}

const SIDEBAR_WIDTH = 280;
const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: '#F8FAFC' },
  sidebar: { width: SIDEBAR_WIDTH, backgroundColor: '#FFFFFF', borderRightWidth: 1, borderRightColor: '#E2E8F0' },
  sidebarInner: { flex: 1, paddingVertical: 24, paddingHorizontal: 18 },
  brand: { alignItems: 'center', marginBottom: 28 },
  brandGemba: { fontSize: 26, fontWeight: '900', color: '#0F172A', letterSpacing: 4 },
  brandChip: { marginTop: 6, paddingHorizontal: 14, paddingVertical: 2, borderRadius: 10 },
  brandChipText: { color: '#FFFFFF', fontWeight: '900', fontSize: 18, letterSpacing: 4 },
  userBox: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: '#F1F5F9', borderRadius: 12, marginBottom: 20 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  avatarText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  userEmail: { flex: 1, fontSize: 12, color: '#334155', fontWeight: '600' },
  nav: { flex: 1 },
  navItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, marginBottom: 6 },
  navItemActive: { backgroundColor: 'rgba(37,99,235,0.1)' },
  navIcon: { fontSize: 18, color: '#64748B', width: 26 },
  navIconActive: { color: '#2563EB' },
  navLabel: { flex: 1, fontSize: 14, color: '#475569', fontWeight: '600' },
  navLabelActive: { color: '#2563EB', fontWeight: '800' },
  navDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#2563EB' },
  signOut: { marginTop: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.1)' },
  signOutText: { color: '#DC2626', fontWeight: '800', fontSize: 13, letterSpacing: 1 },
  main: { flex: 1 },
  topbar: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  burger: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  burgerLine: { width: 22, height: 2, backgroundColor: '#0F172A', marginVertical: 2, borderRadius: 1 },
  topbarTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', letterSpacing: 2 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
  drawer: { position: 'absolute', top: 0, bottom: 0, left: 0, width: SIDEBAR_WIDTH, backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, shadowOffset: { width: 8, height: 0 } },
});
