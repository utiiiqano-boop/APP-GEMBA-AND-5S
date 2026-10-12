import React, { useEffect } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming,
  withSequence, Easing, interpolate,
} from 'react-native-reanimated';
import { colors } from '../theme';

const { width: W, height: H } = Dimensions.get('window');

export default function AnimatedBackground({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const t1 = useSharedValue(0);
  const t2 = useSharedValue(0);
  const t3 = useSharedValue(0);

  useEffect(() => {
    t1.value = withRepeat(withSequence(
      withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.sin) }),
      withTiming(0, { duration: 6000, easing: Easing.inOut(Easing.sin) }),
    ), -1, false);
    t2.value = withRepeat(withSequence(
      withTiming(1, { duration: 8000, easing: Easing.inOut(Easing.quad) }),
      withTiming(0, { duration: 8000, easing: Easing.inOut(Easing.quad) }),
    ), -1, false);
    t3.value = withRepeat(withSequence(
      withTiming(1, { duration: 5000, easing: Easing.inOut(Easing.cubic) }),
      withTiming(0, { duration: 5000, easing: Easing.inOut(Easing.cubic) }),
    ), -1, false);
  }, []);

  const orb1 = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(t1.value, [0, 1], [-W * 0.2, W * 0.3]) },
      { translateY: interpolate(t1.value, [0, 1], [-H * 0.1, H * 0.2]) },
      { scale: interpolate(t1.value, [0, 1], [1, 1.3]) },
    ],
    opacity: interpolate(t1.value, [0, 0.5, 1], [0.5, 0.8, 0.5]),
  }));
  const orb2 = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(t2.value, [0, 1], [W * 0.25, -W * 0.15]) },
      { translateY: interpolate(t2.value, [0, 1], [H * 0.15, -H * 0.1]) },
      { scale: interpolate(t2.value, [0, 1], [1.1, 0.9]) },
    ],
    opacity: interpolate(t2.value, [0, 0.5, 1], [0.4, 0.7, 0.4]),
  }));
  const orb3 = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(t3.value, [0, 1], [W * 0.1, -W * 0.25]) },
      { translateY: interpolate(t3.value, [0, 1], [-H * 0.2, H * 0.1]) },
      { scale: interpolate(t3.value, [0, 1], [0.9, 1.4]) },
    ],
    opacity: interpolate(t3.value, [0, 0.5, 1], [0.35, 0.65, 0.35]),
  }));

  const colors3: readonly [string, string, string] = variant === 'dark'
    ? ['#0B1120', '#0F172A', '#1E1B4B']
    : [colors.white, colors.primarySoft, '#DBEAFE'];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={colors3} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.orb, styles.orbBlue, orb1]} />
      <Animated.View style={[styles.orb, styles.orbIndigo, orb2]} />
      <Animated.View style={[styles.orb, styles.orbCyan, orb3]} />
    </View>
  );
}

const styles = StyleSheet.create({
  orb: { position: 'absolute', width: W * 0.9, height: W * 0.9, borderRadius: W * 0.45 },
  orbBlue: { backgroundColor: colors.primaryLight, top: -W * 0.3, left: -W * 0.3 },
  orbIndigo: { backgroundColor: colors.admin, bottom: -W * 0.4, right: -W * 0.4 },
  orbCyan: { backgroundColor: '#06B6D4', top: H * 0.35, left: W * 0.1 },
});
