import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Card, SectionTitle } from '@/components/ui';
import { createSourceSignedUrl, pickPdf, removeUploadedPdf, uploadPdfForDevice, SIGNED_URL_SECONDS, type PickedPdf } from '@/lib/sourceDocuments';

type Profile = { role?: string | null; email?: string | null; [key: string]: unknown };
type Check = { id: string; result?: Record<string, any> | null; status?: string | null; created_at: string; scanner_strength_t?: number | null; scan_region?: string | null };
type Device = { id: string; model?: string | null; manufacturer_model_number?: string | null; device_type?: string | null; labeling_status?: string | null; manufacturer?: { name?: string | null } | null };
type Source = { id: string; device_id: string; source_type?: string | null; title?: string | null; source_url?: string | null; source_identifier?: string | null; verified_at?: string | null; current?: boolean | null; notes?: string | null; review_status?: string | null; storage_path?: string | null; content_type?: string | null; file_size?: number | null };

const STAFF_ROLES = new Set(['mrso', 'supervisor', 'admin']);
const SOURCE_TYPES = ['manufacturer_ifu', 'manufacturer_web', 'regulatory', 'other'];

export default function Verification() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [checks, setChecks] = useState<Check[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [showAddSource, setShowAddSource] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [sourceType, setSourceType] = useState('manufacturer_ifu');
  const [notes, setNotes] = useState('');
  const [pickedPdf, setPickedPdf] = useState<PickedPdf | null>(null);
  const [busy, setBusy] = useState(false);

  const loadSources = useCallback(async (deviceId: string) => {
    const { data, error } = await supabase.from('device_sources').select('id,device_id,source_type,title,source_url,source_identifier,verified_at,current,notes,review_status,storage_path,content_type,file_size').eq('device_id', deviceId).order('current', { ascending: false }).order('created_at', { ascending: false });
    if (error) setError(error.message);
    setSources((data ?? []) as Source[]);
  }, []);

  const load = useCallback(async () => {
    setError('');
    const { data: profileData, error: profileError } = await supabase.rpc('quickcheck_get_profile');
    if (profileError) { setError(profileError.message); setLoading(false); return; }
    const raw = Array.isArray(profileData) ? profileData[0] : profileData;
    setProfile((raw ?? null) as Profile | null);
    const role = String(raw?.role ?? '').toLowerCase();
    if (!STAFF_ROLES.has(role)) { setLoading(false); return; }
    const [{ data: checksData, error: checksError }, { data: deviceData, error: deviceError }] = await Promise.all([
      supabase.from('scanner_checks').select('id,result,status,created_at,scanner_strength_t,scan_region').order('created_at', { ascending: false }).limit(50),
      supabase.from('devices').select('id,model,manufacturer_model_number,device_type,labeling_status,manufacturer:manufacturers(name)').eq('active', true).order('model').limit(200),
    ]);
    if (checksError) setError(checksError.message);
    if (deviceError) setError(deviceError.message);
    setChecks((checksData ?? []) as Check[]);
    setDevices((deviceData ?? []) as unknown as Device[]);
    if (selectedDevice) await loadSources(selectedDevice.id);
    setLoading(false);
  }, [loadSources, selectedDevice]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  async function refresh() { setRefreshing(true); await load(); setRefreshing(false); }

  async function choosePdf() {
    try {
      const pdf = await pickPdf();
      if (pdf) setPickedPdf(pdf);
    } catch (e) {
      Alert.alert('PDF selection failed', e instanceof Error ? e.message : 'Could not select the PDF.');
    }
  }

  async function addSource() {
    if (!selectedDevice || !title.trim()) { Alert.alert('Missing information', 'Select a device and enter a source title.'); return; }
    if (!pickedPdf && !url.trim()) { Alert.alert('Source required', 'Attach a PDF or enter an HTTPS source URL.'); return; }
    if (url.trim() && !/^https:\/\//i.test(url.trim())) { Alert.alert('Secure source required', 'Source URLs must use HTTPS.'); return; }
    setBusy(true);
    let storagePath = '';
    try {
      if (pickedPdf) {
        const uploaded = await uploadPdfForDevice(selectedDevice.id, pickedPdf);
        storagePath = uploaded.path;
        const { error } = await supabase.rpc('quickcheck_staff_add_source', {
          p_device_id: selectedDevice.id,
          p_source_type: sourceType,
          p_title: title.trim(),
          p_source_url: url.trim() || null,
          p_source_identifier: identifier.trim() || null,
          p_notes: notes.trim() || null,
          p_storage_path: storagePath,
          p_content_type: 'application/pdf',
          p_file_size: uploaded.size,
          p_document_hash: null,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc('quickcheck_staff_add_source', {
          p_device_id: selectedDevice.id,
          p_source_type: sourceType,
          p_title: title.trim(),
          p_source_url: url.trim(),
          p_source_identifier: identifier.trim() || null,
          p_notes: notes.trim() || null,
          p_storage_path: null,
          p_content_type: 'application/pdf',
          p_file_size: null,
          p_document_hash: null,
        });
        if (error) throw error;
      }
      setTitle(''); setUrl(''); setIdentifier(''); setNotes(''); setPickedPdf(null); setShowAddSource(false);
      await loadSources(selectedDevice.id);
      Alert.alert('Source added', pickedPdf ? 'The PDF is securely attached to the source record and is pending review.' : 'The source is pending review.');
    } catch (e) {
      if (storagePath) await removeUploadedPdf(storagePath);
      Alert.alert('Could not add source', e instanceof Error ? e.message : 'The source could not be saved.');
    } finally { setBusy(false); }
  }

  async function reviewSource(source: Source, approve: boolean) {
    const reason = approve ? 'Manufacturer source reviewed and accepted as current labeling.' : 'Source returned to review during staff oversight.';
    setBusy(true);
    const { error } = await supabase.rpc('quickcheck_staff_review_source', { p_source_id: source.id, p_review_status: approve ? 'approved' : 'pending', p_reason: reason });
    setBusy(false);
    if (error) { Alert.alert('Review failed', error.message); return; }
    await loadSources(source.device_id);
    Alert.alert(approve ? 'Source approved' : 'Source returned', approve ? 'This source is now current. Device verification remains a separate action.' : 'This source is pending review again.');
  }

  async function openPdf(source: Source) {
    if (!source.storage_path) { Alert.alert('No PDF attached', 'This source is metadata-only and has no stored PDF.'); return; }
    setBusy(true);
    try {
      const signedUrl = await createSourceSignedUrl(source.storage_path, SIGNED_URL_SECONDS);
      await Linking.openURL(signedUrl);
    } catch (e) {
      Alert.alert('Could not open PDF', e instanceof Error ? e.message : 'Could not create a secure document link.');
    } finally { setBusy(false); }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator /></View>;
  const role = String(profile?.role ?? '').toLowerCase();
  const isStaff = STAFF_ROLES.has(role);
  const filteredDevices = devices.filter(d => { const q = search.trim().toLowerCase(); return !q || `${d.model ?? ''} ${d.manufacturer_model_number ?? ''} ${d.manufacturer?.name ?? ''}`.toLowerCase().includes(q); });

  return <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
    <View style={styles.header}><Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable><Text style={styles.title}>Verification Center</Text><View style={{ width: 55 }} /></View>
    <View style={styles.banner}><Text style={styles.bannerKicker}>STAFF ACCESS</Text><Text style={styles.bannerTitle}>{isStaff ? 'Source & catalog oversight' : 'Technologist access'}</Text><Text style={styles.bannerBody}>{isStaff ? 'Upload manufacturer PDFs into private storage, review evidence, and maintain the source trail used by the safety engine.' : 'Verification tools are restricted to MRSO, supervisor, and administrator roles.'}</Text></View>
    {error ? <Card><Text style={styles.error}>{error}</Text></Card> : null}
    {!isStaff ? <Card><SectionTitle title="Access restricted"/><Text style={styles.body}>Your current role is {role || 'technologist'}. Staff verification activity is not available to this account.</Text></Card> : <>
      <Card><SectionTitle title="Source-document workflow" subtitle="Attach an exact manufacturer PDF to the selected device, or register an authoritative HTTPS source."/><TextInput value={search} onChangeText={setSearch} placeholder="Search manufacturer or exact model" autoCapitalize="none" style={styles.input}/>{filteredDevices.slice(0, 20).map(device => <Pressable key={device.id} style={[styles.deviceRow, selectedDevice?.id === device.id && styles.selected]} onPress={async () => { setSelectedDevice(device); await loadSources(device.id); }}><View style={styles.deviceCopy}><Text style={styles.rowTitle}>{device.manufacturer?.name ?? 'Manufacturer'} • {device.model ?? device.manufacturer_model_number ?? 'Model'}</Text><Text style={styles.rowMeta}>{device.manufacturer_model_number ?? 'No manufacturer model number'} • {String(device.labeling_status ?? 'unverified').toUpperCase()}</Text></View><Text style={styles.chevron}>{selectedDevice?.id === device.id ? '✓' : '›'}</Text></Pressable>)}</Card>
      {selectedDevice ? <Card><SectionTitle title="Evidence for selected device" subtitle={`${selectedDevice.manufacturer?.name ?? 'Manufacturer'} ${selectedDevice.model ?? selectedDevice.manufacturer_model_number ?? ''}`}/><View style={styles.statusLine}><Text style={styles.statusLabel}>Device labeling</Text><Text style={styles.statusValue}>{String(selectedDevice.labeling_status ?? 'unverified').toUpperCase()}</Text></View><Pressable style={styles.primary} onPress={() => setShowAddSource(v => !v)}><Text style={styles.primaryText}>{showAddSource ? 'CANCEL' : 'ADD SOURCE DOCUMENT'}</Text></Pressable>
        {showAddSource ? <View style={styles.form}><Text style={styles.label}>Source title</Text><TextInput value={title} onChangeText={setTitle} placeholder="Manufacturer MRI labeling / IFU title" style={styles.input}/><Text style={styles.label}>Attach PDF</Text><Pressable style={styles.uploadButton} disabled={busy} onPress={choosePdf}><Text style={styles.uploadTitle}>{pickedPdf ? 'PDF SELECTED' : 'CHOOSE PDF'}</Text><Text style={styles.uploadMeta}>{pickedPdf ? `${pickedPdf.name}${pickedPdf.size ? ` • ${Math.round(pickedPdf.size / 1024)} KB` : ''}` : 'Private storage • PDF only • 50 MB max'}</Text></Pressable><Text style={styles.label}>Optional HTTPS source URL</Text><TextInput value={url} onChangeText={setUrl} placeholder="https://manufacturer.com/..." autoCapitalize="none" keyboardType="url" style={styles.input}/><Text style={styles.label}>Document / publication identifier</Text><TextInput value={identifier} onChangeText={setIdentifier} placeholder="Document number, revision, or publication ID" style={styles.input}/><Text style={styles.label}>Notes</Text><TextInput value={notes} onChangeText={setNotes} placeholder="What was reviewed?" multiline style={[styles.input, styles.multiline]}/><View style={styles.typeRow}>{SOURCE_TYPES.map(type => <Pressable key={type} onPress={() => setSourceType(type)} style={[styles.typeChip, sourceType === type && styles.typeChipSelected]}><Text style={styles.typeText}>{type.replace('_', ' ')}</Text></Pressable>)}</View><Pressable style={[styles.primary, busy && { opacity: .5 }]} disabled={busy} onPress={addSource}><Text style={styles.primaryText}>{busy ? 'UPLOADING…' : 'SAVE FOR REVIEW'}</Text></Pressable><Text style={styles.securityNote}>PDFs are stored in a private bucket. Staff access is enforced by Storage RLS, and opening a PDF creates a {SIGNED_URL_SECONDS / 60}-minute signed URL.</Text></View> : null}
        <View style={{ marginTop: 18 }}><SectionTitle title="Source review queue"/>{sources.length === 0 ? <Text style={styles.body}>No sources are attached to this device yet.</Text> : sources.map(source => <View key={source.id} style={styles.sourceCard}><View style={styles.sourceHeader}><Text style={styles.rowTitle}>{source.title ?? 'Untitled source'}</Text><Text style={[styles.sourceBadge, source.current ? styles.current : styles.pending]}>{source.current ? 'CURRENT' : String(source.review_status ?? 'pending').toUpperCase()}</Text></View><Text style={styles.rowMeta}>{source.source_type ?? 'source'} {source.source_identifier ? `• ${source.source_identifier}` : ''}</Text>{source.storage_path ? <Pressable onPress={() => openPdf(source)} disabled={busy} style={styles.pdfButton}><Text style={styles.pdfButtonText}>OPEN ATTACHED PDF</Text><Text style={styles.pdfMeta}>{source.content_type ?? 'application/pdf'}{source.file_size ? ` • ${Math.round(source.file_size / 1024)} KB` : ''} • signed link expires in {SIGNED_URL_SECONDS / 60} min</Text></Pressable> : null}{source.source_url ? <Text style={styles.sourceUrl}>{source.source_url}</Text> : null}{!source.storage_path && !source.source_url ? <Text style={styles.sourceUrl}>No PDF or source URL attached</Text> : null}{source.notes ? <Text style={styles.note}>{source.notes}</Text> : null}<View style={styles.actionRow}>{!source.current ? <Pressable disabled={busy} style={styles.approve} onPress={() => reviewSource(source, true)}><Text style={styles.actionText}>APPROVE CURRENT</Text></Pressable> : <Pressable disabled={busy} style={styles.reject} onPress={() => reviewSource(source, false)}><Text style={styles.actionText}>RETURN TO REVIEW</Text></Pressable>}</View></View>)}</View>
      </Card> : null}
      <Card><SectionTitle title="Oversight activity" subtitle="Most recent QuickCheck records visible to staff."/>{checks.length === 0 ? <Text style={styles.body}>No QuickCheck records are available yet.</Text> : checks.map(item => { const result=item.result??{}; const status=String(result.display_status??result.status??item.status??'UNKNOWN').toUpperCase(); const device=String(result.device?.model??result.device?.model_name??'Implant check'); return <View key={item.id} style={styles.row}><View style={styles.badge}><Text style={styles.badgeText}>{status === 'UNSAFE' ? 'NOT SAFE' : status}</Text></View><View style={styles.rowCopy}><Text style={styles.rowTitle}>{device}</Text><Text style={styles.rowMeta}>{item.scanner_strength_t ? `${item.scanner_strength_t}T` : 'Field'} • {item.scan_region || 'Region'} • {new Date(item.created_at).toLocaleString()}</Text></View></View>; })}</Card>
      <Card><SectionTitle title="Safety rule"/><Text style={styles.body}>A current source is evidence, not automatic clearance. Staff must verify the exact device labeling and configuration separately. Missing, outdated, or incomplete evidence remains unverified/UNKNOWN.</Text></Card>
    </>}
  </ScrollView>;
}

const styles=StyleSheet.create({content:{flexGrow:1,padding:20,paddingBottom:40,gap:14,backgroundColor:'#f7f9fc'},center:{flex:1,alignItems:'center',justifyContent:'center'},header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingTop:8,paddingBottom:6},back:{fontSize:16,fontWeight:'800',color:'#175cd3'},title:{fontSize:22,fontWeight:'900',color:'#101828'},banner:{borderRadius:20,backgroundColor:'#111827',padding:20,gap:5},bannerKicker:{fontSize:10,fontWeight:'900',letterSpacing:1.5,color:'#98a2b3'},bannerTitle:{fontSize:20,fontWeight:'900',color:'#fff'},bannerBody:{fontSize:13,lineHeight:20,color:'#d0d5dd'},body:{fontSize:14,lineHeight:21,color:'#475467'},error:{fontSize:13,lineHeight:20,color:'#b42318'},input:{borderWidth:1,borderColor:'#d0d5dd',borderRadius:12,paddingHorizontal:13,paddingVertical:11,backgroundColor:'#fff',fontSize:14,color:'#101828',marginTop:8},multiline:{minHeight:90,textAlignVertical:'top'},deviceRow:{flexDirection:'row',alignItems:'center',paddingVertical:12,borderBottomWidth:1,borderBottomColor:'#f2f4f7',gap:10},selected:{backgroundColor:'#f2f7ff',borderRadius:10,paddingHorizontal:10},deviceCopy:{flex:1},rowTitle:{fontSize:14,fontWeight:'800',color:'#101828'},rowMeta:{fontSize:11,color:'#667085',marginTop:3},chevron:{fontSize:22,color:'#98a2b3'},statusLine:{flexDirection:'row',justifyContent:'space-between',paddingVertical:10},statusLabel:{fontSize:12,color:'#667085',fontWeight:'700'},statusValue:{fontSize:11,color:'#344054',fontWeight:'900'},primary:{marginTop:12,minHeight:48,borderRadius:12,backgroundColor:'#175cd3',alignItems:'center',justifyContent:'center',paddingHorizontal:16},primaryText:{fontSize:11,fontWeight:'900',letterSpacing:.5,color:'#fff'},form:{marginTop:10,paddingTop:8},label:{fontSize:11,fontWeight:'900',color:'#475467',marginTop:10},uploadButton:{marginTop:8,borderWidth:1,borderStyle:'dashed',borderColor:'#84adff',borderRadius:12,padding:14,backgroundColor:'#f7fbff'},uploadTitle:{fontSize:11,fontWeight:'900',color:'#175cd3'},uploadMeta:{fontSize:11,color:'#667085',marginTop:4},typeRow:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:12},typeChip:{paddingHorizontal:10,paddingVertical:8,borderRadius:10,borderWidth:1,borderColor:'#d0d5dd',backgroundColor:'#fff'},typeChipSelected:{backgroundColor:'#eaf2ff',borderColor:'#84adff'},typeText:{fontSize:10,fontWeight:'800',color:'#344054'},securityNote:{fontSize:10,lineHeight:16,color:'#667085',marginTop:10},sourceCard:{marginTop:10,padding:13,borderWidth:1,borderColor:'#e4e7ec',borderRadius:13,backgroundColor:'#fff'},sourceHeader:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:8},sourceBadge:{fontSize:9,fontWeight:'900',paddingHorizontal:7,paddingVertical:5,borderRadius:7,overflow:'hidden'},current:{backgroundColor:'#dcfae6',color:'#027a48'},pending:{backgroundColor:'#fef0c7',color:'#b54708'},sourceUrl:{fontSize:11,color:'#175cd3',marginTop:7},note:{fontSize:11,lineHeight:17,color:'#667085',marginTop:8},pdfButton:{marginTop:9,borderRadius:10,borderWidth:1,borderColor:'#b2ddff',backgroundColor:'#eff8ff',padding:11},pdfButtonText:{fontSize:10,fontWeight:'900',color:'#175cd3'},pdfMeta:{fontSize:10,color:'#667085',marginTop:4},actionRow:{flexDirection:'row',gap:8,marginTop:12},approve:{flex:1,minHeight:42,borderRadius:10,backgroundColor:'#12b76a',alignItems:'center',justifyContent:'center',paddingHorizontal:10},reject:{flex:1,minHeight:42,borderRadius:10,backgroundColor:'#f04438',alignItems:'center',justifyContent:'center',paddingHorizontal:10},actionText:{fontSize:10,fontWeight:'900',color:'#fff'},row:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:12,borderBottomWidth:1,borderBottomColor:'#f2f4f7'},badge:{minWidth:72,paddingHorizontal:8,paddingVertical:6,borderRadius:8,backgroundColor:'#f2f4f7',alignItems:'center'},badgeText:{fontSize:9,fontWeight:'900',color:'#344054'},rowCopy:{flex:1}});