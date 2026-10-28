import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Info from '../components/Info';
import Sheet from '../components/Sheet';
import SuggestionCard from '../components/SuggestionCard';
import VerifiedBadge from '../components/VerifiedBadge';
import { Avatar, IconButton, Toggle } from '../components/ui';
import { ClinicianAvatar } from './CareScreen';
import { colors, radius } from '../theme';
import { useStore } from '../store';
import { useAuth } from '../lib/auth';
import { useCare, groupClinicians, CareTodo } from '../lib/care';
import { ClinicLink, addChildToClinic, saveLog, setHistoryShared, stopSharing } from '../lib/clinic';
import { historyConsent, removeText, unlinkText } from '../data/clinicTexts';
import { formatTR, todayISO } from '../dates';
import { genitive } from '../lib/tr';
import { track } from '../lib/track';
import { afterModal } from '../lib/modal';

// Uzmanım › uzman (kullanıcı isteği 28 Ekim 2026, Joon "Care › therapist" örneğinden): bugün yapılacaklar (uzmanın aile
// programındaki uygulamalar + davranış kaydı), çocuk başına program (takip planı), görev önerileri, paylaşılan çocuklar.
// Sağ üstteki ayar: çocuğu uzmandan ayır ya da uzmanı tamamen kaldır (revoke_clinic_link; akislar.md 5, 8).
export default function ClinicianScreen({ navigation, route }: any) {
  const clinicId: string = route.params.clinicId;
  const { children, familyId } = useStore();
  const { session } = useAuth();
  const { care, reload, setCare } = useCare(familyId);
  const [manage, setManage] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const c = groupClinicians(care?.links ?? []).find((x) => x.clinicId === clinicId);
  const childName = (id: string) => children.find((k) => k.id === id)?.name ?? '';

  if (!care) return <SafeAreaView style={styles.safe}><ActivityIndicator color={colors.navy} style={{ marginTop: 60 }} /></SafeAreaView>;
  if (!c) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={{ padding: 12 }}><IconButton name="chevron-back" label="Geri" onPress={() => navigation.goBack()} /></View>
        <Text style={[styles.text, { padding: 24, textAlign: 'center' }]}>Bu uzmanla paylaşım yok.</Text>
      </SafeAreaView>
    );
  }

  const links = c.links;
  const todos = care.todos.filter((t) => links.some((l) => l.linkId === t.linkId));
  const suggestions = care.suggestions.filter((s) => links.some((l) => l.linkId === s.linkId));
  const unshared = children.filter((k) => !links.some((l) => l.childId === k.id));

  // "Bugün uyguladım" kısayolu: işaretliyse ayrıntı (zorluk / geri alma) takip planında
  const practice = async (t: CareTodo) => {
    if (!session) return;
    if (t.doneToday) return openPlan(links.find((l) => l.linkId === t.linkId)!);
    setCare((p) => p && ({ ...p, todos: p.todos.map((x) => (x.module.id === t.module.id ? { ...x, doneToday: true, module: { ...x.module, practicedWeek: x.module.practicedWeek + 1 } } : x)) }));
    try {
      await saveLog(session.user.id, todayISO(), { moduleId: t.module.id, practiced: true });
      track('care.log', { practiced: true, from: 'clinician' });
    } catch (e) {
      reload();
      Alert.alert('Kaydedilemedi', (e as Error).message);
    }
  };
  const openPlan = (l: ClinicLink) => navigation.navigate('CarePlan', { linkId: l.linkId, childName: childName(l.childId), clinician: c.name });

  const add = (childId: string) => Alert.alert(
    `${childName(childId)} da paylaşılsın mı?`,
    `${c.name}, ${childName(childId)} için görevleri, tamamlanma durumunu ve davranış kayıtlarını görebilecek. Mesajlar ve coin paylaşılmaz. İstediğin an durdurabilirsin.`,
    [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Onaylıyorum, paylaş', onPress: async () => {
        try { await addChildToClinic(clinicId, childId); reload(); } catch (e) { Alert.alert('Paylaşılamadı', (e as Error).message); }
      } },
    ],
  );

  // Önceki uzman kayıtlarının bu uzmana aktarımı: açarken açık rıza (uzman-gecis-v1), kapatınca erişim hemen biter
  const history = (l: ClinicLink, on: boolean) => {
    const apply = async () => { try { await setHistoryShared(l.linkId, on); reload(); } catch (e) { Alert.alert('Kaydedilemedi', (e as Error).message); } };
    if (!on) {
      return Alert.alert('Önceki kayıtların paylaşımı durdurulsun mu?', `${c.name}, ${childName(l.childId)} için önceki uzmanların kayıtlarını artık göremez.`,
        [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Durdur', style: 'destructive', onPress: apply }]);
    }
    Alert.alert('Önceki uzmanın kayıtlarını da paylaş (adı gizlenir)', historyConsent(childName(l.childId), c.name),
      [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Onaylıyorum', onPress: apply }]);
  };

  const unlink = (l: ClinicLink) => Alert.alert(`${childName(l.childId)} bu uzmandan ayrılsın mı?`, unlinkText(childName(l.childId), c.name), [
    { text: 'Vazgeç', style: 'cancel' },
    { text: 'Ayır', style: 'destructive', onPress: async () => {
      setBusy(l.linkId);
      try {
        await stopSharing(l.linkId);
        track('clinic.unlink', { all: links.length === 1 });
        // Son çocuk da ayrıldı: sayfa kapanır (alttaki sayfa kapanınca; iOS'ta kapanırken geri gitmek dokunuşu kilitleyebilir)
        if (links.length === 1) { setManage(false); afterModal(() => navigation.goBack()); } else reload();
      } catch (e) { Alert.alert('Ayrılamadı', (e as Error).message); } finally { setBusy(null); }
    } },
  ]);
  const remove = () => Alert.alert(`${c.name} kaldırılsın mı?`, removeText(c.name), [
    { text: 'Vazgeç', style: 'cancel' },
    { text: 'Uzmanı kaldır', style: 'destructive', onPress: async () => {
      setBusy('all');
      try {
        for (const l of links) await stopSharing(l.linkId);
        track('clinic.remove', { n: links.length });
        setManage(false);
        afterModal(() => navigation.goBack());
      } catch (e) { reload(); Alert.alert('Kaldırılamadı', (e as Error).message); } finally { setBusy(null); }
    } },
  ]);

  return (
    <View style={styles.safe}>
      <SafeAreaView edges={['top']} style={styles.hero}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingTop: 6, paddingBottom: 18 }}>
          <IconButton name="chevron-back" label="Geri" onPress={() => navigation.goBack()} color="#fff" style={styles.heroBtn} />
          <ClinicianAvatar name={c.name} size={46} light />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.heroName} numberOfLines={1}>{c.name}</Text>
            <Text style={styles.heroCap} numberOfLines={1}>{[c.title, c.clinic !== c.name ? c.clinic : ''].filter(Boolean).join(' · ') || 'Uzman'}</Text>
          </View>
          <IconButton name="settings-outline" label="Uzmanı yönet" onPress={() => setManage(true)} color="#fff" style={styles.heroBtn} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 18 }}>
        <VerifiedBadge verifiedAs={c.verifiedAs} />

        <Section title="Bugün yapılacaklar" info="Uzmanının seninle paylaştığı evde uygulamalar. Uyguladığın gün kutuyu işaretle; nasıl geçtiğini takip planında yazabilirsin. Zor bir an olduysa davranış kaydı ekle; uzmanın görür.">
          {todos.map((t, i) => (
            <View key={t.module.id} style={[styles.row, i > 0 && styles.sep]}>
              <Pressable style={{ flex: 1, gap: 2 }} onPress={() => openPlan(links.find((l) => l.linkId === t.linkId)!)} accessibilityRole="button">
                <Text style={styles.kicker}>{childName(t.childId)} · uygulama</Text>
                <Text style={styles.rowTitle}>{t.module.title}</Text>
              </Pressable>
              <Pressable onPress={() => practice(t)} hitSlop={8} accessibilityRole="checkbox" accessibilityState={{ checked: t.doneToday }}
                accessibilityLabel={`${t.module.title}: bugün uyguladım`} style={[styles.box, t.doneToday && styles.boxOn]}>
                {t.doneToday && <Ionicons name="checkmark" size={18} color="#fff" />}
              </Pressable>
            </View>
          ))}
          <Pressable onPress={() => navigation.navigate('Abc', { new: true })} style={[styles.row, todos.length > 0 && styles.sep]} accessibilityRole="button">
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.rowTitle}>Davranış kaydı ekle</Text>
              <Text style={styles.cap}>Ne oldu, öncesinde ve sonrasında</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.faint} />
          </Pressable>
        </Section>

        <Section title="Program" info="Uzmanının her çocuk için paylaştığı hedefler ve aile programı (eğitimler). İlerlemeyi buradan takip edersin; uzmanın da görür. Bu bilgiler tanı ya da puan değildir.">
          {links.map((l, i) => {
            const p = care.plans[l.linkId];
            const active = p?.modules.filter((m) => m.status === 'active') ?? [];
            const week = active.reduce((n, m) => n + Math.min(m.practicedWeek, 7), 0);
            const pct = active.length ? Math.round((week / (active.length * 7)) * 100) : 0;
            const sub = !l.planReady ? 'Takip planı bu sürümde açık değil'
              : !p || (!p.modules.length && !p.goals.length) ? 'Uzmanın henüz plan paylaşmadı'
              : [active.length ? `${active.length} uygulama` : '', p.goals.length ? `${p.goals.length} hedef` : '', active.length ? `bu hafta %${pct}` : ''].filter(Boolean).join(' · ');
            return (
              <Pressable key={l.linkId} onPress={() => openPlan(l)} disabled={!l.planReady} style={[styles.row, i > 0 && styles.sep]} accessibilityRole="button">
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={styles.rowTitle}>{genitive(childName(l.childId))} programı</Text>
                  {active.length > 0 && <View style={styles.bar}><View style={[styles.barFill, { width: `${pct}%` }]} /></View>}
                  <Text style={styles.cap}>{sub}</Text>
                </View>
                {l.planReady && <Ionicons name="chevron-forward" size={16} color={colors.faint} />}
              </Pressable>
            );
          })}
        </Section>

        {suggestions.length > 0 && (
          <View style={{ gap: 8 }}>
            <Text style={styles.section}>Görev önerileri</Text>
            {suggestions.map((s) => (
              <SuggestionCard key={s.id} s={s} childName={childName(s.childId)}
                onDecided={(id) => setCare((p) => p && ({ ...p, suggestions: p.suggestions.filter((x) => x.id !== id) }))} />
            ))}
          </View>
        )}

        <Section title="Paylaşılan çocuklar">
          {links.map((l, i) => {
            const k = children.find((x) => x.id === l.childId);
            return (
              <View key={l.linkId} style={[{ paddingVertical: 12, gap: 8 }, i > 0 && styles.sep]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  {k && <Avatar id={k.avatar} size={36} />}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{childName(l.childId)}</Text>
                    <Text style={styles.cap}>Paylaşılıyor · {formatTR(l.consentAt.slice(0, 10))}</Text>
                  </View>
                </View>
                {l.historyAvailable && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 46 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.navy }}>Önceki uzmanın kayıtları</Text>
                      <Text style={styles.cap}>{l.historyShared ? 'Paylaşılıyor · önceki uzmanın adı gizli' : 'Paylaşılmıyor'}</Text>
                    </View>
                    <Toggle value={l.historyShared} onChange={(on) => history(l, on)} />
                  </View>
                )}
              </View>
            );
          })}
          {unshared.map((k) => (
            <View key={k.id} style={[styles.row, styles.sep]}>
              <Avatar id={k.avatar} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{k.name}</Text>
                <Text style={styles.cap}>Paylaşılmıyor</Text>
              </View>
              <Pressable onPress={() => add(k.id)} hitSlop={8} accessibilityLabel={`${k.name} çocuğunu da paylaş`}>
                <Text style={{ color: colors.navy, fontSize: 14, fontWeight: '700' }}>Ekle</Text>
              </Pressable>
            </View>
          ))}
        </Section>
      </ScrollView>

      {/* Uzmanı yönet: çocuğu ayır / uzmanı kaldır */}
      <Sheet visible={manage} title="Uzmanı yönet" onClose={() => setManage(false)}>
        <Text style={styles.section}>Şu an bağlı</Text>
        <View style={styles.manageCard}>
          {links.map((l, i) => {
            const k = children.find((x) => x.id === l.childId);
            return (
              <View key={l.linkId} style={[styles.row, i > 0 && styles.sep]}>
                {k && <Avatar id={k.avatar} size={32} />}
                <Text style={[styles.rowTitle, { flex: 1 }]}>{childName(l.childId)}</Text>
                <Pressable onPress={() => unlink(l)} disabled={!!busy} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${childName(l.childId)} çocuğunu uzmandan ayır`}>
                  {busy === l.linkId ? <ActivityIndicator color={colors.navy} /> : <Text style={styles.unlink}>Ayır</Text>}
                </Pressable>
              </View>
            );
          })}
        </View>
        <Pressable onPress={remove} disabled={!!busy} style={styles.remove} accessibilityRole="button">
          {busy === 'all' ? <ActivityIndicator color={colors.danger} /> : <Text style={styles.removeText}>{c.name} uzmanını kaldır</Text>}
        </Pressable>
        <Text style={[styles.cap, { textAlign: 'center' }]}>Uzman, ayırdığın çocuk için yeni verileri göremez. Daha önce aldığı notlar uzmanda kalır.</Text>
      </Sheet>
    </View>
  );
}

function Section({ title, info, children }: { title: string; info?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={styles.section}>{title}</Text>
        {!!info && <Info title={title} text={info} />}
      </View>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  hero: { backgroundColor: colors.navy, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  heroBtn: { backgroundColor: 'rgba(255,255,255,0.14)' },
  heroName: { fontSize: 20, fontWeight: '800', color: '#fff' },
  heroCap: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  section: { fontSize: 16, fontWeight: '800', color: colors.navy },
  text: { fontSize: 14, lineHeight: 20, color: '#4A5165' },
  cap: { fontSize: 12, lineHeight: 16, color: colors.muted },
  kicker: { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.3 },
  card: { backgroundColor: '#fff', borderRadius: radius.md, paddingHorizontal: 14 },
  manageCard: { backgroundColor: '#F7F8FB', borderRadius: radius.md, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.navy },
  box: { width: 28, height: 28, borderRadius: 8, borderWidth: 1.5, borderColor: colors.navy, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  boxOn: { backgroundColor: colors.easy.fg, borderColor: colors.easy.fg },
  bar: { height: 6, borderRadius: 3, backgroundColor: '#EEF0F5', overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: '#3FA98D' },
  unlink: { fontSize: 14, fontWeight: '700', color: colors.navy },
  remove: { height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F2C9D0', backgroundColor: '#FDF3F5' },
  removeText: { fontSize: 15, fontWeight: '700', color: colors.danger },
});
