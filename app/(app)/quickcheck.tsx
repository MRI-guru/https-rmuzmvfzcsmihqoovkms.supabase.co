import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Card, Choice, PrimaryButton, SearchInput, SectionTitle } from '@/components/ui';
import { getScannerOptions, runQuickCheck, searchComponents, searchDevices, searchScanners, type QuickCheckItem, type QuickCheckResult } from '@/lib/quickcheck';

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

  function reset() { setStep(1); setDevice(null); setComponent(null); setScanner(null); setStrength(null); setResult(null); setError(''); setDeviceSearch(''); setComponentSearch(''); setScanners([]); }

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
  const meta = statusMeta(status);
  const conditions = extractConditions(result.condition);
  const source = getSource(result);
  const scannerStrength = Number(result.scanner?.field_strength_t ?? result.scanner?.field_strength ?? NaN);
  const allowed = Array.isArray(result.condition?.allowed_field_strengths_t) ? result.condition.allowed_field_strengths_t.map(Number) : [];
  const strengthMismatch = Number.isFinite(scannerStrength) && allowed.length > 0 && !allowed.includes(scannerStrength);

  return <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
    <View style={styles.header}><View><Text style={styles.eyebrow}>MRI SAFETY RESULT</Text><Text style={styles.title}>QuickCheck</Text></View><Pressable onPress={onAgain} style={styles.newButton}><Text style={styles.newButtonText}>NEW</Text></Pressable></View>

    <View style={[styles.resultHero, { borderColor: meta.border }]}>
      <View style={[styles.statusPill, { backgroundColor: meta.background }]}><Text style={[styles.statusPillText, { color: meta.text }]}>{meta.label}</Text></View>
      <Text style={styles.resultHeadline}>{meta.headline}</Text>
      <Text style={styles.resultDecision}>{result.decision || meta.defaultDecision}</Text>
      {strengthMismatch ? <View style={styles.mismatch}><Text style={styles.mismatchTitle}>SCANNER FIELD-STRENGTH MISMATCH</Text><Text style={styles.mismatchText}>The selected {scannerStrength}T scanner is outside the labeled field strength range: {allowed.join('T, ')}T.</Text></View> : null}
    </View>

    <Card><SectionTitle title="Checked configuration"/><Info label="Implant" value={displayObject(result.device)}/>{result.component ? <Info label="Lead / component" value={displayObject(result.component)}/> : null}<Info label="Scanner" value={displayObject(result.scanner)}/><Info label="Field strength" value={Number.isFinite(scannerStrength) ? `${scannerStrength}T` : 'Not verified'}/><Info label="Scan region" value={String(result.condition?.scan_region ?? 'Selected region')}/></Card>

    <Card><SectionTitle title="Why this result"/><Text style={styles.bodyText}>{result.next_action || meta.nextAction}</Text></Card>

    <Card><SectionTitle title="Conditions that must be met" subtitle={conditions.length ? 'Every applicable manufacturer condition must be satisfied before scanning.' : 'No verified condition set was returned.'}/>{conditions.length ? conditions.map((item, index) => <ConditionRow key={`${index}-${item}`} index={index + 1} text={item}/>) : <View style={styles.warningBox}><Text style={styles.warningTitle}>REVIEW REQUIRED</Text><Text style={styles.bodyText}>Do not treat this result as clearance without verified manufacturer conditions.</Text></View>}</Card>

    {source ? <Card><SectionTitle title="Manufacturer source" subtitle="Source verification supports the database record; it does not replace the manufacturer's current labeling."/><Info label="Source" value={source.title}/><Info label="Verification" value={String(source.verified ?? 'Manufacturer labeling')}/>{source.url ? <Pressable onPress={() => Linking.openURL(source.url).catch(() => Alert.alert('Unable to open source'))} style={styles.sourceButton}><Text style={styles.sourceButtonText}>OPEN MANUFACTURER SOURCE</Text></Pressable> : null}</Card> : null}

    <View style={styles.gate}><Text style={styles.gateLabel}>SAFETY GATE</Text><Text style={[styles.gateValue, { color: meta.text }]}>{result.safe_to_scan ? 'SAFE TO SCAN' : 'NOT CLEARED TO SCAN'}</Text><Text style={styles.gateNote}>{result.requires_review ? 'REVIEW REQUIRED before proceeding.' : 'Use the current manufacturer labeling and facility protocol.'}</Text></View>
    <PrimaryButton label="START NEW CHECK" onPress={onAgain}/>
  </ScrollView>;
}

