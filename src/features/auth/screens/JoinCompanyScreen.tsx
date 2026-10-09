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
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { redeemInviteCode } from '../../audit/inviteService';
import AnimatedBackground from '../../../components/AnimatedBackground';
import FloatingParticles from '../../../components/FloatingParticles';

/* ─────────── Animated field ─────────── */

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'characters';
  delay: number;
  shake?: boolean;
  maxLength?: number;
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'none',
  delay,
  shake,
  maxLength,
}: FieldProps) {
  const [focused, setFocused] = useState(false);
  const y = useSharedValue(30);
  const op = useSharedValue(0);
  const focus = useSharedValue(0);
  const shakeX = useSharedValue(0);

  useEffect(() => {
    y.value = withDelay(delay, withSpring(0, { damping: 14, stiffness: 100 }));
    op.value = withDelay(delay, withTiming(1, { duration: 500 }));
  }, []);

  useEffect(() => {
    if (shake) {
      shakeX.value = withSequence(
        withTiming(-8, { duration: 50 }),
        withSequence(withTiming(8, { duration: 80 }), withTiming(-8, { duration: 80 })),
        withTiming(0, { duration: 50 })
      );
    }
  }, [shake]);

  const wrapStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }, { translateX: shakeX.value }],
    opacity: op.value,
  }));

  const shellStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(focus.value, [0, 1], [0.05, 0.4]),
    transform: [{ scale: interpolate(focus.value, [0, 1], [1, 1.01]) }],
  }));

  const borderColor = shake ? '#EF4444' : focused ? '#2563EB' : '#CBD5E1';
  const labelColor = shake ? '#EF4444' : focused ? '#2563EB' : '#94A3B8';

  return (
    <Animated.View style={[styles.fieldWrap, wrapStyle]}>
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
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          maxLength={maxLength}
          onFocus={() => {
            setFocused(true);
            focus.value = withTiming(1, { duration: 220 });
          }}
          onBlur={() => {
            setFocused(false);
            focus.value = withTiming(0, { duration: 220 });
          }}
        />
      </Animated.View>
    </Animated.View>
  );
}

/* ─────────── Screen ─────────── */

export default function JoinCompanyScreen() {
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shakeCode, setShakeCode] = useState(false);
  const [shakeEmail, setShakeEmail] = useState(false);
  const [shakePassword, setShakePassword] = useState(false);

  const headerY = useSharedValue(-40);
  const headerOp = useSharedValue(0);
  const cardY = useSharedValue(80);
  const cardOp = useSharedValue(0);
  const btnScale = useSharedValue(1);

  useEffect(() => {
    headerY.value = withSpring(0, { damping: 15, stiffness: 90 });
    headerOp.value = withTiming(1, { duration: 700 });
    cardY.value = withDelay(150, withSpring(0, { damping: 16 }));
    cardOp.value = withDelay(150, withTiming(1, { duration: 600 }));
  }, []);

  const headerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: headerY.value }],
    opacity: headerOp.value,
  }));
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: cardY.value }],
    opacity: cardOp.value,
  }));
  const btnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }],
  }));

  const shakeField = (which: 'code' | 'email' | 'password') => {
    const setter =
      which === 'code'
        ? setShakeCode
        : which === 'email'
        ? setShakeEmail
        : setShakePassword;
    setter(true);
    setTimeout(() => setter(false), 500);
  };

  /* ✅ Safe back navigation */
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(auth)/login');
  };

  const handleJoin = async () => {
    setError(null);

    const trimmedCode = code.trim().toUpperCase();
    const trimmedEmail = email.trim().toLowerCase();

    if (trimmedCode.length < 6) {
      shakeField('code');
      return setError('Entrez un code valide.');
    }
    if (!trimmedEmail.includes('@')) {
      shakeField('email');
      return setError('Entrez un email valide.');
    }
    if (password.length < 6) {
      shakeField('password');
      return setError('Mot de passe : 6 caractères minimum.');
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);

    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
      });

      if (signUpError) throw signUpError;

      let session = signUpData.session;
      if (!session) {
        const { data: signInData, error: signInError } =
          await supabase.auth.signInWithPassword({
            email: trimmedEmail,
            password,
          });
        if (signInError) {
          setError(
            'Compte créé. Confirmez votre email puis reconnectez-vous avec le code.'
          );
          setLoading(false);
          return;
        }
        session = signInData.session;
      }

      const res = await redeemInviteCode(trimmedCode);
      if (!res.ok) {
        throw new Error(res.error ?? 'Code invalide');
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Bienvenue !', "Vous avez rejoint l'entreprise.", [
        {
          text: 'Continuer',
          onPress: () => router.replace('/(app)'),
        },
      ]);
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e.message ?? "Impossible de rejoindre l'entreprise.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <AnimatedBackground variant="light" />
      <FloatingParticles count={14} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <Animated.View style={[styles.header, headerStyle]}>
            <Text style={styles.title}>Rejoindre une entreprise</Text>
            <Text style={styles.subtitle}>
              Entrez le code partagé par votre administrateur
            </Text>
          </Animated.View>

          <Animated.View style={[styles.card, cardStyle]}>
            {Platform.OS !== 'web' && (
              <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFill} />
            )}
            <LinearGradient
              colors={['#10B981', '#06B6D4', '#3B82F6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.topBorder}
            />

            {error && (
              <View style={styles.errorBanner}>
                <View style={styles.errorDot} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Field
              label="CODE D'INVITATION"
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase())}
              placeholder="XX-XXXX-XX"
              autoCapitalize="characters"
              delay={250}
              shake={shakeCode}
              maxLength={12}
            />
            <Field
              label="EMAIL"
              value={email}
              onChangeText={setEmail}
              placeholder="vous@exemple.com"
              keyboardType="email-address"
              delay={350}
              shake={shakeEmail}
            />
            <Field
              label="MOT DE PASSE"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              delay={450}
              shake={shakePassword}
            />

            <Animated.View style={[styles.btnWrap, btnStyle]}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={handleJoin}
                disabled={loading}
                onPressIn={() => (btnScale.value = withSpring(0.97, { damping: 14 }))}
                onPressOut={() => (btnScale.value = withSpring(1, { damping: 14 }))}
              >
                <LinearGradient
                  colors={['#10B981', '#059669', '#047857']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.btn}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.btnText}>REJOINDRE</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            <TouchableOpacity
              onPress={goBack}
              disabled={loading}
              style={styles.linkWrap}
            >
              <Text style={styles.linkText}>
                Déjà un compte ? <Text style={styles.linkBold}>Se connecter</Text>
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
  header: { alignItems: 'center', marginBottom: 24 },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 1,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.9)',
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
  fieldWrap: { marginBottom: 16 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 8,
  },
  inputShell: {
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: 'rgba(248,250,252,0.9)',
    shadowColor: '#2563EB',
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0F172A',
    letterSpacing: 2,
  },
  btnWrap: {
    marginTop: 8,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#059669',
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  btn: { paddingVertical: 17, alignItems: 'center', borderRadius: 14 },
  btnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 3,
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
    paddingVertical: 10,
    marginBottom: 12,
  },
  errorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginRight: 10,
  },
  errorText: { color: '#B91C1C', fontSize: 13, fontWeight: '600', flex: 1 },
});
