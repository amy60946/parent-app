import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  useAudioRecorder, useAudioRecorderState, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync,
} from 'expo-audio';
import { colors, radius } from '../theme';
import { Avatar, Card, IconButton } from '../components/ui';
import DateField from '../components/DateField';
import { useStore } from '../store';
import { useAuth } from '../lib/auth';
import { addDays, formatTR, toISO, todayISO } from '../dates';
import { AbcEvent, addAbc, deleteAbc, listAbc } from '../lib/abc';
import { ClinicLink, listLinks } from '../lib/clinic';
import { DayPart, dayPartLabel, dayPartOf } from '../data/dayParts';
import { Voice, mmss } from './ChatScreen';
import { useBilling } from '../billing';

// Gözlem notları (ABC kaydı): yeni kayıt (çok çocuk, gün bölümü seçimi, sesli kayıt) + geçmiş kayıtlar (arşiv).
// Rızalı paylaşım varsa kayıt o çocuğun uzmanına gider; olmasa da ailenin raporunda kalır.
export default function AbcScreen({ navigation, route }: any) {
  const { children, familyId } = useStore();
  const [events, setEvents] = useState<AbcEvent[] | null>(null);
  const [links, setLinks] = useState<ClinicLink[]>([]);
  const [childFilter, setChildFilter] = useState<string | 'all'>(route.params?.childId ?? 'all');
  const [form, setForm] = useState<boolean>(!!route.params?.new);

  const load = useCallback(async () => {
    if (!familyId) return;
    try {
      const [ev, ln] = await Promise.all([listAbc(familyId), listLinks().catch(() => [] as ClinicLink[])]);
      setEvents(ev);
      setLinks(ln);
    } catch (e) {
      setEvents([]);
      Alert.alert('Yüklenemedi', (e as Error).message);
    }
  }, [familyId]);
  useEffect(() => { load(); }, [load]);

  const name = (id: string) => children.find((c) => c.id === id)?.name ?? '';
  const shown = (events ?? []).filter((e) => childFilter === 'all' || e.childIds.includes(childFilter));
  const sharedWith = (e: AbcEvent) =>
    [...new Set(links.filter((l) => e.childIds.includes(l.childId)).map((l) => l.clinician || l.clinic))];

  const remove = (e: AbcEvent) => Alert.alert('Kayıt silinsin mi?', 'Uzman da artık göremez.', [
    { text: 'Vazgeç', style: 'cancel' },
    { text: 'Sil', style: 'destructive', onPress: async () => {
      try { await deleteAbc(e); load(); } catch (err) { Alert.alert('Silinemedi', (err as Error).message); }
    } },
  ]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <IconButton name="chevron-back" onPress={() => (form && events?.length ? setForm(false) : navigation.goBack())} label="Geri" />
        <Text style={styles.title}>{form ? 'Gözlem notu ekle' : 'Gözlem notları'}</Text>
        <View style={{ width: 36 }} />
      </View>

      {form ? (
        <AbcForm onDone={() => { setForm(false); load(); }} defaultChild={childFilter === 'all' ? undefined : childFilter} links={links} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
          <Pressable style={styles.cta} onPress={() => setForm(true)}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.ctaText}>Gözlem notu ekle</Text>
          </Pressable>
          <Text style={styles.cap}>
            Ne oldu, öncesinde ve sonrasında. Uzmanla paylaştığın çocuklar için uzmanın da görür.
          </Text>

          {children.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              <Chip label="Tümü" on={childFilter === 'all'} onPress={() => setChildFilter('all')} />
              {children.map((c) => <Chip key={c.id} label={c.name} on={childFilter === c.id} onPress={() => setChildFilter(c.id)} />)}
            </ScrollView>
          )}

          <Text style={styles.section}>Geçmiş kayıtlar</Text>
          {!events ? <ActivityIndicator color={colors.navy} style={{ marginTop: 20 }} /> : shown.length === 0 ? (
            <Text style={[styles.cap, { textAlign: 'center', marginTop: 20 }]}>Henüz kayıt yok.</Text>
          ) : shown.map((e) => {
            const to = sharedWith(e);
            return (
              <Pressable key={e.key} onLongPress={() => remove(e)} accessibilityHint="Uzun basınca silinir">
                <Card style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.h}>{formatTR(toISO(new Date(e.occurredAt)))} · {dayPartLabel[e.dayPart]}</Text>
                    <View style={{ flex: 1 }} />
                    <Text style={styles.badge}>Şiddet {e.intensity}/5</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {e.childIds.map((id) => {
                      const c = children.find((x) => x.id === id);
                      return c ? <Avatar key={id} id={c.avatar} size={22} /> : null;
                    })}
                    <Text style={styles.cap}>{e.childIds.map(name).join(', ')}</Text>
                  </View>
                  {!!e.antecedent && <Line k="Öncesinde" v={e.antecedent} />}
                  <Line k="Ne oldu" v={e.behavior} />
                  {!!e.consequence && <Line k="Sonrasında" v={e.consequence} />}
                  {!!e.audioPath && <Voice uri={e.audioUrl} durationMs={e.durationMs} color={colors.navy} />}
                  <Text style={[styles.cap, { marginTop: 2 }]}>
                    {to.length ? `🩺 Uzmana iletildi: ${to.join(', ')}` : 'Yalnız ailede (uzmanla paylaşım yok)'}
                  </Text>
                </Card>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return <Text style={styles.body}><Text style={{ fontWeight: '700' }}>{k}: </Text>{v}</Text>;
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, on && { backgroundColor: colors.navy, borderColor: colors.navy }]}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: on ? '#fff' : colors.navy }}>{label}</Text>
    </Pressable>
  );
}

