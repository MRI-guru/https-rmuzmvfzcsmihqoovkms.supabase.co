import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Card, SectionTitle } from '@/components/ui';

export default function Settings() {
  const [email, setEmail] = useState('');
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? '')); }, []);
  async function signOut() { const { error } = await supabase.auth.signOut(); if (error) Alert.alert('Sign out', error.message); else router.replace('/(auth)/sign-in'); }
  return <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
    <View style={styles.header}><Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable><Text style={styles.title}>Settings</Text><View style={{ width: 55 }}/></View>
    <Card><SectionTitle title="Account"/><Text style={styles.label}>SIGNED IN AS</Text><Text selectable style={styles.email}>{email || 'Account'}</Text></Card>
    <Card><SectionTitle title="Safety policy"/><Text style={styles.body}>QuickCheck uses manufacturer labeling as the primary authority. Exact device, component, scanner, field strength, scan region, and applicable conditions must be matched. Unknown or unverified configurations are never treated as safe.</Text></Card>
    <Card><SectionTitle title="App"/><Text style={styles.body}>MRI Safety QuickCheck • v1.0</Text></Card>
    <Pressable onPress={signOut} style={styles.signOut}><Text style={styles.signOutText}>SIGN OUT</Text></Pressable>
  </ScrollView>;
}
const styles=StyleSheet.create({content:{flexGrow:1,padding:20,paddingBottom:40,gap:14,backgroundColor:'#f7f9fc'},header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingTop:8,paddingBottom:6},back:{fontSize:16,fontWeight:'800',color:'#175cd3'},title:{fontSize:24,fontWeight:'900',color:'#101828'},label:{fontSize:10,fontWeight:'900',letterSpacing:1,color:'#667085'},email:{fontSize:16,fontWeight:'700',color:'#101828'},body:{fontSize:14,lineHeight:22,color:'#475467'},signOut:{minHeight:54,borderRadius:14,borderWidth:1,borderColor:'#f04438',alignItems:'center',justifyContent:'center',backgroundColor:'#fff'},signOutText:{fontWeight:'900',color:'#b42318'}});