function statusMeta(status: QuickCheckResult['status']) {
  if (status === 'safe') return { label: 'SAFE', headline: 'Meets the evaluated criteria', text: '#166534', border: '#86efac', background: '#dcfce7', defaultDecision: 'The selected configuration meets the evaluated criteria.', nextAction: 'Proceed only within the verified manufacturer labeling and your facility MRI safety workflow.' };
  if (status === 'conditional') return { label: 'CONDITIONAL', headline: 'NOT CLEARED — conditions apply', text: '#92400e', border: '#f59e0b', background: '#fef3c7', defaultDecision: 'MRI may be possible only when every applicable manufacturer condition is satisfied.', nextAction: 'Review and satisfy every listed manufacturer condition before scanning. This result is not a clearance by itself.' };
  if (status === 'unsafe') return { label: 'NOT SAFE', headline: 'Do not proceed with this configuration', text: '#991b1b', border: '#fca5a5', background: '#fee2e2', defaultDecision: 'The selected configuration is not supported by the evaluated safety labeling.', nextAction: 'Do not scan. Resolve the incompatibility using current manufacturer labeling and MRI safety procedures.' };
  return { label: 'UNKNOWN', headline: 'DO NOT SCAN — review required', text: '#7f1d1d', border: '#fca5a5', background: '#fee2e2', defaultDecision: 'MRI safety could not be verified for the selected configuration.', nextAction: 'Do not scan. Positively identify the exact device, components, scanner, and applicable manufacturer labeling.' };
}

function extractConditions(condition?: Record<string, unknown> | null) {
  if (!condition) return [];
  const ignored = new Set(['id', 'device_id', 'component_id', 'scanner_model_id', 'active', 'created_at', 'updated_at', 'source_id', 'source_document_id', 'compatibility_status', 'allowed_field_strengths_t']);
  const labels: Record<string, string> = {
    field_strength: 'Field strength', scan_region: 'Scan region', allowed_scan_regions: 'Allowed scan regions', magnet_type: 'Magnet type', bore_type: 'Bore type', scan_mode: 'Scan mode', coil_requirements: 'Coil requirements', sar_limit: 'SAR limit', b1_rms_limit: 'B1+rms limit', gradient_limit: 'Gradient limit', spatial_gradient_limit: 'Spatial gradient limit', other_conditions: 'Manufacturer conditions', patient_position: 'Patient position', device_position: 'Device position', system_requirements: 'System requirements'
  };
  const output: string[] = [];
  for (const [key, raw] of Object.entries(condition)) {
    if (ignored.has(key) || raw === null || raw === undefined || raw === '') continue;
    if (Array.isArray(raw)) {
      if (!raw.length) continue;
      output.push(`${labels[key] ?? prettify(key)}: ${raw.map(String).join(', ')}`);
    } else if (typeof raw === 'object') {
      const text = Object.entries(raw as Record<string, unknown>).map(([k, v]) => `${prettify(k)}: ${Array.isArray(v) ? v.join(', ') : String(v)}`).join('; ');
      if (text) output.push(`${labels[key] ?? prettify(key)}: ${text}`);
    } else if (typeof raw === 'boolean') {
      output.push(`${labels[key] ?? prettify(key)}: ${raw ? 'Yes' : 'No'}`);
    } else {
      output.push(`${labels[key] ?? prettify(key)}: ${String(raw)}`);
    }
  }
  return output;
}

function getSource(result: QuickCheckResult) {
  const candidates = [result.condition, result.device, result as Record<string, unknown>];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const url = candidate.source_url ?? candidate.url ?? candidate.source_uri;
    const title = candidate.source_title ?? candidate.document_title ?? candidate.source_name ?? candidate.source;
    const verified = candidate.verified_by ?? candidate.verification_status;
    if (url || title || verified) return { url: typeof url === 'string' ? url : undefined, title: String(title ?? 'Manufacturer labeling'), verified: verified ? String(verified) : undefined };
  }
  return null;
}

function prettify(value: string) { return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()); }
function displayObject(value?: Record<string, unknown> | null) { if (!value) return 'Not identified'; const name = value.model_name ?? value.name ?? value.model ?? 'Selected'; const number = value.model_number ?? value.model; return number && number !== name ? `${name} • ${number}` : String(name); }
function Info({ label, value }: { label: string; value: string }) { return <View style={styles.info}><Text style={styles.infoLabel}>{label}</Text><Text selectable style={styles.infoValue}>{value}</Text></View>; }
function ConditionRow({ index, text }: { index: number; text: string }) { return <View style={styles.conditionRow}><View style={styles.conditionNumber}><Text style={styles.conditionNumberText}>{index}</Text></View><Text style={styles.conditionText}>{text}</Text></View>; }

