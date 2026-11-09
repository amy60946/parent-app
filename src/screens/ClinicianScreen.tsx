import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Alert, ActivityIndicator, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Info from '../components/Info';
import Sheet from '../components/Sheet';
import SuggestionCard from '../components/SuggestionCard';
import RoutinePackCard from '../components/RoutinePackCard';
import ChangeSuggestionCard from '../components/ChangeSuggestionCard';
import VerifiedBadge from '../components/VerifiedBadge';
import { Avatar, IconButton, Toggle } from '../components/ui';
import { ClinicianAvatar } from '../components/ClinicianAvatar';
import { colors, radius } from '../theme';
import { COLUMN } from '../components/Column';
import { useStore } from '../store';
import { useAuth } from '../lib/auth';
import { useCare, groupClinicians, CareTodo } from '../lib/care';
import { ClinicLink, addChildToClinic, saveLog, setHistoryShared, stopSharing } from '../lib/clinic';
import { historyConsent, removeText, unlinkText } from '../data/clinicTexts';
import { formatTR, todayISO } from '../dates';
import { genitive } from '../lib/tr';
import { track } from '../lib/track';
import { afterModal } from '../lib/modal';
import SessionsSection from '../components/SessionsSection';
import { familySessions, syncSessionReminders } from '../lib/sessions';
import { useTrainings } from '../lib/trainings';
import { reportable, useTargetBehaviors } from '../lib/incidents';

