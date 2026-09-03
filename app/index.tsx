import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSignedIn(Boolean(data.session)); setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session)));
    return () => data.subscription.unsubscribe();
  }, []);
  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></View>;
  return <Redirect href={signedIn ? '/(app)/dashboard' : '/(auth)/sign-in'} />;
}
