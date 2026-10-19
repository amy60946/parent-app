import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, difficultyMeta } from '../theme';
import { Avatar, Card } from './ui';
import Sheet from './Sheet';
import { useStore } from '../store';
import { useAuth } from '../lib/auth';
import { formatTR, todayISO } from '../dates';
import {
  ClinicLink, InvitePreview, Suggestion, listLinks, previewInvite, shareWithClinic, stopSharing,
  pendingSuggestions, decideSuggestion, addAbcEvent,
} from '../lib/clinic';

type View_ = 'home' | 'code' | 'abc';

// Uzmanla paylaş: kodla bağlan (açık rıza), paylaşımları yönet, uzman önerilerini kabul et, zor anı kaydet
export default function ClinicShareSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [view, setView] = useState<View_>('home');
  const close = () => { setView('home'); onClose(); };
  const title = view === 'code' ? 'Uzmanla paylaş' : view === 'abc' ? 'Zor bir anı kaydet' : 'Uzmanım';
  return (
    <Sheet visible={visible} title={title} onClose={close}>
      {view === 'home' && <Home onCode={() => setView('code')} onAbc={() => setView('abc')} visible={visible} />}
      {view === 'code' && <CodeFlow onDone={() => setView('home')} />}
      {view === 'abc' && <AbcForm onDone={() => setView('home')} />}
    </Sheet>
  );
}

/* ---------- Ana görünüm ---------- */

function Home({ onCode, onAbc, visible }: { onCode: () => void; onAbc: () => void; visible: boolean }) {
  const { children, familyId, addTasks } = useStore();
  const [links, setLinks] = useState<ClinicLink[] | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const load = useCallback(async () => {
    try {
      setLinks(await listLinks());
      if (familyId) setSuggestions(await pendingSuggestions(familyId));
    } catch (e) {
      setLinks([]);
      Alert.alert('Yüklenemedi', (e as Error).message);
    }
  }, [familyId]);
  useEffect(() => { if (visible) load(); }, [visible, load]);

  const childName = (id: string) => children.find((c) => c.id === id)?.name ?? '';

  const stop = (l: ClinicLink) => Alert.alert(
    'Paylaşım durdurulsun mu?',
    `${l.clinician || l.clinic}, ${childName(l.childId)} için yeni verileri artık göremez. Daha önce aldığı notlar uzmanda kalır.`,
    [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Durdur', style: 'destructive',
        onPress: async () => {
          try { await stopSharing(l.linkId); load(); } catch (e) { Alert.alert('Durdurulamadı', (e as Error).message); }
        },
      },
    ],
  );

  const decide = async (s: Suggestion, accept: boolean) => {
    try {
      await decideSuggestion(s.id, accept);
      if (accept) {
        addTasks([{
          title: s.title, emoji: s.emoji, skill: s.skill || 'Özel', description: s.note,
          assignments: [{ childId: s.childId, difficulty: s.difficulty, coins: difficultyMeta[s.difficulty].coins }],
          startDate: todayISO(), recurring: s.recurring, repeatKind: 'daily', repeatDays: [], requiresReview: true,
        }]);
      }
      setSuggestions((p) => p.filter((x) => x.id !== s.id));
      if (accept) Alert.alert('Görev eklendi', `"${s.title}" bugünden itibaren ${childName(s.childId)} için görevlerde.`);
    } catch (e) {
      Alert.alert('Kaydedilemedi', (e as Error).message);
    }
  };

  if (!links) return <ActivityIndicator color={colors.navy} style={{ marginVertical: 30 }} />;

  return (
    <View style={{ gap: 14 }}>
      {links.length === 0 ? (
        <Text style={styles.body}>
          Çocuğunla çalışan bir uzman (psikolog, ergoterapist, öğretmen) varsa, görev ilerlemesini onunla paylaşabilirsin.
          Uzman sana 6 haneli bir kod verir.
        </Text>
      ) : (
        <View style={{ gap: 8 }}>
          {links.map((l) => {
            const c = children.find((x) => x.id === l.childId);
            return (
              <Card key={l.linkId} style={styles.linkCard}>
                {c && <Avatar id={c.avatar} size={40} />}
                <View style={{ flex: 1 }}>
                  <Text style={styles.h}>{l.clinician || l.clinic}</Text>
                  <Text style={styles.cap}>{[l.title, l.clinic].filter(Boolean).join(' · ')}</Text>
                  <Text style={styles.cap}>{c?.name} · {formatTR(l.consentAt.slice(0, 10))} tarihinden beri</Text>
                </View>
                <Pressable onPress={() => stop(l)} hitSlop={8} accessibilityLabel="Paylaşımı durdur">
                  <Text style={{ color: colors.danger, fontSize: 13, fontWeight: '600' }}>Durdur</Text>
                </Pressable>
              </Card>
            );
          })}
        </View>
      )}

      {suggestions.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={styles.section}>Uzman önerileri</Text>
          {suggestions.map((s) => (
            <Card key={s.id} style={{ gap: 10, backgroundColor: '#F7F8FB' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ fontSize: 24 }}>{s.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.h}>{s.title}</Text>
                  <Text style={styles.cap}>{childName(s.childId)} · {difficultyMeta[s.difficulty].label} · {s.recurring ? 'Her gün' : 'Bir kez'} · {s.clinic}</Text>
                </View>
              </View>
              {!!s.note && <Text style={styles.body}>{s.note}</Text>}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable style={[styles.ghost, { flex: 1 }]} onPress={() => decide(s, false)}>
                  <Text style={{ color: colors.navy, fontWeight: '600' }}>Şimdilik değil</Text>
                </Pressable>
                <Pressable style={[styles.cta, { flex: 1, height: 44 }]} onPress={() => decide(s, true)}>
                  <Text style={styles.ctaText}>Görevlere ekle</Text>
                </Pressable>
              </View>
            </Card>
          ))}
        </View>
      )}

      {links.length > 0 && (
        <Pressable style={styles.row} onPress={onAbc}>
          <Ionicons name="pulse-outline" size={20} color={colors.navy} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, color: colors.navy }}>Zor bir anı kaydet</Text>
            <Text style={styles.cap}>Ne oldu, öncesinde ve sonrasında. Uzmanın görür.</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.faint} />
        </Pressable>
      )}

      <Pressable style={styles.cta} onPress={onCode}>
        <Text style={styles.ctaText}>{links.length ? 'Başka bir uzman kodu gir' : 'Uzman kodunu gir'}</Text>
      </Pressable>
    </View>
  );
}

