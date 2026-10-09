import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  withRepeat,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useAuth } from '../AuthProvider';
import AnimatedBackground from '../../../components/AnimatedBackground';
import FloatingParticles from '../../../components/FloatingParticles';

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  delay: number;
  error?: boolean;
}

function AnimatedField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType = 'default',
  delay,
  error,
}: FieldProps) {
  const [focused, setFocused] = useState(false);
  const entryY = useSharedValue(30);
  const entryOpacity = useSharedValue(0);
  const focusAnim = useSharedValue(0);
  const shake = useSharedValue(0);

  useEffect(() => {
    entryY.value = withDelay(delay, withSpring(0, { damping: 14, stiffness: 100 }));
    entryOpacity.value = withDelay(delay, withTiming(1, { duration: 500 }));
  }, []);

  useEffect(() => {
    if (error) {
      shake.value = withSequence(
        withTiming(-8, { duration: 50 }),
        withRepeat(withTiming(8, { duration: 80 }), 4, true),
        withTiming(0, { duration: 50 })
      );
    }
  }, [error]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: entryY.value }, { translateX: shake.value }],
    opacity: entryOpacity.value,
  }));

  const shellStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(focusAnim.value, [0, 1], [0.05, 0.4]),
    transform: [{ scale: interpolate(focusAnim.value, [0, 1], [1, 1.01]) }],
  }));

  const borderColor = error ? '#EF4444' : focused ? '#2563EB' : '#CBD5E1';
  const labelColor = error ? '#EF4444' : focused ? '#2563EB' : '#94A3B8';

  return (
    <Animated.View style={[styles.fieldWrap, containerStyle]}>
      <Text style={[styles.fieldLabel, { color: labelColor }]}>{label}</Text>
      <Animated.View style={[styles.inputShell, { borderColor }, shellStyle]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize="none"
          autoCorrect={false}
          onFocus={() => {
            setFocused(true);
            focusAnim.value = withTiming(1, { duration: 220 });
          }}
          onBlur={() => {
            setFocused(false);
            focusAnim.value = withTiming(0, { duration: 220 });
          }}
        />
      </Animated.View>
    </Animated.View>
  );
}

