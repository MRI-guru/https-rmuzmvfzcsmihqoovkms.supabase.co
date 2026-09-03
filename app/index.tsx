import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(Boolean(data.session));
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session));
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (loading) return <View style={styles.center}><ActivityIndicator /></View>;

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>MRI SAFETY</Text>
      <Text style={styles.title}>QuickCheck</Text>
      <Text style={styles.subtitle}>Verify implant and scanner compatibility before an MRI scan.</Text>
      {signedIn ? (
        <Pressable style={styles.button} onPress={() => router.push('/quickcheck')}>
          <Text style={styles.buttonText}>START QUICKCHECK</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.button} onPress={() => router.push('/sign-in')}>
          <Text style={styles.buttonText}>SIGN IN</Text>
        </Pressable>
      )}
      <Text style={styles.note}>Unknown or unverified devices are never treated as safe.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, padding: 28, justifyContent: 'center', backgroundColor: '#f7f9fc' },
  eyebrow: { fontSize: 13, fontWeight: '700', letterSpacing: 2 },
  title: { fontSize: 42, fontWeight: '800', marginTop: 8 },
  subtitle: { fontSize: 18, lineHeight: 27, marginTop: 14, marginBottom: 30 },
  button: { padding: 18, borderRadius: 12, backgroundColor: '#111827', alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '800', letterSpacing: 0.5 },
  note: { marginTop: 20, fontSize: 13, lineHeight: 19, opacity: 0.65 },
});
