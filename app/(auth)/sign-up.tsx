import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function SignUp() {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [loading, setLoading] = useState(false);
  async function submit() {
    if (!email.trim() || password.length < 8) return Alert.alert('Create account', 'Use a valid email and a password of at least 8 characters.');
    if (password !== confirm) return Alert.alert('Create account', 'Passwords do not match.');
    setLoading(true); const { data, error } = await supabase.auth.signUp({ email: email.trim(), password }); setLoading(false);
    if (error) return Alert.alert('Sign up failed', error.message);
    if (!data.session) Alert.alert('Check your email', 'Confirm your email address, then return to sign in.');
    router.replace('/(auth)/sign-in');
  }
  return <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.brand}><Text style={styles.brandText}>MRI</Text></View><Text style={styles.eyebrow}>MRI SAFETY</Text><Text style={styles.title}>Create account</Text><Text style={styles.subtitle}>Get access to QuickCheck and your verification history.</Text>
    <View style={styles.form}><Text style={styles.label}>Email</Text><TextInput autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="you@hospital.org" placeholderTextColor="#98a2b3" style={styles.input}/><Text style={styles.label}>Password</Text><TextInput secureTextEntry value={password} onChangeText={setPassword} placeholder="At least 8 characters" placeholderTextColor="#98a2b3" style={styles.input}/><Text style={styles.label}>Confirm password</Text><TextInput secureTextEntry value={confirm} onChangeText={setConfirm} placeholder="Repeat password" placeholderTextColor="#98a2b3" style={styles.input}/><Pressable disabled={loading} onPress={submit} style={styles.button}><Text style={styles.buttonText}>{loading ? 'CREATING…' : 'CREATE ACCOUNT'}</Text></Pressable><Pressable onPress={() => router.replace('/(auth)/sign-in')}><Text style={styles.link}>Already have an account? Sign in</Text></Pressable></View>
  </ScrollView></KeyboardAvoidingView>;
}
const styles=StyleSheet.create({root:{flex:1,backgroundColor:'#f7f9fc'},content:{flexGrow:1,padding:28,justifyContent:'center',gap:8},brand:{width:58,height:58,borderRadius:17,backgroundColor:'#111827',alignItems:'center',justifyContent:'center',marginBottom:18},brandText:{color:'#fff',fontWeight:'900'},eyebrow:{fontSize:12,fontWeight:'900',letterSpacing:2,color:'#667085'},title:{fontSize:36,fontWeight:'900',color:'#101828'},subtitle:{fontSize:16,lineHeight:24,color:'#667085',marginBottom:18},form:{gap:9},label:{fontSize:13,fontWeight:'800',color:'#344054',marginTop:5},input:{backgroundColor:'#fff',borderWidth:1,borderColor:'#d9dee7',borderRadius:13,paddingHorizontal:15,paddingVertical:14,fontSize:16,color:'#101828'},button:{marginTop:10,minHeight:56,borderRadius:14,backgroundColor:'#111827',alignItems:'center',justifyContent:'center'},buttonText:{color:'#fff',fontWeight:'900'},link:{textAlign:'center',color:'#175cd3',fontWeight:'800',padding:12}});