/* ---------- Kod + açık rıza ---------- */

function CodeFlow({ onDone }: { onDone: () => void }) {
  const { children } = useStore();
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [childId, setChildId] = useState<string | undefined>(children.length === 1 ? children[0].id : undefined);
  const [busy, setBusy] = useState(false);

  const check = async () => {
    if (code.length !== 6) return Alert.alert('Kod 6 karakter olmalı');
    setBusy(true);
    try { setPreview(await previewInvite(code)); }
    catch (e) { Alert.alert('Kod kullanılamadı', (e as Error).message); }
    finally { setBusy(false); }
  };

  const consent = async () => {
    if (!childId) return Alert.alert('Hangi çocuk için paylaşılacağını seç');
    setBusy(true);
    try {
      await shareWithClinic(code, childId);
      Alert.alert('Paylaşım başladı', 'İstediğin zaman Uzmanım bölümünden durdurabilirsin.');
      onDone();
    } catch (e) {
      Alert.alert('Paylaşılamadı', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!preview) {
    return (
      <View style={{ gap: 14 }}>
        <Text style={styles.body}>Uzmanının sana verdiği 6 haneli kodu yaz. Onaylamadan önce kimin istediğini göreceksin.</Text>
        <TextInput
          value={code}
          onChangeText={(v) => setCode(v.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6))}
          placeholder="KOD"
          placeholderTextColor={colors.faint}
          autoCapitalize="characters"
          autoCorrect={false}
          style={[styles.input, { fontSize: 24, fontWeight: '800', letterSpacing: 6, textAlign: 'center' }]}
        />
        <Pressable style={[styles.cta, busy && { opacity: 0.6 }]} disabled={busy} onPress={check}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Devam</Text>}
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ gap: 14 }}>
      <Card style={{ backgroundColor: '#F7F8FB', gap: 2 }}>
        <Text style={styles.h}>{preview.clinician || preview.clinic}</Text>
        <Text style={styles.cap}>{[preview.title, preview.clinic].filter(Boolean).join(' · ')}</Text>
      </Card>

      <Text style={styles.section}>Hangi çocuk için?</Text>
      <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
        {children.map((c) => (
          <Pressable key={c.id} onPress={() => setChildId(c.id)} style={{ alignItems: 'center', gap: 4, opacity: childId === c.id ? 1 : 0.5 }}>
            <Avatar id={c.avatar} size={48} ring={childId === c.id} />
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.navy }}>{c.name}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.section}>Uzmanın görecekleri</Text>
      <View style={{ gap: 8 }}>
        <Bullet ok text="Görevler ve tamamlanma durumu (saatiyle)" />
        <Bullet ok text='"Yapamam" yanıtları ve nedenleri' />
        <Bullet ok text="Bu uygulamada kaydettiğin zor anlar" />
        <Bullet text="Posta mesajları, fotoğraf ve sesler" />
        <Bullet text="Coin bakiyesi ve oyun içi bilgiler" />
      </View>
      <Text style={styles.cap}>
        Uzman verileri yalnızca okur ve sana görev önerebilir; görev eklemek senin kararındır.
        Paylaşımı istediğin an durdurabilirsin.
      </Text>

      <Pressable style={[styles.cta, (busy || !childId) && { opacity: 0.6 }]} disabled={busy} onPress={consent}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Onaylıyorum, paylaş</Text>}
      </Pressable>
      <Pressable style={styles.ghost} onPress={onDone}><Text style={{ color: colors.navy, fontWeight: '600' }}>Vazgeç</Text></Pressable>
    </View>
  );
}