function ErrorBanner({ message }: { message: string | null }) {
  const anim = useSharedValue(0);
  const height = useSharedValue(0);

  useEffect(() => {
    if (message) {
      anim.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
      height.value = withSpring(52, { damping: 14 });
    } else {
      anim.value = withTiming(0, { duration: 200 });
      height.value = withSpring(0, { damping: 14 });
    }
  }, [message]);

  const style = useAnimatedStyle(() => ({
    opacity: anim.value,
    height: height.value,
    transform: [{ scaleY: interpolate(anim.value, [0, 1], [0.6, 1]) }],
  }));

  if (!message) return <Animated.View style={style} />;

  return (
    <Animated.View style={[styles.errorBanner, style]}>
      <View style={styles.errorDot} />
      <Text style={styles.errorText} numberOfLines={2}>{message}</Text>
    </Animated.View>
  );
}

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shakeEmail, setShakeEmail] = useState(false);
  const [shakePassword, setShakePassword] = useState(false);

  const cardY = useSharedValue(80);
  const cardOpacity = useSharedValue(0);
  const btnScale = useSharedValue(1);
  const companyBtnScale = useSharedValue(1);
  const joinBtnScale = useSharedValue(1);
  const shimmer = useSharedValue(0);
  const headerY = useSharedValue(-40);
  const headerOpacity = useSharedValue(0);

  useEffect(() => {
    headerY.value = withSpring(0, { damping: 15, stiffness: 90 });
    headerOpacity.value = withTiming(1, { duration: 700 });
    cardY.value = withDelay(150, withSpring(0, { damping: 16, stiffness: 90 }));
    cardOpacity.value = withDelay(150, withTiming(1, { duration: 600 }));
    shimmer.value = withRepeat(
      withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
      -1,
      false
    );
  }, []);

  const headerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: headerY.value }],
    opacity: headerOpacity.value,
  }));
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: cardY.value }],
    opacity: cardOpacity.value,
  }));
  const btnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }],
  }));
  const companyBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: companyBtnScale.value }],
  }));
  const joinBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: joinBtnScale.value }],
  }));
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(shimmer.value, [0, 1], [-300, 400]) }],
    opacity: interpolate(shimmer.value, [0, 0.5, 1], [0, 0.35, 0]),
  }));

  const triggerShake = (which: 'email' | 'password') => {
    if (which === 'email') {
      setShakeEmail(true);
      setTimeout(() => setShakeEmail(false), 500);
    } else {
      setShakePassword(true);
      setTimeout(() => setShakePassword(false), 500);
    }
  };

  const validate = () => {
    if (!email) {
      triggerShake('email');
      return 'Email is required.';
    }
    if (!email.includes('@')) {
      triggerShake('email');
      return 'Enter a valid email address.';
    }
    if (!password) {
      triggerShake('password');
      return 'Password is required.';
    }
    if (password.length < 6) {
      triggerShake('password');
      return 'Password must be at least 6 characters.';
    }
    return null;
  };

  const handleLogin = async () => {
    setError(null);
    const v = validate();
    if (v) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setError(v);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    const { error: err } = await signIn(email, password);
    setLoading(false);
    if (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err.message);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleSignUp = async () => {
    setError(null);
    const v = validate();
    if (v) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setError(v);
      return;
    }
    setLoading(true);
    const { error: err } = await signUp(email, password);
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setError('Check your inbox to confirm your account.');
    }
  };

  /* ✅ Use replace when navigating between auth screens so the stack
        can't grow ambiguous. `replace` never triggers GO_BACK warnings. */
  const handleCreateCompany = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(auth)/register');
  };

  const handleJoinWithCode = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(auth)/join');
  };

  return (
    <View style={styles.root}>
      <AnimatedBackground variant="light" />
      <FloatingParticles count={16} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <Animated.View style={[styles.header, headerStyle]}>
            <Text style={styles.brandGemba}>GEMBA</Text>
            <LinearGradient
              colors={['#3B82F6', '#2563EB', '#1D4ED8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.brandGradient}
            >
              <Text style={styles.brandFive}>5S</Text>
            </LinearGradient>
            <Text style={styles.tagline}>Workplace Organization System</Text>
          </Animated.View>

          <Animated.View style={[styles.card, cardStyle]}>
            {Platform.OS !== 'web' && (
              <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFill} />
            )}

            <LinearGradient
              colors={['#3B82F6', '#6366F1', '#06B6D4']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.topBorder}
            />

            <ErrorBanner message={error} />

            <AnimatedField
              label="EMAIL"
              value={email}
              onChangeText={setEmail}
              placeholder="you@company.com"
              keyboardType="email-address"
              delay={250}
              error={shakeEmail}
            />

            <AnimatedField
              label="PASSWORD"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              delay={370}
              error={shakePassword}
            />

            <Animated.View style={[styles.btnWrap, btnStyle]}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={handleLogin}
                disabled={loading}
                onPressIn={() => (btnScale.value = withSpring(0.97, { damping: 14 }))}
                onPressOut={() => (btnScale.value = withSpring(1, { damping: 14 }))}
              >
                <LinearGradient
                  colors={['#3B82F6', '#2563EB', '#1E40AF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.btn}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.btnText}>LOGIN</Text>
                  )}
                  <Animated.View style={[styles.shimmer, shimmerStyle]}>
                    <LinearGradient
                      colors={['transparent', 'rgba(255,255,255,0.6)', 'transparent']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={StyleSheet.absoluteFill}
                    />
                  </Animated.View>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OU</Text>
              <View style={styles.dividerLine} />
            </View>

            <Animated.View style={[styles.companyBtnWrap, companyBtnStyle]}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={handleCreateCompany}
                disabled={loading}
                onPressIn={() => (companyBtnScale.value = withSpring(0.97, { damping: 14 }))}
                onPressOut={() => (companyBtnScale.value = withSpring(1, { damping: 14 }))}
              >
                <LinearGradient
                  colors={['#10B981', '#059669', '#047857']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.companyBtn}
                >
                  <Text style={styles.companyBtnText}>+ CRÉER UNE ENTREPRISE</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            <Animated.View style={[styles.joinBtnWrap, joinBtnStyle]}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={handleJoinWithCode}
                disabled={loading}
                onPressIn={() => (joinBtnScale.value = withSpring(0.97, { damping: 14 }))}
                onPressOut={() => (joinBtnScale.value = withSpring(1, { damping: 14 }))}
              >
                <LinearGradient
                  colors={['#06B6D4', '#0891B2', '#0E7490']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.companyBtn}
                >
                  <Text style={styles.companyBtnText}>🔑 REJOINDRE AVEC UN CODE</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            <TouchableOpacity
              onPress={handleSignUp}
              disabled={loading}
              style={styles.linkWrap}
            >
              <Text style={styles.linkText}>
                Pas de compte ? <Text style={styles.linkBold}>S'inscrire</Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  flex: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 28 },
  brandGemba: {
    fontSize: 48,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 6,
    textShadowColor: 'rgba(15,23,42,0.12)',
    textShadowRadius: 14,
    textShadowOffset: { width: 0, height: 4 },
  },
  brandGradient: {
    marginTop: 6,
    paddingHorizontal: 22,
    paddingVertical: 4,
    borderRadius: 14,
    shadowColor: '#2563EB',
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
  },
  brandFive: { fontSize: 42, fontWeight: '900', color: '#FFFFFF', letterSpacing: 8 },
  tagline: {
    marginTop: 14,
    fontSize: 12,
    color: '#64748B',
    letterSpacing: 2,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 24,
    padding: 24,
    paddingTop: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#1E3A8A',
    shadowOpacity: 0.18,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    overflow: 'hidden',
  },
  topBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  fieldWrap: { marginBottom: 18 },
  fieldLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 2, marginBottom: 8 },
  inputShell: {
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: 'rgba(248,250,252,0.9)',
    shadowColor: '#2563EB',
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  input: { paddingHorizontal: 16, paddingVertical: 15, fontSize: 16, color: '#0F172A' },
  btnWrap: {
    marginTop: 8,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#1E40AF',
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  btn: { paddingVertical: 17, alignItems: 'center', borderRadius: 14, overflow: 'hidden' },
  btnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15, letterSpacing: 3 },
  shimmer: { position: 'absolute', top: 0, bottom: 0, width: 120 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 18 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(148,163,184,0.4)' },
  dividerText: {
    marginHorizontal: 12,
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  companyBtnWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#059669',
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  joinBtnWrap: {
    marginTop: 12,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#0891B2',
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  companyBtn: { paddingVertical: 16, alignItems: 'center', borderRadius: 14 },
  companyBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 1.5,
  },
  linkWrap: { marginTop: 18, alignItems: 'center' },
  linkText: { color: '#64748B', fontSize: 14 },
  linkBold: { color: '#2563EB', fontWeight: '700' },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  errorDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', marginRight: 10 },
  errorText: { color: '#B91C1C', fontSize: 13, fontWeight: '600', flex: 1 },
});
