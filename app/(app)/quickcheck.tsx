import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Card, Choice, PrimaryButton, SearchInput, SectionTitle } from '@/components/ui';
import { getScannerOptions, runQuickCheck, searchComponents, searchDevices, searchScanners, type QuickCheckItem, type QuickCheckResult } from '@/lib/quickcheck';
import { supabase } from '@/lib/supabase';

const regions = ['Full body', 'Head', 'Spine', 'Chest', 'Abdomen', 'Pelvis', 'Extremity'];
const strengths = [1.5, 3];

function label(item: QuickCheckItem) {
  const name = item.model_name || item.name || 'Unknown model';
  const number = item.model_number || item.model || item.catalog_number;
  return number ? `${name} • ${number}` : String(name);
}

export default function QuickCheck() {
  const [step, setStep] = useState(1);
  const [deviceSearch, setDeviceSearch] = useState('');
  const [componentSearch, setComponentSearch] = useState('');
  const [devices, setDevices] = useState<QuickCheckItem[]>([]);
  const [components, setComponents] = useState<QuickCheckItem[]>([]);
  const [scannerOptions, setScannerOptions] = useState<QuickCheckItem[]>([]);
  const [scanners, setScanners] = useState<QuickCheckItem[]>([]);
  const [device, setDevice] = useState<QuickCheckItem | null>(null);
  const [component, setComponent] = useState<QuickCheckItem | null>(null);
  const [scanner, setScanner] = useState<QuickCheckItem | null>(null);
  const [strength, setStrength] = useState<number | null>(null);
  const [region, setRegion] = useState('Full body');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QuickCheckResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { getScannerOptions().then(setScannerOptions).catch(() => setScannerOptions([])); }, []);
  useEffect(() => {
    const timer = setTimeout(() => { searchDevices(deviceSearch).then(setDevices).catch(() => setDevices([])); }, 250);
    return () => clearTimeout(timer);
  }, [deviceSearch]);
  useEffect(() => {
    if (!device) return setComponents([]);
    const timer = setTimeout(() => { searchComponents(device.id, componentSearch).then(setComponents).catch(() => setComponents([])); }, 250);
    return () => clearTimeout(timer);
  }, [device, componentSearch]);

  const manufacturers = useMemo(() => {
    const seen = new Set<string>();
    return scannerOptions.filter((x) => { const id = String(x.manufacturer_id ?? x.id); if (seen.has(id)) return false; seen.add(id); return true; });
  }, [scannerOptions]);

  async function chooseManufacturer(item: QuickCheckItem) {
    const id = String(item.manufacturer_id ?? item.id);
    try { setScanners(await searchScanners(id)); } catch { setScanners([]); }
  }

  async function check() {
    if (!device || !strength) return;
    setLoading(true); setError('');
    try {
      const response = await runQuickCheck({ device_id: device.id, component_id: component?.id, scanner_model_id: scanner?.id, scanner_strength_t: strength, scan_region: region });
      setResult(response); setStep(5);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to complete the safety check.'); }
    finally { setLoading(false); }
  }

  function reset() { setStep(1); setDevice(null); setComponent(null); setScanner(null); setStrength(null); setResult(null); setError(''); setDeviceSearch(''); setComponentSearch(''); }

  if (result) return <ResultScreen result={result} onAgain={reset} />;

  return <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
    <View style={styles.header}><View><Text style={styles.eyebrow}>MRI SAFETY</Text><Text style={styles.title}>QuickCheck</Text></View><Pressable onPress={() => router.push('/(app)/settings')} style={styles.settings}><Text style={styles.settingsText}>⚙</Text></Pressable></View>
    <View style={styles.progress}><View style={[styles.progressFill, { width: `${step * 20}%` }]} /></View>
    <Text style={styles.step}>STEP {step} OF 5</Text>

    {step === 1 && <Card><SectionTitle title="Identify the implant" subtitle="Search by manufacturer, model, or catalog number. Select the exact device."/><SearchInput value={deviceSearch} onChangeText={setDeviceSearch} placeholder="Search implant or model…" autoFocus/>{devices.slice(0, 8).map((item) => <Choice key={item.id} label={label(item)} selected={device?.id === item.id} onPress={() => { setDevice(item); setComponent(null); setStep(2); }}/>)}</Card>}
    {step === 2 && <Card><SectionTitle title="Confirm lead / component" subtitle="If the system uses a lead or component, identify the exact component. Do not infer compatibility."/><Text style={styles.selectedLabel}>{label(device!)}</Text><SearchInput value={componentSearch} onChangeText={setComponentSearch} placeholder="Search lead or component…"/>{components.slice(0, 8).map((item) => <Choice key={item.id} label={label(item)} selected={component?.id === item.id} onPress={() => setComponent(item)}/>)}<Choice label="No separate component / not applicable" selected={!component} onPress={() => setComponent(null)}/><PrimaryButton label="CONTINUE" disabled={components.length > 0 && !component} onPress={() => setStep(3)}/></Card>}
    {step === 3 && <Card><SectionTitle title="Select scanner" subtitle="Choose the actual scanner manufacturer and model when available."/><Text style={styles.subheading}>MANUFACTURER</Text>{manufacturers.slice(0, 10).map((item) => <Choice key={String(item.manufacturer_id ?? item.id)} label={String(item.manufacturer_name ?? item.name ?? 'Manufacturer')} selected={String(scanner?.manufacturer_id) === String(item.manufacturer_id ?? item.id)} onPress={() => { setScanner(null); chooseManufacturer(item); }}/>) }<Text style={styles.subheading}>SCANNER MODEL</Text>{scanners.slice(0, 10).map((item) => <Choice key={item.id} label={label(item)} selected={scanner?.id === item.id} onPress={() => setScanner(item)}/>) }<PrimaryButton label="CONTINUE" disabled={!scanner} onPress={() => setStep(4)}/></Card>}
    {step === 4 && <Card><SectionTitle title="Scan parameters" subtitle="Compatibility depends on the scanner field strength and scan region."/><Text style={styles.subheading}>FIELD STRENGTH</Text><View style={styles.row}>{strengths.map((value) => <Pressable key={value} onPress={() => setStrength(value)} style={[styles.strength, strength === value && styles.strengthSelected]}><Text style={[styles.strengthValue, strength === value && styles.strengthTextSelected]}>{value}T</Text></Pressable>)}</View><Text style={styles.subheading}>SCAN REGION</Text>{regions.map((item) => <Choice key={item} label={item} selected={region === item} onPress={() => setRegion(item)}/>) }{error ? <Text style={styles.error}>{error}</Text> : null}<PrimaryButton label="CHECK MRI SAFETY" loading={loading} disabled={!strength} onPress={check}/></Card>}

    <View style={styles.footer}><Text style={styles.footerText}>Manufacturer labeling is the primary authority. A result of CONDITIONAL requires the listed conditions to be satisfied. UNKNOWN never means safe.</Text></View>
  </ScrollView>;
}

