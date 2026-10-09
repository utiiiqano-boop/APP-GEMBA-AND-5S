import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import SplashScreen from './src/screens/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';

export default function App() {
  const [ready, setReady] = useState(false);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      {!ready ? <SplashScreen onFinish={() => setReady(true)} /> : <LoginScreen />}
    </GestureHandlerRootView>
  );
}