// Uzmanım › uzman (kullanıcı isteği 28 Ekim 2026, Joon "Care › therapist" örneğinden): bugün yapılacaklar (uzmanın aile
// programındaki uygulamalar + davranış kaydı), çocuk başına program (takip planı), görev önerileri, paylaşılan çocuklar.
// Sağ üstteki ayar: çocuğu uzmandan ayır ya da uzmanı tamamen kaldır (revoke_clinic_link; akislar.md 5, 8).
// 3 Kasım 2026 (kullanıcı isteği): uzman bağlıysa Uzmanım sekmesi doğrudan bu sayfayla açılır (CareScreen, tab modu):
// geri düğmesi yok, sağ üstte "Uzman bağla"; birden çok uzmanda üstte uzman seçici. Bu ekran bildirimden açılınca kullanılır.
export default function ClinicianScreen({ navigation, route }: any) {
  // Bildirimden açılınca yalnız paylaşım kimliği gelir (care_plan_shared / clinic_suggestion data.link_id; akislar.md 12.1)
  const { familyId } = useStore();
  const state = useCare(familyId);
  // Seans bildiriminden yalnız seans kimliği gelir (data.session_id): paylaşımı randevulardan bul
  const sessionId: string | undefined = route.params?.sessionId;
  const [sessionLink, setSessionLink] = useState<string | undefined>();
  useEffect(() => {
    if (!sessionId || route.params?.linkId || route.params?.clinicId) return;
    familySessions().then((l) => setSessionLink(l?.find((s) => s.id === sessionId)?.linkId)).catch(() => {});
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps
  const linkId = route.params?.linkId ?? sessionLink;
  const clinicId: string | undefined = route.params?.clinicId ?? state.care?.links.find((l) => l.linkId === linkId)?.clinicId;
  return <ClinicianView navigation={navigation} clinicId={clinicId} sessionId={sessionId} {...state} />;
}

type CareHook = ReturnType<typeof useCare>;
export function ClinicianView({ navigation, clinicId, care, reload, setCare, tab, sessionId }: CareHook & {
  navigation: any; clinicId?: string; sessionId?: string;
  // Uzmanım sekmesinde: kaydırılan içeriğin başı (uzman seçici, bekleyen davetler) ve "Uzman bağla"
  tab?: { top?: React.ReactNode; onConnect: () => void };
}) {
  const { children } = useStore();
  const { session } = useAuth();
  const [manage, setManage] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const c = groupClinicians(care?.links ?? []).find((x) => x.clinicId === clinicId);
  const childName = (id: string) => children.find((k) => k.id === id)?.name ?? '';
  // Son çocuk ayrılınca ya da uzman kaldırılınca: sekmede liste yenilenir, ayrı sayfada geri gidilir
  const leave = () => { if (tab) reload(); else navigation.goBack(); };
  // iPad: ekran sütunu kenardan ayrık; başlık da kartlarla aynı hizada, dört köşesi yuvarlak
  const wide = useWindowDimensions().width > COLUMN;
  // Ebeveyn eğitimi görevleri ve davranış olayı (ortak akislar.md 23–24: "Uzmanım › uzman › Günlük yapılacaklar"); sunucuda yoksa görünmez
  const trainings = useTrainings();
  const behaviors = useTargetBehaviors();

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
  const all = care.suggestions.filter((s) => links.some((l) => l.linkId === s.linkId));
  const suggestions = all.filter((s) => s.kind === 'new');
  // Değişiklik önerileri: aynı rutinin değişiklikleri tek kart, diğerleri görev başına (akislar.md 12.1 adım 7)
  const changes = Object.values(all.filter((s) => s.kind === 'change').reduce<Record<string, typeof all>>((acc, s) => {
    (acc[s.routine?.group ?? s.id] ??= []).push(s);
    return acc;
  }, {}));
  // Günlük rutin paketleri (aynı routine.group) tek kart; diğerleri tek tek (akislar.md 5.4 v2)
  const packs = Object.values(suggestions.filter((s) => s.routine).reduce<Record<string, typeof suggestions>>((acc, s) => {
    (acc[s.routine!.group] ??= []).push(s);
    return acc;
  }, {}));
  const singles = suggestions.filter((s) => !s.routine);
  const goalTitle = (s: (typeof suggestions)[number]) => (s.goalId ? care.plans[s.linkId]?.goals.find((g) => g.id === s.goalId)?.title : undefined);
  const dropSuggestions = (ids: string[]) => setCare((p) => p && ({ ...p, suggestions: p.suggestions.filter((x) => !ids.includes(x.id)) }));
  const unshared = children.filter((k) => !links.some((l) => l.childId === k.id));
  const myTrainings = (trainings ?? []).filter((t) => t.mine && t.status === 'active' && links.some((l) => l.linkId === t.linkId));
  const tRows = myTrainings.flatMap((t) => [
    ...t.tasks.map((k) => ({ key: k.id, kicker: 'Uygulama görevi', title: k.title,
      go: () => navigation.navigate('TrainingTask', { trainingId: t.id, taskId: k.id }) })),
    ...t.todos.filter((d) => !d.doneAt).map((d) => ({ key: d.id, kicker: 'Tek seferlik görev', title: d.title,
      go: () => navigation.navigate('TrainingTodo', { trainingId: t.id, todoId: d.id }) })),
  ]);
  const canReport = reportable(behaviors).some((l) => l.clinicId === c.clinicId);

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
        try { await addChildToClinic(c.clinicId, childId); reload(); } catch (e) { Alert.alert('Paylaşılamadı', (e as Error).message); }
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
        syncSessionReminders();
        track('clinic.unlink', { all: links.length === 1 });
        // Son çocuk da ayrıldı: sayfa kapanır (alttaki sayfa kapanınca; iOS'ta kapanırken geri gitmek dokunuşu kilitleyebilir)
        if (links.length === 1) { setManage(false); afterModal(leave); } else reload();
      } catch (e) { Alert.alert('Ayrılamadı', (e as Error).message); } finally { setBusy(null); }
    } },
  ]);
  const remove = () => Alert.alert(`${c.name} kaldırılsın mı?`, removeText(c.name), [
    { text: 'Vazgeç', style: 'cancel' },
    { text: 'Uzmanı kaldır', style: 'destructive', onPress: async () => {
      setBusy('all');
      try {
        for (const l of links) await stopSharing(l.linkId);
        syncSessionReminders(); // paylaşım bitince randevular kalkar; hatırlatmalar da
        track('clinic.remove', { n: links.length });
        setManage(false);
        afterModal(leave);
      } catch (e) { reload(); Alert.alert('Kaldırılamadı', (e as Error).message); } finally { setBusy(null); }
    } },
  ]);

  return (
    <View style={styles.safe}>
      <SafeAreaView edges={['top']} style={[styles.hero, wide && styles.heroWide]}>
        {/* Sekmede: düğmeler üst satırda sağda (Uzman bağla + yönet), ad ve unvan alt satırda tam genişlik (telefonda kesilmesin) */}
        {tab && (
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 6 }}>
            <IconButton name="settings-outline" label="Uzmanı yönet" onPress={() => setManage(true)} color="#fff" style={styles.heroBtn} />
            <Pressable onPress={tab.onConnect} hitSlop={6} style={styles.connect} accessibilityRole="button" accessibilityLabel="Yeni uzman bağla">
              <Ionicons name="add" size={18} color={colors.navy} />
              <Text style={styles.connectText}>Uzman bağla</Text>
            </Pressable>
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: tab ? 16 : 12, paddingTop: tab ? 4 : 6, paddingBottom: 18 }}>
          {!tab && <IconButton name="chevron-back" label="Geri" onPress={() => navigation.goBack()} color="#fff" style={styles.heroBtn} />}
          <ClinicianAvatar name={c.name} size={46} light />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.heroName} numberOfLines={1}>{c.name}</Text>
            <Text style={styles.heroCap} numberOfLines={2}>{[c.title, c.clinic !== c.name ? c.clinic : ''].filter(Boolean).join(' · ') || 'Uzman'}</Text>
          </View>
          {!tab && <IconButton name="settings-outline" label="Uzmanı yönet" onPress={() => setManage(true)} color="#fff" style={styles.heroBtn} />}
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 18 }}>
        {tab?.top}
        <VerifiedBadge verifiedAs={c.verifiedAs} />

        {changes.map((g) => (
          <ChangeSuggestionCard key={g[0].routine?.group ?? g[0].id} items={g} childName={childName(g[0].childId)} onDecided={dropSuggestions} />
        ))}

        <SessionsSection links={links} childName={childName} highlight={sessionId} />

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
          {tRows.map((r, i) => (
            <Pressable key={r.key} onPress={r.go} style={[styles.row, (todos.length > 0 || i > 0) && styles.sep]} accessibilityRole="button">
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.kicker}>{r.kicker}</Text>
                <Text style={styles.rowTitle}>{r.title}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.faint} />
            </Pressable>
          ))}
          {canReport && (
            <Pressable onPress={() => navigation.navigate('Incident', { clinicId: c.clinicId })} style={[styles.row, (todos.length > 0 || tRows.length > 0) && styles.sep]} accessibilityRole="button">
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.rowTitle}>Çocuğunun davranış olayını bildir</Text>
                <Text style={styles.cap}>Uzmanının belirlediği davranışlar</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.faint} />
            </Pressable>
          )}
          <Pressable onPress={() => navigation.navigate('Abc', { new: true })} style={[styles.row, (todos.length > 0 || tRows.length > 0 || canReport) && styles.sep]} accessibilityRole="button">
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.rowTitle}>Davranış kaydı ekle</Text>
              <Text style={styles.cap}>Ne oldu, öncesinde ve sonrasında</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.faint} />
          </Pressable>
        </Section>

        <Section title="Program" info="Uzmanının her çocuk için paylaştığı davranış hedefleri ve aile programı (eğitimler). İlerlemeyi buradan takip edersin; uzmanın da görür. Bu bilgiler tanı ya da puan değildir.">
          {links.map((l, i) => {
            const p = care.plans[l.linkId];
            const active = p?.modules.filter((m) => m.status === 'active') ?? [];
            const week = active.reduce((n, m) => n + Math.min(m.practicedWeek, 7), 0);
            const pct = active.length ? Math.round((week / (active.length * 7)) * 100) : 0;
            const sub = !l.planReady ? 'Takip planı bu sürümde açık değil'
              : !p || (!p.modules.length && !p.goals.length) ? 'Uzmanın henüz plan paylaşmadı'
              : [active.length ? `${active.length} uygulama` : '', p.goals.length ? `${p.goals.length} davranış hedefi` : '', active.length ? `bu hafta %${pct}` : ''].filter(Boolean).join(' · ');
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
            <Text style={styles.section}>Macera önerileri</Text>
            {packs.map((p) => (
              <RoutinePackCard key={p[0].routine!.group} items={p} childName={childName(p[0].childId)} goal={goalTitle(p[0])} onDecided={dropSuggestions} />
            ))}
            {singles.map((s) => (
              <SuggestionCard key={s.id} s={s} childName={childName(s.childId)} goal={goalTitle(s)} onDecided={(id) => dropSuggestions([id])} />
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
  heroWide: { marginHorizontal: 20, marginTop: 12, borderRadius: 24 },
  heroName: { fontSize: 20, fontWeight: '800', color: '#fff' },
  heroCap: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  connect: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 36, paddingLeft: 8, paddingRight: 12, borderRadius: 18, backgroundColor: '#fff' },
  connectText: { fontSize: 13, fontWeight: '700', color: colors.navy },
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
