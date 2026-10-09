import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  withSpring,
  withRepeat,
  Easing,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import AnimatedBackground from '../../../components/AnimatedBackground';

const { width: W, height: H } = Dimensions.get('window');
const GEMBA = 'GEMBA'.split('');

interface Props {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: Props) {
  const lettersY = GEMBA.map(() => useSharedValue(-500));
  const lettersOpacity = GEMBA.map(() => useSharedValue(0));
  const lettersRotate = GEMBA.map(() => useSharedValue(-45));

  const fiveSY = useSharedValue(600);
  const fiveSOpacity = useSharedValue(0);
  const fiveSScale = useSharedValue(0.4);

  const glowPulse = useSharedValue(0);
  const ringScale = useSharedValue(0.6);
  const ringOpacity = useSharedValue(0);

  const containerScale = useSharedValue(1);
  const containerOpacity = useSharedValue(1);
  const bgOpacity = useSharedValue(1);

  useEffect(() => {
    // ── Phase 1: GEMBA staggered drop (0 → 1300ms)
    GEMBA.forEach((_, i) => {
      const delay = i * 90;
      lettersY[i].value = withDelay(
        delay,
        withSpring(0, { damping: 12, stiffness: 90, mass: 0.9 })
      );
      lettersOpacity[i].value = withDelay(
        delay,
        withTiming(1, { duration: 400 })
      );
      lettersRotate[i].value = withDelay(
        delay,
        withSpring(0, { damping: 10, stiffness: 100 })
      );
    });

    // ── Phase 2: 5S rises with bounce (400 → 1400ms)
    fiveSY.value = withDelay(
      400,
      withSpring(0, { damping: 11, stiffness: 95, mass: 0.9 })
    );
    fiveSOpacity.value = withDelay(400, withTiming(1, { duration: 500 }));
    fiveSScale.value = withDelay(
      400,
      withSequence(
        withSpring(1.15, { damping: 6, stiffness: 120 }),
        withSpring(1, { damping: 10, stiffness: 100 })
      )
    );

    // ── Phase 3: glow pulse loop once centered (1200ms)
    glowPulse.value = withDelay(
      1200,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 700, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 700, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      )
    );

    // ── Phase 4: expanding ring (1600ms)
    ringOpacity.value = withDelay(
      1600,
      withRepeat(
        withSequence(
          withTiming(0.6, { duration: 200 }),
          withTiming(0, { duration: 1400, easing: Easing.out(Easing.cubic) })
        ),
        -1,
        false
      )
    );
    ringScale.value = withDelay(
      1600,
      withRepeat(
        withSequence(
          withTiming(0.6, { duration: 200 }),
          withTiming(2.4, { duration: 1400, easing: Easing.out(Easing.cubic) })
        ),
        -1,
        false
      )
    );

    // ── Phase 5: hold 2s, then zoom out & fade (3200ms)
    const t = setTimeout(() => {
      containerScale.value = withSequence(
        withTiming(1.08, { duration: 250, easing: Easing.out(Easing.quad) }),
        withTiming(18, { duration: 1100, easing: Easing.in(Easing.cubic) })
      );
      containerOpacity.value = withDelay(
        1200,
        withTiming(0, { duration: 500 })
      );
      bgOpacity.value = withDelay(
        1300,
        withTiming(0, { duration: 500 }, (finished) => {
          if (finished) runOnJS(onFinish)();
        })
      );
    }, 3200);

    return () => clearTimeout(t);
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: containerScale.value }],
    opacity: containerOpacity.value,
  }));

  const bgStyle = useAnimatedStyle(() => ({ opacity: bgOpacity.value }));

  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(glowPulse.value, [0, 1], [0.4, 1]),
    shadowRadius: interpolate(glowPulse.value, [0, 1], [20, 60]),
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  const fiveSStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: fiveSY.value }, { scale: fiveSScale.value }],
    opacity: fiveSOpacity.value,
  }));

  return (
    <View style={styles.root}>
      <Animated.View style={[StyleSheet.absoluteFill, bgStyle]}>
        <AnimatedBackground variant="light" />
      </Animated.View>

      <Animated.View style={[styles.center, containerStyle]}>
        {/* Expanding halo ring */}
        <Animated.View style={[styles.ring, ringStyle]} pointerEvents="none" />

        {/* GEMBA — staggered letters */}
        <View style={styles.gembaRow}>
          {GEMBA.map((letter, i) => {
            const style = useAnimatedStyle(() => ({
              transform: [
                { translateY: lettersY[i].value },
                { rotateZ: `${lettersRotate[i].value}deg` },
              ],
              opacity: lettersOpacity[i].value,
            }));
            return (
              <Animated.Text
                key={i}
                style={[styles.gembaLetter, style]}
              >
                {letter}
              </Animated.Text>
            );
          })}
        </View>

        {/* 5S with glow */}
        <Animated.Text style={[styles.fiveSText, glowStyle, fiveSStyle]}>
          5S
        </Animated.Text>

        {/* Underline shimmer */}
        <Animated.View style={[styles.underline, fiveSStyle]}>
          <LinearGradient
            colors={['transparent', '#2563EB', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gembaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gembaLetter: {
    fontSize: 68,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 2,
    textShadowColor: 'rgba(15,23,42,0.15)',
    textShadowRadius: 12,
    textShadowOffset: { width: 0, height: 4 },
  },
  fiveSText: {
    fontSize: 92,
    fontWeight: '900',
    color: '#2563EB',
    letterSpacing: 12,
    marginTop: 8,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 0 },
    textShadowColor: 'rgba(37,99,235,0.5)',
    textShadowRadius: 24,
    textShadowOffset: { width: 0, height: 0 },
  },
  underline: {
    width: 180,
    height: 3,
    marginTop: 18,
    borderRadius: 2,
    overflow: 'hidden',
  },
  ring: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 2,
    borderColor: '#2563EB',
    top: '50%',
    marginTop: -130,
  },
});
