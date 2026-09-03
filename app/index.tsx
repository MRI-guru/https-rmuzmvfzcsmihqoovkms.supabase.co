import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSignedIn(Boolean(data.session)); setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session)));
    return () => data.subscription.unsubscribe();
  }, []);
  if (loading) return <View style={styles.loading}><ActivityIndicator /></View>;
  if (!acknowledged) return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.kicker}>MRI SAFETY QUICKCHECK</Text>
        <Text style={styles.title}>Important Safety Disclaimer</Text>
        <Text style={styles.body}>
          This app is a decision-support tool and is not a substitute for the manufacturer’s current MRI safety labeling, Instructions for Use (IFU), or other official manufacturer guidance.
        </Text>
        <Text style={styles.body}>
          Always verify the exact implant/device, components, scanner, field strength, and all applicable conditions directly against the current manufacturer guidelines before scanning.
        </Text>
        <Text style={styles.warning}>
          Do not use this app alone to determine whether a patient is safe to scan. When information is missing, uncertain, or conflicts with manufacturer labeling, stop and follow the manufacturer’s guidance and your facility’s MRI safety procedures.
        </Text>
        <Pressable style={styles.button} onPress={() => setAcknowledged(true)}>
          <Text style={styles.buttonText}>I UNDERSTAND — CONTINUE</Text>
        </Pressable>
      </View>
    </View>
  );
  return <Redirect href={signedIn ? '/(app)/dashboard' : '/(auth)/sign-in'} />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: '#f7f9fc', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 22, padding: 24, borderWidth: 1, borderColor: '#e4e7ec' },
  kicker: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: '#667085', marginBottom: 10 },
  title: { fontSize: 26, fontWeight: '900', color: '#101828', marginBottom: 16 },
  body: { fontSize: 15, lineHeight: 23, color: '#344054', marginBottom: 14 },
  warning: { fontSize: 14, lineHeight: 21, fontWeight: '700', color: '#b42318', backgroundColor: '#fef3f2', borderRadius: 12, padding: 14, marginTop: 4, marginBottom: 20 },
  button: { minHeight: 52, borderRadius: 13, backgroundColor: '#175cd3', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  buttonText: { color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
});
