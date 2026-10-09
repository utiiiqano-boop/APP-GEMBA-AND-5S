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
  Image,
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
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useAuth } from '../AuthProvider';
import { registerCompany } from '../../../lib/companyService';
import AnimatedBackground from '../../../components/AnimatedBackground';
import FloatingParticles from '../../../components/FloatingParticles';

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType = 'default',
  delay,
  error,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  delay: number;
  error?: boolean;
}) {
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
        withSequence(withTiming(8, { duration: 80 }), withTiming(-8, { duration: 80 })),
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

export default function CompanyRegisterScreen() {
  const { session } = useAuth();

  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cardY = useSharedValue(80);
  const cardOpacity = useSharedValue(0);
  const headerY = useSharedValue(-40);
  const headerOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.6);
  const logoOpacity = useSharedValue(0);
  const btnScale = useSharedValue(1);

  useEffect(() => {
    headerY.value = withSpring(0, { damping: 15, stiffness: 90 });
    headerOpacity.value = withTiming(1, { duration: 700 });
    logoScale.value = withDelay(200, withSpring(1, { damping: 12, stiffness: 100 }));
    logoOpacity.value = withDelay(200, withTiming(1, { duration: 500 }));
    cardY.value = withDelay(300, withSpring(0, { damping: 16, stiffness: 90 }));
    cardOpacity.value = withDelay(300, withTiming(1, { duration: 600 }));
  }, []);

  const headerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: headerY.value }],
    opacity: headerOpacity.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: cardY.value }],
    opacity: cardOpacity.value,
  }));

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: logoOpacity.value,
  }));

  const btnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }],
  }));

  /* ✅ Safe back navigation */
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(auth)/login');
  };

  const pickLogo = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow access to your photos to upload a logo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setLogoUri(result.assets[0].uri);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleSubmit = async () => {
    setError(null);

    if (!companyName.trim()) return setError('Company name is required.');
    if (!email.includes('@')) return setError('Enter a valid email address.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirmPassword) return setError('Passwords do not match.');

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);

    try {
      await registerCompany({
        companyName: companyName.trim(),
        email: email.trim().toLowerCase(),
        password,
        logoUri,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Company registered',
        'Check your email to confirm your account, then log in.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
      );
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e.message ?? 'Registration failed. Try again.');
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
            <Text style={styles.title}>Create Company</Text>
            <Text style={styles.subtitle}>Set up your GEMBA 5S workspace</Text>
          </Animated.View>

          <Animated.View style={[styles.logoWrap, logoStyle]}>
            <TouchableOpacity onPress={pickLogo} activeOpacity={0.85}>
              <LinearGradient
                colors={logoUri ? ['#10B981', '#059669'] : ['#3B82F6', '#2563EB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.logoCircle}
              >
                {logoUri ? (
                  <Image source={{ uri: logoUri }} style={styles.logoImage} />
                ) : (
                  <Text style={styles.logoPlus}>+</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
            <Text style={styles.logoLabel}>
              {logoUri ? 'Tap to change' : 'Upload company logo'}
            </Text>
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

            {error && (
              <View style={styles.errorBanner}>
                <View style={styles.errorDot} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Field
              label="COMPANY NAME"
              value={companyName}
              onChangeText={setCompanyName}
              placeholder="Acme Corp"
              delay={400}
            />
            <Field
              label="EMAIL"
              value={email}
              onChangeText={setEmail}
              placeholder="admin@acme.com"
              keyboardType="email-address"
              delay={480}
            />
            <Field
              label="PASSWORD"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              delay={560}
            />
            <Field
              label="CONFIRM PASSWORD"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="••••••••"
              secureTextEntry
              delay={640}
            />

            <Animated.View style={[styles.btnWrap, btnStyle]}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={handleSubmit}
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
                    <Text style={styles.btnText}>CREATE COMPANY</Text>
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
                Already have an account? <Text style={styles.linkBold}>Log in</Text>
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
  header: { alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 34, fontWeight: '900', color: '#0F172A', letterSpacing: 2 },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    letterSpacing: 1.2,
    fontWeight: '600',
    marginTop: 6,
  },
  logoWrap: { alignItems: 'center', marginBottom: 24 },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    overflow: 'hidden',
  },
  logoImage: { width: 96, height: 96, borderRadius: 48 },
  logoPlus: { fontSize: 48, color: '#FFFFFF', fontWeight: '300', lineHeight: 52 },
  logoLabel: {
    marginTop: 10,
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    letterSpacing: 1,
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
  input: { paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#0F172A' },
  btnWrap: {
    marginTop: 8,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#1E40AF',
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  btn: { paddingVertical: 17, alignItems: 'center', borderRadius: 14 },
  btnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15, letterSpacing: 2 },
  linkWrap: { marginTop: 16, alignItems: 'center' },
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
    marginBottom: 14,
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
