import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay,
  withSequence, Easing, runOnJS,
} from 'react-native-reanimated';

interface Props { onFinish: () => void; }

export default function SplashScreen({ onFinish }: Props) {
  const gembaY = useSharedValue(-400);
  const fiveSY = useSharedValue(400);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    gembaY.value = withTiming(0, { duration: 1000, easing: Easing.out(Easing.cubic) });
    fiveSY.value = withTiming(0, { duration: 1000, easing: Easing.out(Easing.cubic) });

    const t = setTimeout(() => {
      scale.value = withSequence(
        withTiming(1.2, { duration: 300 }),
        withTiming(15, { duration: 1200, easing: Easing.in(Easing.cubic) })
      );
      opacity.value = withDelay(1400, withTiming(0, { duration: 400 }, (f) => {
        if (f) runOnJS(onFinish)();
      }));
    }, 2200);

    return () => clearTimeout(t);
  }, []);

  const gS = useAnimatedStyle(() => ({ transform: [{ translateY: gembaY.value }] }));
  const fS = useAnimatedStyle(() => ({ transform: [{ translateY: fiveSY.value }] }));
  const cS = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }], opacity: opacity.value,
  }));

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.group, cS]}>
        <Animated.Text style={[styles.gemba, gS]}>GEMBA</Animated.Text>
        <Animated.Text style={[styles.fiveS, fS]}>5S</Animated.Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  group: { alignItems: 'center' },
  gemba: { fontSize: 64, fontWeight: '900', color: '#0F172A', letterSpacing: 6 },
  fiveS: { fontSize: 72, fontWeight: '900', color: '#2563EB', letterSpacing: 10, marginTop: 12 },
});
