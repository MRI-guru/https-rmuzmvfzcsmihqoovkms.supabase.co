import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Card, SectionTitle } from '@/components/ui';

export default function Settings() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('technologist');
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ''));
    supabase.rpc('quickcheck_get_profile').then(({ data }) => {
      const profile = Array.isArray(data) ? data[0] : data;
      if (profile?.role) setRole(String(profile.role));
    });
  }, []);
  async function signOut() { const { error } = await supabase.auth.signOut(); if (error) Alert.alert('Sign out', error.message); else router.replace('/(auth)/sign-in'); }
  const staff = ['mrso', 'supervisor', 'admin'].includes(role.toLowerCase());
  return <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
    <View style={styles.header}><Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable><Text style={styles.title}>Settings</Text><View style={{ width: 55 }}/></View>
    <Card><SectionTitle title="Account"/><Text style={styles.label}>SIGNED IN AS</Text><Text selectable style={styles.email}>{email || 'Account'}</Text><Text style={styles.role}>{role.toUpperCase()}</Text></Card>
    <Pressable style={styles.scannerCard} onPress={() => router.push('/(app)/scanner-profiles')}><View style={{ flex: 1 }}><Text style={styles.scannerKicker}>WORKFLOW</Text><Text style={styles.scannerTitle}>Saved MRI scanners</Text><Text style={styles.scannerBody}>Save scanner make, model and 1.5T/3T strength for faster QuickCheck selection.</Text></View><Text style={styles.arrowDark}>›</Text></Pressable>
    {staff ? <Pressable style={styles.staffCard} onPress={() => router.push('/(app)/verification')}><View style={{ flex: 1 }}><Text style={styles.staffKicker}>STAFF TOOLS</Text><Text style={styles.staffTitle}>Verification Center</Text><Text style={styles.staffBody}>Review QuickCheck activity and safety verification posture.</Text></View><Text style={styles.arrow}>›</Text></Pressable> : null}
    <Card><SectionTitle title="Safety policy"/><Text style={styles.body}>QuickCheck uses manufacturer labeling as the primary authority. Exact device, component, scanner field strength, scan region, and applicable conditions must be matched. Saved scanner make/model is workflow context and does not replace implant manufacturer MRI labeling.</Text></Card>
    <Card><SectionTitle title="App"/><Text style={styles.body}>MRI Safety QuickCheck • v1.0</Text></Card>
    <Pressable onPress={signOut} style={styles.signOut}><Text style={styles.signOutText}>SIGN OUT</Text></Pressable>
  </ScrollView>;
}
const styles=StyleSheet.create({content:{flexGrow:1,padding:20,paddingBottom:40,gap:14,backgroundColor:'#f7f9fc'},header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingTop:8,paddingBottom:6},back:{fontSize:16,fontWeight:'800',color:'#175cd3'},title:{fontSize:24,fontWeight:'900',color:'#101828'},label:{fontSize:10,fontWeight:'900',letterSpacing:1,color:'#667085'},email:{fontSize:16,fontWeight:'700',color:'#101828'},role:{alignSelf:'flex-start',marginTop:10,paddingHorizontal:9,paddingVertical:5,borderRadius:7,backgroundColor:'#eef4ff',fontSize:9,fontWeight:'900',letterSpacing:1,color:'#175cd3'},scannerCard:{minHeight:112,borderRadius:18,backgroundColor:'#fff',borderWidth:1,borderColor:'#dbe3ef',padding:18,flexDirection:'row',alignItems:'center'},scannerKicker:{fontSize:9,fontWeight:'900',letterSpacing:1.3,color:'#667085'},scannerTitle:{fontSize:18,fontWeight:'900',color:'#101828',marginTop:3},scannerBody:{fontSize:12,lineHeight:18,color:'#667085',marginTop:4},arrowDark:{fontSize:34,color:'#344054'},staffCard:{minHeight:112,borderRadius:18,backgroundColor:'#111827',padding:18,flexDirection:'row',alignItems:'center'},staffKicker:{fontSize:9,fontWeight:'900',letterSpacing:1.3,color:'#98a2b3'},staffTitle:{fontSize:18,fontWeight:'900',color:'#fff',marginTop:3},staffBody:{fontSize:12,lineHeight:18,color:'#d0d5dd',marginTop:4},arrow:{fontSize:34,color:'#fff'},body:{fontSize:14,lineHeight:22,color:'#475467'},signOut:{minHeight:54,borderRadius:14,borderWidth:1,borderColor:'#f04438',alignItems:'center',justifyContent:'center',backgroundColor:'#fff'},signOutText:{fontWeight:'900',color:'#b42318'}});