function ResultScreen({ result, onAgain }: { result: QuickCheckResult; onAgain: () => void }) {
  const status = result.status;
  const title = result.display_status || (status === 'unsafe' ? 'NOT SAFE' : status.toUpperCase());
  const tone = status === 'safe' ? '#166534' : status === 'conditional' ? '#92400e' : '#991b1b';
  return <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
    <View style={styles.header}><View><Text style={styles.eyebrow}>MRI SAFETY RESULT</Text><Text style={styles.title}>QuickCheck</Text></View><Pressable onPress={onAgain} style={styles.newButton}><Text style={styles.newButtonText}>NEW</Text></Pressable></View>
    <View style={[styles.resultHero, { borderColor: tone }]}><Text style={[styles.resultStatus, { color: tone }]}>{title}</Text><Text style={styles.resultDecision}>{result.decision || (result.safe_to_scan ? 'The selected configuration meets the evaluated criteria.' : 'Do not proceed without resolving the listed requirements.')}</Text></View>
    <Card><SectionTitle title="Checked configuration"/><Info label="Implant" value={displayObject(result.device)}/>{result.component ? <Info label="Lead / component" value={displayObject(result.component)}/> : null}<Info label="Scanner" value={displayObject(result.scanner)}/>{result.scanner?.field_strength_t ? <Info label="Field strength" value={`${result.scanner.field_strength_t}T`}/> : null}<Info label="Scan region" value={String(result.scanner?.scan_region ?? result.condition?.scan_region ?? 'Selected region')}/></Card>
    <Card><SectionTitle title="What to do next"/><Text style={styles.nextAction}>{result.next_action || (result.requires_review ? 'Review the manufacturer labeling and all listed conditions before scanning.' : 'Follow the applicable manufacturer MRI conditions.')}</Text></Card>
    <Card><SectionTitle title="Safety gate"/><Text style={styles.footerText}>Safe-to-scan: {result.safe_to_scan ? 'YES' : 'NO'}{result.requires_review ? ' • REVIEW REQUIRED' : ''}</Text></Card>
    <PrimaryButton label="START NEW CHECK" onPress={onAgain}/>
  </ScrollView>;
}
function displayObject(value?: Record<string, unknown> | null) { if (!value) return 'Not identified'; const name = value.model_name ?? value.name ?? value.model ?? 'Selected'; const number = value.model_number ?? value.model; return number && number !== name ? `${name} • ${number}` : String(name); }
function Info({ label, value }: { label: string; value: string }) { return <View style={styles.info}><Text style={styles.infoLabel}>{label}</Text><Text selectable style={styles.infoValue}>{value}</Text></View>; }