/* ---------- Yeni kayıt ---------- */

const PARTS: DayPart[] = ['morning', 'noon', 'evening', 'night'];

function AbcForm({ onDone, defaultChild, links }: { onDone: () => void; defaultChild?: string; links: ClinicLink[] }) {
  const { children, familyId } = useStore();
  const { session } = useAuth();
  const { allow } = useBilling();
  const today = todayISO();
  const yesterday = toISO(addDays(new Date(), -1));
  const [childIds, setChildIds] = useState<string[]>(defaultChild ? [defaultChild] : children.length === 1 ? [children[0].id] : []);
  const [date, setDate] = useState(today);
  const [otherDay, setOtherDay] = useState(false);
  const [part, setPart] = useState<DayPart>(() => {
    const d = new Date();
    return dayPartOf(`${d.getHours()}:${d.getMinutes()}`);
  });
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [c, setC] = useState('');
  const [intensity, setIntensity] = useState(3);
  const [busy, setBusy] = useState(false);

  // Sesli kayıt
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const rec = useAudioRecorderState(recorder, 250);
  const [recording, setRecording] = useState(false);
  const [audio, setAudio] = useState<{ uri: string; durationMs: number } | null>(null);

  const startRec = async () => {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) return Alert.alert('Mikrofon izni gerekli', 'Ayarlar > ParentApp > Mikrofon');
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
    } catch (e) {
      Alert.alert('Kayıt başlatılamadı', (e as Error).message);
    }
  };
  const stopRec = async () => {
    const durationMs = recorder.getStatus().durationMillis;
    setRecording(false);
    try { await recorder.stop(); } finally { await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }); }
    if (recorder.uri && durationMs > 500) setAudio({ uri: recorder.uri, durationMs });
  };

  const toggleChild = (id: string) => setChildIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const save = async () => {
    if (!familyId || !allow('abc')) return;
    if (!childIds.length) return Alert.alert('Hangi çocuk(lar)la ilgili olduğunu seç');
    if (!b.trim() && !audio) return Alert.alert('Ne olduğunu kısaca yaz ya da sesli anlat');
    if (recording) await stopRec();
    setBusy(true);
    try {
      await addAbc(familyId, session?.user.id, {
        childIds, date, dayPart: part, antecedent: a, behavior: b.trim() || 'Sesli kayıt', consequence: c, intensity,
        audio: audio ?? undefined,
      });
      // Asıl amaç uzmana iletmek: kime gittiğini açıkça söyle
      const nm = (id: string) => children.find((x) => x.id === id)?.name ?? '';
      const shared = childIds.filter((id) => links.some((l) => l.childId === id));
      const experts = [...new Set(links.filter((l) => childIds.includes(l.childId)).map((l) => l.clinician || l.clinic))];
      const notShared = childIds.filter((id) => !shared.includes(id)).map(nm);
      if (experts.length) {
        Alert.alert('Uzmana iletildi', `${experts.join(', ')} kaydı görebilir (${shared.map(nm).join(', ')}).`
          + (notShared.length ? `\n\n${notShared.join(', ')} uzmanla paylaşılmadığı için kayıt yalnız ailede kaldı.` : ''));
      } else {
        Alert.alert('Kaydedildi', 'Uzmanla paylaşım olmadığı için kayıt yalnız ailede. Uzmanım bölümünden bir uzmanla paylaşırsan sonraki kayıtlar ona iletilir.');
      }
      onDone();
    } catch (e) {
      Alert.alert('Kaydedilemedi', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const recMs = useMemo(() => rec.durationMillis ?? 0, [rec.durationMillis]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      <View>
        <Text style={styles.section}>Kimlerle ilgili? (birden çok seçebilirsin)</Text>
        <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
          {children.map((x) => {
            const on = childIds.includes(x.id);
            return (
              <Pressable key={x.id} onPress={() => toggleChild(x.id)} accessibilityState={{ selected: on }}
                style={{ alignItems: 'center', gap: 4, opacity: on ? 1 : 0.45 }}>
                <Avatar id={x.avatar} size={48} ring={on} />
                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.navy }}>{on ? '✓ ' : ''}{x.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View>
        <Text style={styles.section}>Ne zaman?</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <Chip label="Bugün" on={!otherDay && date === today} onPress={() => { setOtherDay(false); setDate(today); }} />
          <Chip label="Dün" on={!otherDay && date === yesterday} onPress={() => { setOtherDay(false); setDate(yesterday); }} />
          <Chip label="Başka gün" on={otherDay} onPress={() => setOtherDay(true)} />
        </View>
        {otherDay && (
          <View style={{ marginTop: 8 }}>
            <DateField mode="date" value={date} onChange={(v) => v && setDate(v)} placeholder="Gün seç" maximumDate={new Date()} />
          </View>
        )}
        <View style={styles.parts}>
          {PARTS.map((p) => (
            <Pressable key={p} onPress={() => setPart(p)} style={[styles.part, part === p && styles.partOn]}
              accessibilityState={{ selected: part === p }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: part === p ? colors.navy : colors.muted }}>{dayPartLabel[p]}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Field label="Öncesinde ne oldu?" value={a} onChange={setA} placeholder="Ör. tablet süresi bitti" />
      <Field label="Ne yaşandı?" value={b} onChange={setB} placeholder="Ör. ağladı, kapıyı çarptı" />
      <Field label="Sonrasında ne oldu?" value={c} onChange={setC} placeholder="Ör. odasına gitti, sakinleşti" />

      <View>
        <Text style={styles.section}>Sesli anlat (isteğe bağlı)</Text>
        <View style={[styles.recBox, { marginTop: 8 }]}>
          {recording ? (
            <>
              <View style={styles.recDot} />
              <Text style={{ flex: 1, color: colors.navy, fontVariant: ['tabular-nums'] }}>Kaydediliyor · {mmss(recMs)}</Text>
              <Pressable onPress={stopRec} style={styles.recBtn} accessibilityLabel="Kaydı bitir">
                <Ionicons name="stop" size={18} color="#fff" />
              </Pressable>
            </>
          ) : audio ? (
            <>
              <View style={{ flex: 1 }}><Voice uri={audio.uri} durationMs={audio.durationMs} color={colors.navy} /></View>
              <IconButton name="trash-outline" color={colors.danger} label="Sesli kaydı sil" onPress={() => setAudio(null)} />
            </>
          ) : (
            <>
              <Text style={{ flex: 1, color: colors.muted, fontSize: 13 }}>Yazmak yerine konuşarak da anlatabilirsin. Uzmanın dinleyebilir.</Text>
              <Pressable onPress={startRec} style={styles.recBtn} accessibilityLabel="Sesli kayda başla">
                <Ionicons name="mic" size={18} color="#fff" />
              </Pressable>
            </>
          )}
        </View>
      </View>

      <View>
        <Text style={styles.section}>Ne kadar zordu?</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} onPress={() => setIntensity(n)} accessibilityLabel={`Şiddet ${n}`}
              style={[styles.dot, intensity === n && { backgroundColor: colors.navy }]}>
              <Text style={{ fontWeight: '700', color: intensity === n ? '#fff' : colors.navy }}>{n}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={[styles.cap, { marginTop: 4 }]}>1 hafif · 5 çok zor</Text>
      </View>

      <Pressable style={[styles.cta, busy && { opacity: 0.6 }]} disabled={busy} onPress={save}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Kaydet</Text>}
      </Pressable>
    </ScrollView>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <View>
      <Text style={styles.section}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.faint}
        style={styles.input} maxLength={400} multiline />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  title: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.navy, textAlign: 'center' },
  h: { fontSize: 14, fontWeight: '700', color: colors.navy },
  cap: { fontSize: 12, color: colors.muted },
  body: { fontSize: 13, color: colors.navy, lineHeight: 19 },
  section: { fontSize: 13, fontWeight: '600', color: colors.muted },
  badge: { fontSize: 11, fontWeight: '700', color: colors.hard.fg, backgroundColor: colors.hard.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, overflow: 'hidden' },
  chip: { height: 34, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, justifyContent: 'center' },
  parts: { flexDirection: 'row', gap: 8, marginTop: 10 },
  part: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 8, borderRadius: radius.md, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line },
  partOn: { borderColor: colors.navy, borderWidth: 1.5 },
  input: { letterSpacing: 0, backgroundColor: '#fff', borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.navy, marginTop: 6 },
  recBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: radius.md, padding: 12 },
  recBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger },
  dot: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  cta: { flexDirection: 'row', gap: 6, height: 52, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
