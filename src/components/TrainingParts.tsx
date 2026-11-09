import React from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';

// Ebeveyn eğitimi ve davranış olayı ekranlarının ortak parçaları (rakibin aile uygulamasındaki düzen; ClinicApp
// "Ebeveyn deneyimini önizle" ekranlarıyla aynı: training/ParentPreview.tsx, behaviors/IncidentPreview.tsx).

export const TRAINING_NOTE = 'Bu içerikler bilgi amaçlıdır; tanı ya da tedavi yerine geçmez.';

export function Check({ on, size = 22 }: { on: boolean; size?: number }) {
  return (
    <View style={[s.box, { width: size, height: size }, on && s.boxOn]}>
      {on && <Ionicons name="checkmark" size={size - 7} color="#fff" />}
    </View>
  );
}

export function Bar({ pct, tone = colors.easy.fg }: { pct: number; tone?: string }) {
  return <View style={s.bar}><View style={[s.fill, { width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: tone }]} /></View>;
}

export function Footer({ back, onBack, next, onNext, disabled, busy }: {
  back?: string; onBack?: () => void; next: string; onNext: () => void; disabled?: boolean; busy?: boolean;
}) {
  return (
    <View style={s.footer}>
      {!!back && onBack && (
        <Pressable onPress={onBack} style={s.ghost} accessibilityRole="button"><Text style={s.ghostText}>{back}</Text></Pressable>
      )}
      <Pressable onPress={onNext} disabled={disabled || busy} style={[s.primary, { flex: 1 }, (disabled || busy) && { opacity: 0.45 }]}
        accessibilityRole="button" accessibilityState={{ disabled: !!disabled || !!busy }}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>{next}</Text>}
      </Pressable>
    </View>
  );
}

export function Radio({ label, on, onPress, disabled }: { label: string; on: boolean; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[s.opt, on && s.optOn]} accessibilityRole="radio" accessibilityState={{ selected: on }}>
      <Text style={[s.p, { flex: 1 }]}>{label}</Text>
      <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={20} color={on ? colors.navy : colors.faint} />
    </Pressable>
  );
}

export function Field({ label, value, onChange, placeholder, numeric, multiline, max, editable = true }: {
  label: string; value: string; onChange?: (v: string) => void; placeholder?: string; numeric?: boolean; multiline?: boolean; max?: number; editable?: boolean;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput value={value} onChangeText={(v) => onChange?.(numeric ? v.replace(/[^0-9]/g, '').slice(0, 4) : max ? v.slice(0, max) : v)}
        placeholder={placeholder} placeholderTextColor={colors.muted} accessibilityLabel={label} editable={editable}
        keyboardType={numeric ? 'number-pad' : 'default'} multiline={multiline}
        style={[s.input, multiline && { minHeight: 84, textAlignVertical: 'top', paddingTop: 12 }, !editable && { backgroundColor: '#F7F8FA' }]} />
      {!!max && editable && <Text style={[s.tiny, { alignSelf: 'flex-end' }]}>{value.length}/{max}</Text>}
    </View>
  );
}

// 1–5 seçici (tek seferlik görevde "Nasıl geçti?", olayda "Çocuğun tepkisi")
export function Scale({ value, onChange, low, high, labels }: { value: number | null; onChange: (v: number) => void; low: string; high: string; labels: string[] }) {
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', gap: 8 }} accessibilityRole="radiogroup">
        {labels.map((l, i) => {
          const on = value === i + 1;
          return (
            <Pressable key={l} onPress={() => onChange(i + 1)} style={[s.scale, on && s.scaleOn]} accessibilityRole="radio"
              accessibilityState={{ selected: on }} accessibilityLabel={`${i + 1}: ${l}`}>
              <Text style={[s.scaleText, on && { color: '#fff' }]}>{i + 1}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={s.tiny}>{low}</Text><Text style={s.tiny}>{high}</Text></View>
    </View>
  );
}

export const s = StyleSheet.create({
  box: { borderRadius: 6, borderWidth: 2, borderColor: colors.faint, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  boxOn: { backgroundColor: colors.easy.fg, borderColor: colors.easy.fg },
  bar: { height: 8, borderRadius: 4, backgroundColor: '#ECEEF3', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  footer: { flexDirection: 'row', gap: 10, padding: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, backgroundColor: '#fff' },
  primary: { height: 50, borderRadius: radius.pill, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  ghost: { height: 50, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, backgroundColor: '#fff' },
  ghostText: { color: colors.navy, fontSize: 15, fontWeight: '600' },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#fff' },
  optOn: { borderColor: colors.navy, backgroundColor: '#EEF1F8' },
  label: { fontSize: 14, fontWeight: '600', color: colors.navy },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, minHeight: 48, fontSize: 15, color: colors.text, backgroundColor: '#fff' },
  scale: { flex: 1, minWidth: 0, height: 46, borderRadius: 12, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  scaleOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  scaleText: { fontSize: 16, fontWeight: '700', color: colors.navy },
  big: { fontSize: 22, fontWeight: '800', color: colors.navy, flexShrink: 1 },
  h: { fontSize: 17, fontWeight: '700', color: colors.navy, flexShrink: 1 },
  p: { fontSize: 15, lineHeight: 22, color: colors.text, flexShrink: 1 },
  tiny: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  sec: { fontSize: 13, fontWeight: '700', color: colors.muted },
  yellow: { backgroundColor: '#FFF1C9', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, gap: 4 },
  yellowTitle: { fontSize: 16, fontWeight: '800', color: '#5C4300', textTransform: 'uppercase', letterSpacing: 0.3 },
  intro: { alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 26, backgroundColor: '#fff' },
  note: { fontSize: 11, lineHeight: 16, color: colors.muted, textAlign: 'center' },
});
