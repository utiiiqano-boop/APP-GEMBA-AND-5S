import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
  interpolate,
} from 'react-native-reanimated';

const { width: W, height: H } = Dimensions.get('window');

interface ParticleProps {
  size: number;
  color: string;
  startX: number;
  startY: number;
  duration: number;
  delay: number;
  drift: number;
}

function Particle({ size, color, startX, startY, duration, delay, drift }: ParticleProps) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration, easing: Easing.linear }),
        -1,
        false
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(t.value, [0, 0.5, 1], [0, drift, 0]) },
      { translateY: interpolate(t.value, [0, 1], [0, -H * 0.9]) },
    ],
    opacity: interpolate(t.value, [0, 0.1, 0.85, 1], [0, 0.7, 0.7, 0]),
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: startX,
          top: startY,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          shadowColor: color,
          shadowOpacity: 0.7,
          shadowRadius: size * 1.5,
          shadowOffset: { width: 0, height: 0 },
        },
        style,
      ]}
    />
  );
}

export default function FloatingParticles({ count = 14 }: { count?: number }) {
  const particles = useMemo(() => {
    const palette = ['#3B82F6', '#6366F1', '#06B6D4', '#8B5CF6'];
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      size: 4 + Math.random() * 8,
      color: palette[i % palette.length],
      startX: Math.random() * W,
      startY: H * 0.5 + Math.random() * H * 0.6,
      duration: 8000 + Math.random() * 8000,
      delay: Math.random() * 4000,
      drift: (Math.random() - 0.5) * 120,
    }));
  }, [count]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p) => (
        <Particle key={p.id} {...p} />
      ))}
    </View>
  );
}
