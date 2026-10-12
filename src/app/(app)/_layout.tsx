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
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../features/auth/AuthProvider';
import { colors, spacing, radius, shadow, font, text } from '../../theme';

type NavItem = {
  label: string;
  route: string;
  icon: keyof typeof Feather.glyphMap;
  group: 'main' | 'admin';
};

const NAV: NavItem[] = [
  { label: 'Dashboard', route: '/(app)/dashboard', icon: 'bar-chart-2', group: 'main' },
  { label: 'Notifications', route: '/(app)/notifications', icon: 'bell', group: 'main' },

  { label: 'Audit Gemba', route: '/(app)/gemba', icon: 'target', group: 'main' },
  { label: 'Audit 5S', route: '/(app)/audit5s', icon: 'grid', group: 'main' },
  { label: 'Tableau Gemba', route: '/(app)/gemba-tableau', icon: 'list', group: 'main' },
  { label: 'Tableau 5S', route: '/(app)/5s-tableau', icon: 'layers', group: 'main' },
  { label: 'Plan actions', route: '/(app)/action-plans', icon: 'check-square', group: 'main' },
  { label: 'Contenu Audit', route: '/(app)/content-editor', icon: 'edit-3', group: 'admin' },
  { label: 'Utilisateurs', route: '/(app)/users', icon: 'users', group: 'admin' },
  { label: 'Configuration', route: '/(app)/settings', icon: 'settings', group: 'admin' },
];

function NavRow({
  item, active, onPress,
}: { item: NavItem; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.navItem, active && styles.navItemActive]}
      activeOpacity={0.85}
    >
      <View style={[styles.navIconWrap, active && styles.navIconWrapActive]}>
        <Feather
          name={item.icon}
          size={18}
          color={active ? colors.white : colors.gray[500]}
        />
      </View>
      <Text style={[styles.navLabel, active && styles.navLabelActive]} numberOfLines={1}>
        {item.label}
      </Text>
      {active && <View style={styles.navDot} />}
    </TouchableOpacity>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { signOut, user } = useAuth();

  const handleNav = (route: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(route as any);
    onNavigate?.();
  };

  const mainNav = NAV.filter((n) => n.group === 'main');
  const adminNav = NAV.filter((n) => n.group === 'admin');

  return (
    <View style={styles.sidebarInner}>
      {/* Brand */}
      <View style={styles.brand}>
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.brandLogo}
        >
          <Text style={styles.brandLogoText}>5S</Text>
        </LinearGradient>
        <View style={{ marginLeft: 12 }}>
          <Text style={styles.brandTitle}>GEMBA</Text>
          <Text style={styles.brandSub}>Workplace System</Text>
        </View>
      </View>

      {/* User */}
      <View style={styles.userBox}>
        <LinearGradient
          colors={[colors.admin, colors.adminDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.avatar}
        >
          <Text style={styles.avatarText}>
            {(user?.email?.[0] ?? '?').toUpperCase()}
          </Text>
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={styles.userName} numberOfLines={1}>
            {user?.email?.split('@')[0] ?? 'Utilisateur'}
          </Text>
          <Text style={styles.userEmail} numberOfLines={1}>
            {user?.email}
          </Text>
        </View>
      </View>

      {/* Nav */}
      <ScrollView style={styles.nav} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>PRINCIPAL</Text>
        {mainNav.map((item) => {
          const seg = item.route.replace('/(app)', '');
          const active = pathname === seg || (seg !== '/' && pathname.startsWith(seg));
          return (
            <NavRow key={item.route} item={item} active={active} onPress={() => handleNav(item.route)} />
          );
        })}

        <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>ADMINISTRATION</Text>
        {adminNav.map((item) => {
          const seg = item.route.replace('/(app)', '');
          const active = pathname === seg || (seg !== '/' && pathname.startsWith(seg));
          return (
            <NavRow key={item.route} item={item} active={active} onPress={() => handleNav(item.route)} />
          );
        })}
      </ScrollView>

      {/* Sign out */}
      <TouchableOpacity
        style={styles.signOut}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          signOut();
        }}
        activeOpacity={0.85}
      >
        <Feather name="log-out" size={16} color={colors.danger} />
        <Text style={styles.signOutText}>Déconnexion</Text>
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
      {isDesktop && (
        <View style={styles.sidebar}>
          <SidebarContent />
        </View>
      )}
      <View style={styles.main}>
        {!isDesktop && (
          <View style={styles.topbar}>
            <TouchableOpacity onPress={openMenu} style={styles.burger} hitSlop={12} activeOpacity={0.7}>
              <Feather name="menu" size={22} color={colors.gray[900]} />
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
  root: { flex: 1, flexDirection: 'row', backgroundColor: colors.gray[50] },
  sidebar: {
    width: SIDEBAR_WIDTH,
    backgroundColor: colors.white,
    borderRightWidth: 1,
    borderRightColor: colors.gray[200],
  },
  sidebarInner: { flex: 1, paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },

  brand: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xxl },
  brandLogo: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.colored(colors.primary),
  },
  brandLogoText: { color: colors.white, fontFamily: font.black, fontSize: 18, letterSpacing: 1 },
  brandTitle: { fontSize: 16, fontFamily: font.black, color: colors.gray[900], letterSpacing: 2 },
  brandSub: { fontSize: 10, fontFamily: font.semibold, color: colors.gray[400], letterSpacing: 1, marginTop: 2 },

  userBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.gray[50],
    borderRadius: radius.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: { color: colors.white, fontFamily: font.black, fontSize: 14 },
  userName: { fontSize: 13, fontFamily: font.bold, color: colors.gray[900] },
  userEmail: { fontSize: 11, fontFamily: font.medium, color: colors.gray[500], marginTop: 1 },

  nav: { flex: 1 },
  sectionLabel: {
    fontSize: 10,
    fontFamily: font.extrabold,
    color: colors.gray[400],
    letterSpacing: 1.8,
    marginBottom: spacing.sm,
    marginLeft: spacing.sm,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    marginBottom: 4,
  },
  navItemActive: {
    backgroundColor: colors.primarySoft,
    ...shadow.xs,
  },
  navIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  navIconWrapActive: {
    backgroundColor: colors.primary,
    ...shadow.colored(colors.primary),
  },
  navLabel: { flex: 1, fontSize: 13, fontFamily: font.semibold, color: colors.gray[600] },
  navLabelActive: { color: colors.primary, fontFamily: font.bold },
  navDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },

  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
    gap: 8,
  },
  signOutText: { color: colors.danger, fontFamily: font.bold, fontSize: 13, letterSpacing: 0.5 },

  main: { flex: 1 },
  topbar: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
    ...shadow.xs,
  },
  burger: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  topbarTitle: { fontSize: 15, fontFamily: font.extrabold, color: colors.gray[900], letterSpacing: 2 },

  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.black },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: colors.white,
    ...shadow.lg,
  },
});
