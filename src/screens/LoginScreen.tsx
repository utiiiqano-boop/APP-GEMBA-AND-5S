import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const login = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) Alert.alert('Login failed', error.message);
    else Alert.alert('Success', 'Welcome!');
  };

  const signup = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) Alert.alert('Signup failed', error.message);
    else Alert.alert('Check your email');
  };

  return (
    <View style={styles.c}>
      <Text style={styles.logo}>GEMBA</Text>
      <Text style={styles.sub}>5S</Text>
      <TextInput style={styles.i} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
      <TextInput style={styles.i} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <TouchableOpacity style={styles.b} onPress={login} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.bt}>LOGIN</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={signup}>
        <Text style={styles.l}>Create account</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#FFF' },
  logo: { fontSize: 44, fontWeight: '900', color: '#0F172A', textAlign: 'center', letterSpacing: 4 },
  sub: { fontSize: 52, fontWeight: '900', color: '#2563EB', textAlign: 'center', letterSpacing: 8, marginBottom: 40 },
  i: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, padding: 14, marginBottom: 14, fontSize: 16 },
  b: { backgroundColor: '#2563EB', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  bt: { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 2 },
  l: { color: '#2563EB', textAlign: 'center', marginTop: 20, fontSize: 15 },
});
