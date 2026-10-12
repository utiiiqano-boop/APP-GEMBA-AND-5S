import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as NativeSplash from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
} from '@expo-google-fonts/inter';

import { AuthProvider, useAuth } from '../features/auth/AuthProvider';
import SplashScreen from '../features/auth/screens/SplashScreen';
import { subscribeToNotificationTaps } from '../lib/pushNotifications';

NativeSplash.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { session, isLoading } = useAuth();
  const [jsSplashDone, setJsSplashDone] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      NativeSplash.hideAsync().catch(() => {});
    }
  }, [isLoading]);

  if (isLoading) return null;

  if (!jsSplashDone) {
    return <SplashScreen onFinish={() => setJsSplashDone(true)} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

import { router } from 'expo-router';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
  });

  useEffect(() => {
    if (fontsLoaded) {
      NativeSplash.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  // Tap sur notification → navigue vers l'écran adéquat
  useEffect(() => {
    const unsub = subscribeToNotificationTaps((data) => {
      if (data?.type === 'nok' || data?.type === 'assignment') {
        const auditType = data.audit_id ? '5s' : 'gemba';
        router.push('/(app)/gemba');
      }
    });
    return unsub;
  }, []);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
