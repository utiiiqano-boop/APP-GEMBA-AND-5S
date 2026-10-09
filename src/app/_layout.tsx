import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as NativeSplash from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider, useAuth } from '../features/auth/AuthProvider';
import SplashScreen from '../features/auth/screens/SplashScreen';

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

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
