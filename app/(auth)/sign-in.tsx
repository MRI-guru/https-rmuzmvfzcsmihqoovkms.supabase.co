import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email.trim() || !password) return Alert.alert('Sign in', 'Enter your email and password.');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) return Alert.alert('Sign in failed', error.message);
    router.replace('/(app)/quickcheck');
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brandMark}><Text style={styles.brandMarkText}>MRI</Text></View>
        <Text style={styles.eyebrow}>MRI SAFETY</Text>
        <Text style={styles.title}>QuickCheck</Text>
        <Text style={styles.subtitle}>Sign in to verify implant and scanner compatibility.</Text>
        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="you@hospital.org" placeholderTextColor="#98a2b3" style={styles.input} />
          <Text style={styles.label}>Password</Text>
          <TextInput secureTextEntry value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor="#98a2b3" style={styles.input} />
          <Pressable disabled={loading} onPress={submit} style={styles.button}><Text style={styles.buttonText}>{loading ? 'SIGNING IN…' : 'SIGN IN'}</Text></Pressable>
          <Pressable onPress={() => router.push('/(auth)/sign-up')}><Text style={styles.link}>Create an account</Text></Pressable>
        </View>
        <Text style={styles.disclaimer}>Safety decisions are based on available manufacturer labeling. Unknown or unverified devices are never treated as safe.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f7f9fc' }, content: { flexGrow: 1, padding: 28, justifyContent: 'center', gap: 8 },
  brandMark: { width: 58, height: 58, borderRadius: 17, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }, brandMarkText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  eyebrow: { fontSize: 12, fontWeight: '900', letterSpacing: 2, color: '#667085' }, title: { fontSize: 42, fontWeight: '900', color: '#101828' }, subtitle: { fontSize: 17, lineHeight: 25, color: '#667085', marginBottom: 20 },
  form: { gap: 10 }, label: { fontSize: 13, fontWeight: '800', color: '#344054', marginTop: 6 }, input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9dee7', borderRadius: 13, paddingHorizontal: 15, paddingVertical: 14, fontSize: 16, color: '#101828' },
  button: { marginTop: 10, minHeight: 56, borderRadius: 14, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' }, buttonText: { color: '#fff', fontWeight: '900' }, link: { textAlign: 'center', color: '#175cd3', fontWeight: '800', padding: 12 }, disclaimer: { marginTop: 20, color: '#667085', fontSize: 12, lineHeight: 18 },
});
