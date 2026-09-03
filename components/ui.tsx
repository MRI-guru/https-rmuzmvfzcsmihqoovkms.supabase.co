import { PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function SearchInput(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput {...props} placeholderTextColor="#8b95a7" style={styles.input} />;
}

export function Choice({ label, selected, onPress, disabled = false }: { label: string; selected?: boolean; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[styles.choice, selected && styles.choiceSelected, disabled && styles.disabled]}>
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
      <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioDot} /> : null}</View>
    </Pressable>
  );
}

export function PrimaryButton({ label, onPress, loading, disabled }: { label: string; onPress: () => void; loading?: boolean; disabled?: boolean }) {
  return (
    <Pressable disabled={disabled || loading} onPress={onPress} style={[styles.primary, (disabled || loading) && styles.primaryDisabled]}>
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 18, gap: 12, borderWidth: 1, borderColor: '#e7ebf1' },
  section: { gap: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#101828' },
  sectionSubtitle: { fontSize: 13, lineHeight: 19, color: '#667085' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9dee7', borderRadius: 13, paddingHorizontal: 15, paddingVertical: 13, fontSize: 16, color: '#101828' },
  choice: { minHeight: 56, borderWidth: 1, borderColor: '#d9dee7', borderRadius: 13, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff' },
  choiceSelected: { borderColor: '#1d4ed8', backgroundColor: '#eff6ff' },
  choiceText: { fontSize: 15, fontWeight: '700', color: '#344054', flex: 1 },
  choiceTextSelected: { color: '#174ea6' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#aab2c0', alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: '#1d4ed8' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1d4ed8' },
  disabled: { opacity: 0.45 },
  primary: { minHeight: 58, borderRadius: 15, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  primaryDisabled: { opacity: 0.45 },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
});
