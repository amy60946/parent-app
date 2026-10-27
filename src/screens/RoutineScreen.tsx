import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { Avatar, IconButton, Segmented, Toggle } from '../components/ui';
import Info from '../components/Info';
import { useStore, RepeatKind } from '../store';
import { DAY_SHORT, todayISO } from '../dates';
import { taskDayPartOf } from '../data/dayParts';
import { routineById, routineTasks, WEEKDAYS } from '../data/routines';
import { track } from '../lib/track';

type Row = { on: boolean; title: string; time: string };

// Hazır rutin (ortak/sozlesme/akislar.md 3 adım 1a): seçili görevler tek seferde, her biri ayrı görev olarak eklenir.
export default function RoutineScreen({ navigation, route }: any) {
  const r = routineById(route.params?.id);
  const { children, addTasks } = useStore();
  const items = useMemo(() => (r ? routineTasks(r) : []), [r]);
  const [rows, setRows] = useState<Row[]>(() => items.map((t) => ({ on: true, title: t.title, time: t.time })));
  const [kids, setKids] = useState<string[]>(() => children.map((c) => c.id));
  const [when, setWhen] = useState<'weekdays' | 'daily'>(r?.repeat === 'daily' ? 'daily' : 'weekdays');
  const [timed, setTimed] = useState(true);
  if (!r) return null;

  const set = (i: number, patch: Partial<Row>) => setRows((p) => p.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const toggleKid = (id: string) => setKids((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const count = rows.filter((x, i) => x.on && x.title.trim() && items[i]).length;

  const add = () => {
    if (!kids.length) return Alert.alert('En az bir çocuk seç');
    if (!count) return Alert.alert('En az bir görev seç');
    const list = items.flatMap((t, i) => {
      const row = rows[i];
      if (!row.on || !row.title.trim()) return [];
      const kind: RepeatKind = r.repeat === 'weekly' || when === 'weekdays' ? 'weekly' : 'daily';
      return [{
        title: row.title.trim(), emoji: t.emoji, skill: t.skill, description: '',
        assignments: kids.map((childId) => ({ childId, difficulty: t.difficulty, coins: t.coins })),
        startDate: todayISO(), recurring: true, repeatKind: kind,
        repeatDays: r.repeat === 'weekly' ? t.days ?? [] : when === 'weekdays' ? WEEKDAYS : [],
        reminder: timed ? row.time : undefined, dayPart: taskDayPartOf(row.time), requiresReview: true,
      }];
    });
    track('routine.add', { id: r.id, n: list.length, kids: kids.length, timed });
    addTasks(list);
    navigation.popToTop();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <IconButton name="chevron-back" label="Geri" onPress={() => navigation.goBack()} />
        <Text style={styles.topTitle}>Hazır rutin</Text>
        <IconButton name="close" label="Kapat" onPress={() => navigation.popToTop()} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 140, gap: 16 }} keyboardShouldPersistTaps="handled">
        <View style={[styles.hero, { backgroundColor: r.tint }]}>
          <Ionicons name={r.icon} size={30} color={colors.navy} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{r.title}</Text>
            <Text style={styles.cap}>{r.subtitle} · {items.length} görev</Text>
          </View>
          <Info title="Hazır rutin" text="Rutin, birkaç görevi tek seferde ekler. İstemediğin görevin işaretini kaldır, adını ya da saatini değiştir. Her görev ayrı kaydedilir; sonra Görevler'den tek tek düzenleyebilir ya da silebilirsin." />
        </View>

        <View style={{ gap: 8 }}>
          <Text style={styles.h}>Kimin için?</Text>
          {children.length === 0 ? (
            <Text style={styles.cap}>Önce Aile sekmesinden bir çocuk ekle.</Text>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {children.map((c) => {
                const on = kids.includes(c.id);
                return (
                  <Pressable key={c.id} onPress={() => toggleKid(c.id)} style={[styles.kid, on && styles.kidOn]} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                    <Avatar id={c.avatar} size={26} />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: on ? '#fff' : colors.navy }}>{c.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {r.repeat !== 'weekly' && (
          <View style={{ gap: 8 }}>
            <Text style={styles.h}>Hangi günler?</Text>
            <Segmented options={[{ id: 'weekdays', label: 'Hafta içi' }, { id: 'daily', label: 'Her gün' }]} value={when} onChange={setWhen} />
          </View>
        )}

        <View style={styles.timedRow}>
          <Text style={[styles.h, { flex: 1 }]}>Saatleri ekle</Text>
          <Info title="Saatler" text="Saat, görevin oyundaki hatırlatma saatidir. O saatten önce 'Yaptım' diyen çocuk küçük bir ek ödül alır. Kapatırsan görevler gün içinde herhangi bir saatte yapılabilir." />
          <Toggle value={timed} onChange={setTimed} />
        </View>

        <View style={{ gap: 8 }}>
          {items.map((t, i) => {
            const row = rows[i];
            return (
              <View key={t.id} style={[styles.item, !row.on && { opacity: 0.5 }]}>
                <Pressable onPress={() => set(i, { on: !row.on })} hitSlop={8} accessibilityRole="checkbox" accessibilityState={{ checked: row.on }}
                  accessibilityLabel={row.title} style={[styles.check, row.on && styles.checkOn]}>
                  {row.on && <Ionicons name="checkmark" size={14} color="#fff" />}
                </Pressable>
                <View style={{ flex: 1 }}>
                  <TextInput value={row.title} onChangeText={(v) => set(i, { title: v.slice(0, 80) })} editable={row.on}
                    style={styles.itemTitle} accessibilityLabel="Görev adı" />
                  {t.days && <Text style={styles.cap}>{t.days.map((d) => DAY_SHORT[d - 1]).join(', ')}</Text>}
                </View>
                {timed && <TimePill value={row.time} onChange={(v) => set(i, { time: v })} />}
              </View>
            );
          })}
        </View>
      </ScrollView>
      <View style={styles.bottom}>
        <Pressable onPress={add} style={[styles.cta, (!count || !kids.length) && { opacity: 0.5 }]} accessibilityRole="button">
          <Text style={styles.ctaText}>Rutini ekle · {count} görev</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const toDate = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); const d = new Date(); d.setHours(h, m, 0, 0); return d; };
const fmt = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// Satır içi saat: iOS'ta küçük yerel seçici, Android'de sistem penceresi; web önizlemede yalnız gösterilir
function TimePill({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  if (Platform.OS === 'ios') {
    return <DateTimePicker value={toDate(value)} mode="time" display="compact" locale="tr-TR" themeVariant="light"
      onChange={(_, d) => d && onChange(fmt(d))} />;
  }
  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={styles.pill} accessibilityRole="button" accessibilityLabel={`Saat ${value}`}>
        <Ionicons name="time-outline" size={13} color={colors.navy} />
        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.navy }}>{value}</Text>
      </Pressable>
      {open && Platform.OS === 'android' && (
        <DateTimePicker value={toDate(value)} mode="time" is24Hour
          onChange={(e, d) => { setOpen(false); if (e.type === 'set' && d) onChange(fmt(d)); }} />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 18, paddingBottom: 6 },
  topTitle: { fontSize: 16, fontWeight: '700', color: colors.navy },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.lg, padding: 16 },
  title: { fontSize: 18, fontWeight: '800', color: colors.navy },
  cap: { fontSize: 12, color: colors.muted },
  h: { fontSize: 14, fontWeight: '700', color: colors.navy },
  kid: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 4, paddingRight: 12, height: 36, borderRadius: radius.pill, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line },
  kidOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  timedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10 },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.faint, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  itemTitle: { fontSize: 15, fontWeight: '600', color: colors.navy, padding: 0, letterSpacing: 0 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F1F2F6', borderRadius: radius.pill, paddingHorizontal: 10, height: 30 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 28 },
  cta: { height: 52, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
