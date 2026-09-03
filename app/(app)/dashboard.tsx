import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { router } from 'expo-router';
import { Card, SectionTitle } from '@/components/ui';
import { supabase } from '@/lib/supabase';

export default function Dashboard() {
  const [email, setEmail] = useState('');
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [{ data: user }, { data: checks }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from('scanner_checks').select('id,status,result,created_at,scan_region,scanner_strength_t,device_id,component_id,scanner_model_id').order('created_at', { ascending: false }).limit(3),
    ]);
    setEmail(user.user?.email ?? '');
    setRecent(checks ?? []);
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  async function refresh() { setRefreshing(true); await load(); setRefreshing(false); }
  if (loading) return <View style={styles.center}><ActivityIndicator /></View>;

  return <ScrollView contentInsetAdjustmentBehavior="automatic" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />} contentContainerStyle={styles.content}>
    <View style={styles.header}>
      <View><Text style={styles.eyebrow}>MRI SAFETY</Text><Text style={styles.title}>QuickCheck</Text><Text style={styles.greeting}>Ready for your next safety check.</Text></View>
      <Pressable style={styles.settings} onPress={() => router.push('/(app)/settings')}><Text style={styles.settingsText}>⚙</Text></Pressable>
    </View>

    <Pressable onPress={() => router.push('/(app)/quickcheck')} style={styles.hero}>
      <View style={styles.heroIcon}><Text style={styles.heroIconText}>✓</Text></View>
      <View style={styles.heroCopy}><Text style={styles.heroTitle}>Start a QuickCheck</Text><Text style={styles.heroBody}>Verify the exact implant, component, scanner and field strength.</Text></View>
      <Text style={styles.arrow}>›</Text>
    </Pressable>

    <View style={styles.grid}>
      <Pressable style={styles.tile} onPress={() => router.push('/(app)/history')}><Text style={styles.tileKicker}>HISTORY</Text><Text style={styles.tileTitle}>{recent.length ? 'Recent checks' : 'No checks yet'}</Text><Text style={styles.tileBody}>Review previous safety decisions.</Text></Pressable>
      <Pressable style={styles.tile} onPress={() => router.push('/(app)/settings')}><Text style={styles.tileKicker}>ACCOUNT</Text><Text style={styles.tileTitle}>Settings</Text><Text style={styles.tileBody}>{email || 'Manage your account.'}</Text></Pressable>
    </View>

    <Card><SectionTitle title="Recent checks" subtitle="Your latest QuickCheck activity."/>{recent.length === 0 ? <Text style={styles.empty}>Your completed checks will appear here.</Text> : recent.map((item) => <RecentRow key={item.id} item={item} />)}<Pressable onPress={() => router.push('/(app)/history')}><Text style={styles.link}>VIEW FULL HISTORY →</Text></Pressable></Card>
    <Card><SectionTitle title="Safety first"/><Text style={styles.policy}>Manufacturer labeling is the primary authority. CONDITIONAL results require every listed condition to be satisfied. UNKNOWN is never safe.</Text></Card>
    <Text style={styles.version}>MRI Safety QuickCheck • v1.0</Text>
  </ScrollView>;
}
function RecentRow({ item }: { item: any }) {
  const result = item.result ?? {};
  const status = String(result.display_status ?? result.status ?? item.status ?? 'UNKNOWN').toUpperCase();
  return <View style={styles.row}><View style={styles.rowBadge}><Text style={styles.rowBadgeText}>{status === 'UNSAFE' ? 'NOT SAFE' : status}</Text></View><View style={styles.rowCopy}><Text style={styles.rowTitle}>{String(result.device?.model ?? result.device?.model_name ?? 'Implant check')}</Text><Text style={styles.rowMeta}>{item.scanner_strength_t ? `${item.scanner_strength_t}T` : 'Field'} • {item.scan_region || 'Region'} • {new Date(item.created_at).toLocaleDateString()}</Text></View></View>;
}
const styles=StyleSheet.create({content:{flexGrow:1,padding:20,paddingBottom:40,gap:14,backgroundColor:'#f7f9fc'},center:{flex:1,alignItems:'center',justifyContent:'center'},header:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',paddingTop:8},eyebrow:{fontSize:11,fontWeight:'900',letterSpacing:2,color:'#667085'},title:{fontSize:34,fontWeight:'900',color:'#101828',marginTop:3},greeting:{fontSize:14,color:'#667085',marginTop:5},settings:{width:42,height:42,borderRadius:12,backgroundColor:'#fff',borderWidth:1,borderColor:'#e4e7ec',alignItems:'center',justifyContent:'center'},settingsText:{fontSize:19},hero:{minHeight:132,borderRadius:22,backgroundColor:'#111827',padding:20,flexDirection:'row',alignItems:'center',gap:14},heroIcon:{width:48,height:48,borderRadius:16,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},heroIconText:{fontSize:25,fontWeight:'900',color:'#111827'},heroCopy:{flex:1,gap:5},heroTitle:{fontSize:19,fontWeight:'900',color:'#fff'},heroBody:{fontSize:13,lineHeight:19,color:'#d0d5dd'},arrow:{fontSize:34,color:'#fff'},grid:{flexDirection:'row',gap:12},tile:{flex:1,minHeight:122,borderRadius:18,backgroundColor:'#fff',borderWidth:1,borderColor:'#e4e7ec',padding:16,gap:5},tileKicker:{fontSize:10,fontWeight:'900',letterSpacing:1,color:'#667085'},tileTitle:{fontSize:16,fontWeight:'900',color:'#101828'},tileBody:{fontSize:12,lineHeight:17,color:'#667085'},empty:{fontSize:14,lineHeight:21,color:'#667085'},row:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:7},rowBadge:{minWidth:78,paddingHorizontal:8,paddingVertical:7,borderRadius:9,backgroundColor:'#f2f4f7',alignItems:'center'},rowBadgeText:{fontSize:9,fontWeight:'900',color:'#344054'},rowCopy:{flex:1,gap:2},rowTitle:{fontSize:14,fontWeight:'800',color:'#101828'},rowMeta:{fontSize:11,color:'#667085'},link:{fontSize:12,fontWeight:'900',color:'#175cd3',paddingTop:5},policy:{fontSize:13,lineHeight:20,color:'#475467'},version:{fontSize:11,color:'#98a2b3',textAlign:'center'}});