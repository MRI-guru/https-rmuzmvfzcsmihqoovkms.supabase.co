import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Card, SectionTitle } from '@/components/ui';

type Profile = { role?: string | null; email?: string | null; [key: string]: unknown };
type Check = { id: string; result?: Record<string, any> | null; status?: string | null; created_at: string; scanner_strength_t?: number | null; scan_region?: string | null };

const STAFF_ROLES = new Set(['mrso', 'supervisor', 'admin']);

export default function Verification() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [checks, setChecks] = useState<Check[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    const { data: profileData, error: profileError } = await supabase.rpc('quickcheck_get_profile');
    if (profileError) { setError(profileError.message); setLoading(false); return; }
    const raw = Array.isArray(profileData) ? profileData[0] : profileData;
    setProfile((raw ?? null) as Profile | null);
    const role = String(raw?.role ?? '').toLowerCase();
    if (STAFF_ROLES.has(role)) {
      const { data, error: checksError } = await supabase.from('scanner_checks').select('id,result,status,created_at,scanner_strength_t,scan_region').order('created_at', { ascending: false }).limit(50);
      if (checksError) setError(checksError.message);
      setChecks((data ?? []) as Check[]);
    } else {
      setChecks([]);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  async function refresh() { setRefreshing(true); await load(); setRefreshing(false); }

  if (loading) return <View style={styles.center}><ActivityIndicator /></View>;
  const role = String(profile?.role ?? '').toLowerCase();
  const isStaff = STAFF_ROLES.has(role);

  return <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
    <View style={styles.header}><Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable><Text style={styles.title}>Verification Center</Text><View style={{ width: 55 }} /></View>
    <View style={styles.banner}><Text style={styles.bannerKicker}>STAFF ACCESS</Text><Text style={styles.bannerTitle}>{isStaff ? 'Clinical safety oversight' : 'Technologist access'}</Text><Text style={styles.bannerBody}>{isStaff ? 'Review QuickCheck activity and verification posture. Catalog changes remain controlled by authorized backend workflows.' : 'Verification tools are restricted to MRSO, supervisor, and administrator roles.'}</Text></View>

    {error ? <Card><Text style={styles.error}>{error}</Text></Card> : null}
    {!isStaff ? <Card><SectionTitle title="Access restricted"/><Text style={styles.body}>Your current role is {role || 'technologist'}. You can perform QuickChecks and review your own history, but staff verification activity is not available to this account.</Text><Pressable style={styles.primary} onPress={() => router.replace('/(app)/dashboard')}><Text style={styles.primaryText}>RETURN TO DASHBOARD</Text></Pressable></Card> : <>
      <View style={styles.stats}>
        <View style={styles.stat}><Text style={styles.statValue}>{checks.length}</Text><Text style={styles.statLabel}>RECENT CHECKS</Text></View>
        <View style={styles.stat}><Text style={styles.statValue}>{checks.filter(c => String(c.result?.status ?? c.status).toLowerCase() === 'unknown').length}</Text><Text style={styles.statLabel}>UNKNOWN</Text></View>
      </View>
      <Card><SectionTitle title="Oversight activity" subtitle="Most recent QuickCheck records visible to staff."/>{checks.length === 0 ? <Text style={styles.body}>No QuickCheck records are available yet.</Text> : checks.map((item) => { const result = item.result ?? {}; const status = String(result.display_status ?? result.status ?? item.status ?? 'UNKNOWN').toUpperCase(); const device = String(result.device?.model ?? result.device?.model_name ?? 'Implant check'); return <View key={item.id} style={styles.row}><View style={styles.badge}><Text style={styles.badgeText}>{status === 'UNSAFE' ? 'NOT SAFE' : status}</Text></View><View style={styles.rowCopy}><Text style={styles.rowTitle}>{device}</Text><Text style={styles.rowMeta}>{item.scanner_strength_t ? `${item.scanner_strength_t}T` : 'Field'} • {item.scan_region || 'Region'} • {new Date(item.created_at).toLocaleString()}</Text></View></View>; })}</Card>
      <Card><SectionTitle title="Verification controls"/><Text style={styles.body}>Manufacturer labeling remains the primary authority. Device and component records should be changed only after source documentation is reviewed. Unverified or incomplete configurations must remain UNKNOWN and require human review.</Text><Text style={styles.note}>This screen does not grant clearance or replace the manufacturer’s current MRI labeling.</Text></Card>
    </>}
  </ScrollView>;
}

const styles=StyleSheet.create({content:{flexGrow:1,padding:20,paddingBottom:40,gap:14,backgroundColor:'#f7f9fc'},center:{flex:1,alignItems:'center',justifyContent:'center'},header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingTop:8,paddingBottom:6},back:{fontSize:16,fontWeight:'800',color:'#175cd3'},title:{fontSize:22,fontWeight:'900',color:'#101828'},banner:{borderRadius:20,backgroundColor:'#111827',padding:20,gap:5},bannerKicker:{fontSize:10,fontWeight:'900',letterSpacing:1.5,color:'#98a2b3'},bannerTitle:{fontSize:20,fontWeight:'900',color:'#fff'},bannerBody:{fontSize:13,lineHeight:20,color:'#d0d5dd'},stats:{flexDirection:'row',gap:12},stat:{flex:1,backgroundColor:'#fff',borderRadius:16,borderWidth:1,borderColor:'#e4e7ec',padding:16},statValue:{fontSize:25,fontWeight:'900',color:'#101828'},statLabel:{fontSize:9,fontWeight:'900',letterSpacing:1,color:'#667085',marginTop:3},body:{fontSize:14,lineHeight:21,color:'#475467'},error:{fontSize:13,lineHeight:20,color:'#b42318'},row:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:9,borderBottomWidth:1,borderBottomColor:'#f2f4f7'},badge:{minWidth:78,paddingHorizontal:8,paddingVertical:7,borderRadius:8,backgroundColor:'#f2f4f7',alignItems:'center'},badgeText:{fontSize:9,fontWeight:'900',color:'#344054'},rowCopy:{flex:1},rowTitle:{fontSize:14,fontWeight:'800',color:'#101828'},rowMeta:{fontSize:11,color:'#667085',marginTop:2},primary:{marginTop:15,minHeight:50,borderRadius:13,backgroundColor:'#175cd3',alignItems:'center',justifyContent:'center'},primaryText:{fontSize:12,fontWeight:'900',color:'#fff'},note:{fontSize:12,lineHeight:18,color:'#667085',marginTop:12}});