const styles=StyleSheet.create({content:{flexGrow:1,padding:20,paddingBottom:40,gap:14,backgroundColor:'#f7f9fc'},header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingTop:8},eyebrow:{fontSize:11,fontWeight:'900',letterSpacing:2,color:'#667085'},title:{fontSize:32,fontWeight:'900',color:'#101828',marginTop:3},settings:{width:42,height:42,borderRadius:12,backgroundColor:'#fff',borderWidth:1,borderColor:'#e4e7ec',alignItems:'center',justifyContent:'center'},settingsText:{fontSize:19},newButton:{paddingHorizontal:15,paddingVertical:10,borderRadius:10,backgroundColor:'#111827'},newButtonText:{color:'#fff',fontSize:12,fontWeight:'900'},progress:{height:5,backgroundColor:'#e4e7ec',borderRadius:5,overflow:'hidden',marginTop:4},progressFill:{height:5,backgroundColor:'#175cd3'},step:{fontSize:11,fontWeight:'900',letterSpacing:1.2,color:'#667085'},selectedLabel:{fontWeight:'800',fontSize:14,color:'#175cd3',paddingVertical:3},subheading:{fontSize:11,fontWeight:'900',letterSpacing:1,color:'#667085',marginTop:5},row:{flexDirection:'row',gap:10},strength:{flex:1,height:64,borderRadius:14,borderWidth:1,borderColor:'#d9dee7',alignItems:'center',justifyContent:'center',backgroundColor:'#fff'},strengthSelected:{borderColor:'#175cd3',backgroundColor:'#eff6ff'},strengthValue:{fontSize:20,fontWeight:'900',color:'#344054'},strengthTextSelected:{color:'#175cd3'},error:{color:'#b42318',fontSize:13,lineHeight:19},footer:{padding:4},footerText:{fontSize:12,lineHeight:18,color:'#667085'},resultHero:{backgroundColor:'#fff',borderWidth:2,borderRadius:20,padding:22,gap:10},resultStatus:{fontSize:30,fontWeight:'900',letterSpacing:.5},resultDecision:{fontSize:16,lineHeight:24,color:'#344054'},nextAction:{fontSize:15,lineHeight:23,color:'#344054'},info:{paddingVertical:4,gap:2},infoLabel:{fontSize:11,fontWeight:'800',color:'#667085',textTransform:'uppercase',letterSpacing:.5},infoValue:{fontSize:15,fontWeight:'700',color:'#101828'}});