function Bullet({ ok, text }: { ok?: boolean; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Ionicons name={ok ? 'checkmark-circle' : 'close-circle-outline'} size={18} color={ok ? colors.easy.fg : colors.faint} />
      <Text style={[styles.body, !ok && { color: colors.muted }]}>{text}{ok ? '' : ' paylaşılmaz'}</Text>
    </View>
  );
}

/* ---------- ABC kaydı ---------- */

function AbcForm({ onDone }: { onDone: () => void }) {
  const { children, familyId } = useStore();
  const { session } = useAuth();
  const [childId, setChildId] = useState(children[0]?.id);
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [c, setC] = useState('');
  const [intensity, setIntensity] = useState(3);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!familyId || !childId) return;
    if (!b.trim()) return Alert.alert('Ne olduğunu kısaca yaz');
    setBusy(true);
    try {
      await addAbcEvent(familyId, session?.user.id, { childId, antecedent: a, behavior: b, consequence: c, intensity });
      Alert.alert('Kaydedildi');
      onDone();
    } catch (e) {
      Alert.alert('Kaydedilemedi', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 14 }}>
      {children.length > 1 && (
        <View style={{ flexDirection: 'row', gap: 16 }}>
          {children.map((x) => (
            <Pressable key={x.id} onPress={() => setChildId(x.id)} style={{ alignItems: 'center', gap: 4, opacity: childId === x.id ? 1 : 0.5 }}>
              <Avatar id={x.avatar} size={44} ring={childId === x.id} />
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.navy }}>{x.name}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <Field label="Öncesinde ne oldu?" value={a} onChange={setA} placeholder="Ör. tablet süresi bitti" />
      <Field label="Ne yaptı?" value={b} onChange={setB} placeholder="Ör. ağladı, kapıyı çarptı" />
      <Field label="Sonrasında ne oldu?" value={c} onChange={setC} placeholder="Ör. odasına gitti, sakinleşti" />
      <View>
        <Text style={styles.cap}>Ne kadar zordu?</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
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
    </View>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <View>
      <Text style={styles.cap}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.faint}
        style={styles.input} maxLength={400} multiline />
    </View>
  );
}

const styles = StyleSheet.create({
  h: { fontSize: 15, fontWeight: '600', color: colors.navy },
  cap: { fontSize: 12, color: colors.muted },
  body: { fontSize: 13, color: colors.navy, lineHeight: 19 },
  section: { fontSize: 11, fontWeight: '600', letterSpacing: 0.6, color: colors.muted, textTransform: 'uppercase' },
  linkCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F7F8FB' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  input: { backgroundColor: '#F3F4F8', borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.navy, marginTop: 4 },
  cta: { height: 52, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  ghost: { height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3F4F8', alignItems: 'center', justifyContent: 'center' },
});
