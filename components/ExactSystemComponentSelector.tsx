import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Choice, SearchInput } from '@/components/ui';
import type { ExactComponentSelection, QuickCheckItem } from '@/lib/quickcheck';

type Props = {
  device: QuickCheckItem;
  components: QuickCheckItem[];
  search: string;
  onSearchChange: (value: string) => void;
  selections: ExactComponentSelection[];
  onSelect: (slot: ExactComponentSelection['slot'], component: QuickCheckItem) => void;
  systemType?: string | null;
  requiredLeadCount?: number | null;
};

function componentLabel(item: QuickCheckItem) {
  const name = item.model_name || item.name || 'Unknown component';
  const number = item.model_number || item.model || item.catalog_number;
  return number ? `${name} • ${number}` : String(name);
}

function slotTitle(slot: string) {
  if (slot === 'generator') return 'Generator / Device';
  if (slot === 'lead_1') return 'Atrial Lead';
  if (slot === 'lead_2') return 'Ventricular Lead';
  return `Lead ${slot.replace('lead_', '')}`;
}

export default function ExactSystemComponentSelector({ device, components, search, onSearchChange, selections, onSelect, systemType, requiredLeadCount }: Props) {
  const isDual = systemType === 'dual_chamber' || Number(requiredLeadCount) === 2;
  const isSingle = !isDual && Number(requiredLeadCount ?? 1) === 1;
  const slots = useMemo(() => isDual ? ['generator', 'lead_1', 'lead_2'] : isSingle ? ['generator', 'lead_1'] : ['generator'], [isDual, isSingle]);

  const selectedFor = (slot: string) => selections.find((selection) => selection.slot === slot)?.component_id ?? null;
  const selectedCount = selections.filter((selection) => selection.slot !== 'generator').length;

  return <View style={styles.container}>
    <Text style={styles.device}>{componentLabel(device)}</Text>
    <View style={styles.requirementBox}>
      <Text style={styles.requirementTitle}>{isDual ? 'DUAL-CHAMBER SYSTEM' : 'EXACT SYSTEM COMPONENTS'}</Text>
      <Text style={styles.requirementText}>
        {isDual ? 'Select the generator, atrial lead, and ventricular lead. The same lead model may be selected in both lead slots when that is what is implanted.' : 'Select the generator and the exact implanted lead. Do not infer compatibility from a component model alone.'}
      </Text>
    </View>

    <SearchInput value={search} onChangeText={onSearchChange} placeholder="Search lead or component…" />

    {slots.map((slot) => {
      const selectedId = selectedFor(slot);
      return <View key={slot} style={styles.slot}>
        <View style={styles.slotHeader}>
          <Text style={styles.slotTitle}>{slotTitle(slot)}</Text>
          <Text style={styles.slotState}>{selectedId ? 'SELECTED' : 'REQUIRED'}</Text>
        </View>
        {slot === 'generator' ? <Choice label={componentLabel(device)} selected={selectedId === device.id} onPress={() => onSelect(slot, device)} /> : components.slice(0, 12).map((item) => {
          const selectedInAnotherSlot = selections.some((selection) => selection.slot !== slot && selection.component_id === item.id);
          return <Choice key={`${slot}-${item.id}`} label={`${componentLabel(item)}${selectedInAnotherSlot ? '  •  also selected' : ''}`} selected={selectedId === item.id} onPress={() => onSelect(slot, item)} />;
        })}
      </View>;
    })}

    <View style={styles.summary}>
      <Text style={styles.summaryTitle}>{isDual ? `${selectedCount} of 2 leads selected` : `${selectedCount} of 1 lead selected`}</Text>
      <Text style={styles.summaryText}>Every implanted component must be positively identified before an exact system can be verified.</Text>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  device: { fontWeight: '800', fontSize: 14, color: '#175cd3', paddingVertical: 3 },
  requirementBox: { borderWidth: 1, borderColor: '#bfdbfe', backgroundColor: '#eff6ff', borderRadius: 14, padding: 14, gap: 5 },
  requirementTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1, color: '#1d4ed8' },
  requirementText: { fontSize: 13, lineHeight: 19, color: '#344054' },
  slot: { gap: 7 },
  slotHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 },
  slotTitle: { fontSize: 13, fontWeight: '900', color: '#101828' },
  slotState: { fontSize: 10, fontWeight: '900', letterSpacing: 1, color: '#667085' },
  summary: { borderTopWidth: 1, borderTopColor: '#eaecf0', paddingTop: 12, gap: 4 },
  summaryTitle: { fontSize: 14, fontWeight: '900', color: '#101828' },
  summaryText: { fontSize: 12, lineHeight: 18, color: '#667085' },
});