const styles=StyleSheet.create({content:{flexGrow:1,padding:20,paddingBottom:40,gap:14,backgroundColor:'#f7f9fc'},header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingTop:8},eyebrow:{fontSize:11,fontWeight:'900',letterSpacing:2,color:'#667085'},title:{fontSize:32,fontWeight:'900',color:'#101828',marginTop:3},settings:{width:42,height:42,borderRadius:12,backgroundColor:'#fff',borderWidth:1,borderColor:'#e4e7ec',alignItems:'center',justifyContent:'center'},settingsText:{fontSize:19},newButton:{paddingHorizontal:15,paddingVertical:10,borderRadius:10,backgroundColor:'#111827'},newButtonText:{color:'#fff',fontSize:12,fontWeight:'900'},progress:{height:5,backgroundColor:'#e4e7ec',borderRadius:5,overflow:'hidden',marginTop:4},progressFill:{height:5,backgroundColor:'#175cd3'},step:{fontSize:11,fontWeight:'900',letterSpacing:1.2,color:'#667085'},selectedLabel:{fontWeight:'800',fontSize:14,color:'#175cd3',paddingVertical:3},subheading:{fontSize:11,fontWeight:'900',letterSpacing:1,color:'#667085',marginTop:5},row:{flexDirection:'row',gap:10},strength:{flex:1,height:64,borderRadius:14,borderWidth:1,borderColor:'#d9dee7',alignItems:'center',justifyContent:'center',backgroundColor:'#fff'},strengthSelected:{borderColor:'#175cd3',backgroundColor:'#eff6ff'},strengthValue:{fontSize:20,fontWeight:'900',color:'#344054'},strengthTextSelected:{color:'#175cd3'},error:{color:'#b42318',fontSize:13,lineHeight:19},footer:{padding:4},footerText:{fontSize:12,lineHeight:18,color:'#667085'},resultHero:{backgroundColor:'#fff',borderWidth:2,borderRadius:20,padding:20,gap:10},statusPill:{alignSelf:'flex-start',paddingHorizontal:12,paddingVertical:7,borderRadius:999},statusPillText:{fontSize:12,fontWeight:'900',letterSpacing:1},resultHeadline:{fontSize:24,fontWeight:'900',color:'#101828',lineHeight:30},resultDecision:{fontSize:15,lineHeight:23,color:'#344054'},mismatch:{marginTop:3,padding:13,borderRadius:12,backgroundColor:'#fff1f2',borderWidth:1,borderColor:'#fecdd3',gap:4},mismatchTitle:{fontSize:11,fontWeight:'900',letterSpacing:.8,color:'#9f1239'},mismatchText:{fontSize:13,lineHeight:19,color:'#881337'},bodyText:{fontSize:14,lineHeight:22,color:'#344054'},info:{paddingVertical:4,gap:2},infoLabel:{fontSize:11,fontWeight:'800',color:'#667085',textTransform:'uppercase',letterSpacing:.5},infoValue:{fontSize:15,fontWeight:'700',color:'#101828'},conditionRow:{flexDirection:'row',gap:11,alignItems:'flex-start',paddingVertical:4},conditionNumber:{width:26,height:26,borderRadius:13,backgroundColor:'#eef2f6',alignItems:'center',justifyContent:'center'},conditionNumberText:{fontSize:12,fontWeight:'900',color:'#475467'},conditionText:{flex:1,fontSize:14,lineHeight:21,color:'#344054',paddingTop:2},warningBox:{padding:13,borderRadius:12,backgroundColor:'#fff7ed',borderWidth:1,borderColor:'#fed7aa',gap:4},warningTitle:{fontSize:11,fontWeight:'900',letterSpacing:.8,color:'#9a3412'},sourceButton:{minHeight:48,borderRadius:12,borderWidth:1,borderColor:'#175cd3',alignItems:'center',justifyContent:'center',paddingHorizontal:14},sourceButtonText:{fontSize:12,fontWeight:'900',color:'#175cd3',letterSpacing:.4},gate:{padding:18,borderRadius:18,backgroundColor:'#fff',borderWidth:1,borderColor:'#e7ebf1',gap:5},gateLabel:{fontSize:10,fontWeight:'900',letterSpacing:1.3,color:'#667085'},gateValue:{fontSize:20,fontWeight:'900'},gateNote:{fontSize:12,lineHeight:18,color:'#667085'}});
