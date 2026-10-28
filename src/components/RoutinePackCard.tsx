import React, { useState } from 'react';
import { View, Text, Pressable, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { useStore } from '../store';
import { Suggestion, decideSuggestion, linkSuggestionTask } from '../lib/clinic';
import { suggestionTask } from './SuggestionCard';
import { WEEKDAYS } from '../data/routines';
import { track } from '../lib/track';

// Günlük rutin paketi (kullanıcı kararı B, 28 Ekim 2026; ortak akislar.md 5.4 v2 adım 5–6): uzmanın aynı rutinle önerdiği
// görevler tek kart. "Hepsini ekle" ya da "Düzenle" (görev çıkar, tekrarı değiştir) → seçilenler ayrı görev olur ve rutinine
// bağlanır; çıkarılanlar reddedilir. Onay ve coin görev görev kalır. "Şimdilik değil" paketin hepsini kapatır.
type Repeat = 'as' | 'weekdays' | 'daily';
const REPEATS: { id: Repeat; label: string }[] = [{ id: 'as', label: 'Önerildiği gibi' }, { id: 'weekdays', label: 'Hafta içi' }, { id: 'daily', label: 'Her gün' }];
const DAY = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

function repeatText(s: Suggestion) {
  if (!s.recurring) return 'Bir kez';
  if (s.repeatKind === 'daily') return 'Her gün';
  const d = [...s.repeatDays].sort((a, b) => a - b);
  if (s.repeatKind === 'weekly' && d.join() === WEEKDAYS.join()) return 'Hafta içi';
  if (s.repeatKind === 'weekly' && d.length === 7) return 'Her gün';
  return s.repeatKind === 'weekly' ? d.map((x) => DAY[x - 1]).filter(Boolean).join(', ') : 'Ayın belirli günleri';
}

export default function RoutinePackCard({ items, childName, goal, onDecided }: {
  items: Suggestion[]; childName: string; goal?: string; onDecided: (ids: string[]) => void;
}) {
  const { addTasks } = useStore();
  const list = [...items].sort((a, b) => (a.routine?.position ?? 0) - (b.routine?.position ?? 0));
  const r = list[0].routine!;
  const [edit, setEdit] = useState(false);
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(list.map((s) => [s.id, true])));
  const [repeat, setRepeat] = useState<Repeat>('as');
  const [busy, setBusy] = useState(false);
  const times = list.map((s) => s.reminder).filter(Boolean).sort() as string[];
  const span = times.length ? (times[0] === times[times.length - 1] ? times[0] : `${times[0]}–${times[times.length - 1]}`) : '';
  const kept = edit ? list.filter((s) => on[s.id]) : list;
  const override = repeat === 'as' ? undefined
    : repeat === 'daily' ? { recurring: true, repeatKind: 'daily' as const, repeatDays: [] }
    : { recurring: true, repeatKind: 'weekly' as const, repeatDays: WEEKDAYS };

  const add = async () => {
    if (!kept.length) return Alert.alert('En az bir görev seç');
    setBusy(true);
    try {
      const dropped = list.filter((s) => !kept.includes(s));
      await Promise.all([...kept.map((s) => decideSuggestion(s.id, true)), ...dropped.map((s) => decideSuggestion(s.id, false))]);
      addTasks(kept.map((s) => suggestionTask(s, override)), (ids) => {
        ids.forEach((taskId, i) => { if (taskId && kept[i]) linkSuggestionTask(kept[i].id, taskId).catch(() => {}); });
      });
      track('routine.pack_accept', { n: kept.length, dropped: dropped.length, repeat });
      onDecided(list.map((s) => s.id));
      Alert.alert('Rutin eklendi', `${r.title}: ${kept.length} görev ${childName} için görevlerde. Her görev ayrı onaylanır.`);
    } catch (e) {
      Alert.alert('Kaydedilemedi', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const declineAll = () => Alert.alert(`${r.title} eklenmesin mi?`, 'Paketteki görevlerin hepsi kapanır; uzmanın görür.', [
    { text: 'Vazgeç', style: 'cancel' },
    { text: 'Şimdilik değil', onPress: async () => {
      setBusy(true);
      try {
        await Promise.all(list.map((s) => decideSuggestion(s.id, false)));
        track('routine.pack_decline', { n: list.length });
        onDecided(list.map((s) => s.id));
      } catch (e) { Alert.alert('Kaydedilemedi', (e as Error).message); } finally { setBusy(false); }
    } },
  ]);

  return (
    <View style={styles.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={styles.icon}><Ionicons name={(r.icon as keyof typeof Ionicons.glyphMap) || 'repeat-outline'} size={20} color={colors.navy} /></View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.h}>{r.title}</Text>
          <Text style={styles.cap}>{[childName, `${list.length} görev`, span, repeatText(list[0])].filter(Boolean).join(' · ')}</Text>
        </View>
      </View>
      {!!goal && (
        <View style={styles.goal}>
          <Ionicons name="flag-outline" size={13} color="#2F6B5E" />
          <Text style={styles.goalText} numberOfLines={2}>Hedef: {goal}</Text>
        </View>
      )}

      <View style={{ gap: 2 }}>
        {list.map((s) => (
          <Pressable key={s.id} disabled={!edit} onPress={() => setOn((p) => ({ ...p, [s.id]: !p[s.id] }))} style={styles.row}
            accessibilityRole={edit ? 'checkbox' : undefined} accessibilityState={edit ? { checked: !!on[s.id] } : undefined}>
            {edit && <Ionicons name={on[s.id] ? 'checkbox' : 'square-outline'} size={20} color={colors.navy} />}
            <Text style={{ fontSize: 18 }}>{s.emoji}</Text>
            <Text style={[styles.item, edit && !on[s.id] && { color: colors.faint, textDecorationLine: 'line-through' }]} numberOfLines={1}>{s.title}</Text>
            {!!s.reminder && <Text style={styles.cap}>{s.reminder}</Text>}
          </Pressable>
        ))}
      </View>

      {edit && (
        <View style={{ gap: 6 }}>
          <Text style={styles.cap}>Tekrar</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {REPEATS.map((x) => (
              <Pressable key={x.id} onPress={() => setRepeat(x.id)} style={[styles.chip, repeat === x.id && styles.chipOn]} accessibilityState={{ selected: repeat === x.id }}>
                <Text style={[styles.chipText, repeat === x.id && { color: '#fff' }]}>{x.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {busy ? <ActivityIndicator color={colors.navy} style={{ marginVertical: 8 }} /> : edit ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable style={[styles.ghost, { flex: 1 }]} onPress={() => setEdit(false)} accessibilityRole="button">
            <Text style={styles.ghostText}>Vazgeç</Text>
          </Pressable>
          <Pressable style={[styles.cta, { flex: 1.4 }, !kept.length && { opacity: 0.45 }]} onPress={add} accessibilityRole="button">
            <Text style={styles.ctaText}>{kept.length} görevi ekle</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <Pressable style={styles.cta} onPress={add} accessibilityRole="button"><Text style={styles.ctaText}>Hepsini ekle</Text></Pressable>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable style={[styles.ghost, { flex: 1 }]} onPress={declineAll} accessibilityRole="button"><Text style={styles.ghostText}>Şimdilik değil</Text></Pressable>
            <Pressable style={[styles.ghost, { flex: 1 }]} onPress={() => setEdit(true)} accessibilityRole="button"><Text style={styles.ghostText}>Düzenle</Text></Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12, backgroundColor: '#fff', borderRadius: radius.md, padding: 14 },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF1D6', alignItems: 'center', justifyContent: 'center' },
  h: { fontSize: 16, fontWeight: '700', color: colors.navy },
  cap: { fontSize: 12, color: colors.muted },
  goal: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: '#DDF1EC', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, maxWidth: '100%' },
  goalText: { fontSize: 12, fontWeight: '600', color: '#2F6B5E', flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  item: { flex: 1, fontSize: 14, color: colors.navy },
  chip: { paddingHorizontal: 12, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.navy },
  cta: { height: 46, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  ghost: { height: 42, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  ghostText: { color: colors.navy, fontWeight: '600' },
});
