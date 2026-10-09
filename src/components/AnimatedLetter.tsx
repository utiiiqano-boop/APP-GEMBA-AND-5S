import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

interface Props {
  letter: string;
  index: number;
  delay: number;
}

export default function AnimatedLetter({ letter, index, delay }: Props) {
  const y = useSharedValue(-500);
  const opacity = useSharedValue(0);
  const rotate = useSharedValue(-45);

  useEffect(() => {
    const d = index * delay;
    y.value = withDelay(d, withSpring(0, { damping: 12, stiffness: 90, mass: 0.9 }));
    opacity.value = withDelay(d, withTiming(1, { duration: 400 }));
    rotate.value = withDelay(d, withSpring(0, { damping: 10, stiffness: 100 }));
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: y.value },
      { rotateZ: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return <Animated.Text style={[styles.letter, style]}>{letter}</Animated.Text>;
}

const styles = StyleSheet.create({
  letter: {
    fontSize: 68,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 2,
    textShadowColor: 'rgba(15,23,42,0.15)',
    textShadowRadius: 12,
    textShadowOffset: { width: 0, height: 4 },
  },
});
