import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationBell from '../components/NotificationBell';
import Onboarding from '../components/Onboarding';
import { Avatar } from '../components/ui';
import { colors, radius } from '../theme';
import { useStore, taskOccursOn } from '../store';
import { useParentTasks, doneKey } from '../parentTasks';
import { useAuth } from '../lib/auth';
import { useCare } from '../lib/care';
import { intakeStatus } from '../lib/intake';
import TrialBanner from '../components/TrialBanner';
import { todayISO } from '../dates';

// Ben (ana sayfa; kullanıcı isteği 28 Ekim 2026, Joon "Me" örneğinden): onay bekleyenler (İnceleme), 30 günlük misafir kartı,
// senin görevlerin (uzmanın programı, öneriler, sana atanan görevler, gözlem notu), programına devam et, bugünün ilerlemesi.
// Her satır ilgili ekranı açar. Misafir kartı kapatılınca sağ üstte hediye simgesi olarak kalır.
const GUEST_HIDDEN = 'guest-pass-hidden';
const DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

type Row = { key: string; icon: keyof typeof Ionicons.glyphMap; title: string; sub?: string; tint?: string; onPress: () => void };

export default function MeScreen({ navigation }: any) {
  const { parent, children, tasks, completions, familyId } = useStore();
  const pt = useParentTasks();
  const { session } = useAuth();
  const { care } = useCare(familyId);
  const today = todayISO();
  const [guestHidden, setGuestHidden] = useState<boolean | null>(null);
  const [intakeMissing, setIntakeMissing] = useState(false);
  const [guide, setGuide] = useState(false);

  useEffect(() => { AsyncStorage.getItem(GUEST_HIDDEN).then((v) => setGuestHidden(v === '1')).catch(() => setGuestHidden(false)); }, []);
  // Tanışma soruları atlandıysa (uzman davetiyle gelen aile) burada tamamlanır
  useFocusEffect(useCallback(() => {
    if (!session) return;
    intakeStatus(session.user.id).then((st) => setIntakeMissing(!st.family)).catch(() => {});
  }, [session]));
  const hideGuest = () => { setGuestHidden(true); AsyncStorage.setItem(GUEST_HIDDEN, '1').catch(() => {}); };

  const pending = Object.values(completions).filter((s) => s === 'pending').length;
  const childName = (id: string) => children.find((c) => c.id === id)?.name ?? '';

  // Bugünün ilerlemesi: ebeveyn (kendine atananlar) + her çocuk; çocukta "Yaptım" denmiş (onay bekleyen dahil) sayılır
  const progress = useMemo(() => {
    const todays = tasks.filter((t) => taskOccursOn(t, today));
    const rows: { id: string; name: string; avatar: string; done: number; total: number }[] = [];
    if (pt.ready && pt.me) {
      const mine = todays.filter((t) => (pt.assigns[t.id] ?? []).some((a) => a.userId === pt.me));
      rows.push({ id: 'me', name: 'Sen', avatar: parent.avatar, total: mine.length,
        done: mine.filter((t) => pt.done[doneKey(t.id, pt.me!, today)]).length });
    }
    for (const c of children) {
      const theirs = todays.filter((t) => t.assignments.some((a) => a.childId === c.id));
      const st = (t: (typeof theirs)[number]) => completions[`${t.id}|${c.id}|${today}`];
      rows.push({ id: c.id, name: c.name, avatar: c.avatar, total: theirs.length,
        done: theirs.filter((t) => st(t) === 'approved' || st(t) === 'pending').length });
    }
    return rows;
  }, [tasks, children, completions, pt.ready, pt.me, pt.assigns, pt.done, parent.avatar, today]);
  const myOpen = progress.find((r) => r.id === 'me');

  const todo: Row[] = [];
  for (const inv of care?.invites ?? []) {
    todo.push({ key: `inv-${inv.code}`, icon: 'mail-unread-outline', tint: '#FFF4D6', title: `${inv.clinician || inv.clinic} seni bekliyor`,
      sub: inv.childName ? `${inv.childName} için bilgileri kontrol et ve paylaş` : 'Daveti kontrol et ve paylaş', onPress: () => navigation.navigate('Invite', { invite: inv }) });
  }
  // Uzmanın programındaki bugünkü uygulamalar tek satır (ayrıntısı aşağıda "Programına devam et" ve uzman sayfasında)
  const openToday = (care?.todos ?? []).filter((x) => !x.doneToday);
  if (openToday.length) {
    const clinics = [...new Set(openToday.map((t) => care!.links.find((l) => l.linkId === t.linkId)?.clinicId).filter(Boolean))] as string[];
    const who = [...new Set(openToday.map((t) => t.clinician))].join(', ');
    todo.push({ key: 'mods', icon: 'medkit-outline', title: `Bugün ${openToday.length} uygulama seni bekliyor`, sub: `${who} · uyguladıysan işaretle`,
      onPress: () => (clinics.length === 1 ? navigation.navigate('Clinician', { clinicId: clinics[0] }) : navigation.navigate('Uzmanım')) });
  }
  if (care?.suggestions.length) {
    todo.push({ key: 'sug', icon: 'sparkles-outline', title: `Uzmanından ${care.suggestions.length} görev önerisi`, sub: 'Kabul edersen görevlere eklenir',
      onPress: () => navigation.navigate('Uzmanım') });
  }
  if (myOpen && myOpen.total > myOpen.done) {
    todo.push({ key: 'mine', icon: 'person-outline', title: `Bugün sana ${myOpen.total - myOpen.done} görev`, sub: 'Yapınca "Yaptım" de, Güneş Taşı kazan',
      onPress: () => navigation.navigate('Görevler', { filter: 'me', date: today }) });
  }
  if (intakeMissing) {
    todo.push({ key: 'intake', icon: 'clipboard-outline', title: 'Tanışma sorularını tamamla', sub: 'Yaklaşık 3 dakika; öneriler ailene göre kişiselleşir',
      onPress: () => navigation.navigate('Intake') });
  }
  // Uzmanı olan aile: gözlem notu uzmanın istediği bir görevdir (uzman görür)
  if (care?.links.length) {
    todo.push({ key: 'abc', icon: 'pulse-outline', title: 'Gözlem notu ekle', sub: 'Zor bir an mı oldu? Kısaca yaz; uzmanın görür',
      onPress: () => navigation.navigate('Abc', { new: true }) });
  }
  if (!todo.length) {
    todo.push({ key: 'self', icon: 'add-outline', title: 'Kendine de görev ver', sub: 'Örnek ol, yaptıkça Güneş Taşı kazan',
      onPress: () => navigation.navigate('CreateTask', { date: today }) });
  }

  const d = new Date();
  const hello = parent.nickname && parent.nickname !== 'Ben' ? `Merhaba, ${parent.nickname}!` : 'Merhaba!';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello} accessibilityRole="header">{hello}</Text>
            <Text style={styles.cap}>{d.getDate()} {MONTHS[d.getMonth()]}, {DAYS[d.getDay()]}</Text>
          </View>
          {guestHidden && (
            <Pressable onPress={() => navigation.navigate('GuestPass')} hitSlop={8} style={styles.gift} accessibilityRole="button" accessibilityLabel="30 gün hediye kartı">
              <Ionicons name="gift-outline" size={20} color={colors.navy} />
            </Pressable>
          )}
          <NotificationBell />
        </View>

        <TrialBanner style={{ marginHorizontal: 0, marginTop: 0, marginBottom: 0 }} />

        {/* Onay bekleyenler → İnceleme */}
        <Pressable onPress={() => navigation.navigate('Review')} style={styles.catch} accessibilityRole="button">
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.catchLabel}>Onay bekleyen</Text>
            <Text style={styles.catchTitle}>{pending ? `${pending} görev onayını bekliyor` : 'Onay bekleyen görev yok'}</Text>
          </View>
          <View style={styles.catchGo}><Ionicons name="chevron-forward" size={20} color={colors.navy} /></View>
        </Pressable>

        {guestHidden === false && (
          <View style={styles.guest}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.h, { flex: 1 }]}>30 gün ücretsiz: bir aileye hediye et</Text>
              <Pressable onPress={hideGuest} hitSlop={10} accessibilityRole="button" accessibilityLabel="Kapat">
                <Ionicons name="close" size={20} color={colors.navy} />
              </Pressable>
            </View>
            <Text style={styles.text}>Rutinlerle uğraşan bir ebeveyn tanıyorsan ParentApp'i 30 gün tam erişimle denemesini sağla.</Text>
            <Pressable onPress={() => navigation.navigate('GuestPass')} style={styles.guestBtn} accessibilityRole="button">
              <Text style={styles.guestBtnText}>Hediye kartını paylaş</Text>
            </Pressable>
          </View>
        )}

        <Section title="Senin görevlerin">
          {todo.map((r, i) => (
            <Pressable key={r.key} onPress={r.onPress} style={[styles.row, i > 0 && styles.sep]} accessibilityRole="button">
              <View style={[styles.rowIcon, r.tint ? { backgroundColor: r.tint } : null]}><Ionicons name={r.icon} size={18} color={colors.navy} /></View>
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={2}>{r.title}</Text>
                {!!r.sub && <Text style={styles.cap} numberOfLines={2}>{r.sub}</Text>}
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.faint} />
            </Pressable>
          ))}
        </Section>

        <Section title="Programına devam et">
          {care?.todos.length ? care.todos.map((t, i) => (
            <Pressable key={t.module.id} onPress={() => navigation.navigate('CarePlan', { linkId: t.linkId, childName: childName(t.childId), clinician: t.clinician })}
              style={[styles.row, i > 0 && styles.sep]} accessibilityRole="button">
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={styles.rowTitle} numberOfLines={2}>{t.module.title}</Text>
                <View style={styles.bar}><View style={[styles.barFill, { width: `${Math.round((Math.min(t.module.practicedWeek, 7) / 7) * 100)}%` }]} /></View>
                <Text style={styles.cap}>{t.clinician} · {childName(t.childId)} · bu hafta {Math.min(t.module.practicedWeek, 7)}/7 gün</Text>
              </View>
              {t.doneToday ? <Ionicons name="checkmark-circle" size={22} color={colors.easy.fg} /> : <Ionicons name="chevron-forward" size={16} color={colors.faint} />}
            </Pressable>
          )) : (
            <Pressable onPress={() => setGuide(true)} style={styles.row} accessibilityRole="button">
              <View style={styles.rowIcon}><Ionicons name="compass-outline" size={18} color={colors.navy} /></View>
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={styles.rowTitle}>ParentApp'i tanı</Text>
                <Text style={styles.cap}>6 adımlık kısa rehber · uzmanın program verince burada görünür</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.faint} />
            </Pressable>
          )}
        </Section>

        <Section title="Bugünün ilerlemesi">
          {progress.map((r, i) => {
            const pct = r.total ? Math.round((r.done / r.total) * 100) : 0;
            return (
              <Pressable key={r.id} onPress={() => (r.total ? navigation.navigate('Görevler', { filter: r.id, date: today }) : navigation.navigate('CreateTask', { date: today }))}
                style={[styles.row, i > 0 && styles.sep]} accessibilityRole="button" accessibilityLabel={`${r.name}: ${r.total ? `yüzde ${pct}` : 'bugün görev yok'}`}>
                <Avatar id={r.avatar} size={34} />
                <View style={{ flex: 1, gap: 5 }}>
                  <Text style={styles.rowTitle}>{r.name}</Text>
                  {r.total > 0 && <View style={styles.bar}><View style={[styles.barFill, { width: `${pct}%` }]} /></View>}
                </View>
                {r.total ? <Text style={styles.pct}>%{pct}</Text> : <View style={styles.setUp}><Text style={styles.setUpText}>Görev ekle</Text></View>}
              </Pressable>
            );
          })}
        </Section>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {([['add-circle-outline', 'Görev ver', () => navigation.navigate('CreateTask', { date: today })],
            ['gift-outline', 'Ödül', () => navigation.navigate('Rewards')],
            ['pulse-outline', 'Gözlem notu', () => navigation.navigate('Abc', { new: true })]] as const).map(([icon, label, go]) => (
            <Pressable key={label} onPress={go} style={styles.quick} accessibilityRole="button">
              <Ionicons name={icon} size={18} color={colors.navy} />
              <Text style={styles.quickText}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <Onboarding visible={guide} onClose={() => setGuide(false)} />
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.section}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  hello: { fontSize: 26, fontWeight: '800', color: colors.navy },
  cap: { fontSize: 12, lineHeight: 16, color: colors.muted },
  text: { fontSize: 14, lineHeight: 20, color: '#4A5165' },
  h: { fontSize: 16, fontWeight: '800', color: colors.navy },
  section: { fontSize: 16, fontWeight: '800', color: colors.navy },
  gift: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF4D6', alignItems: 'center', justifyContent: 'center' },
  catch: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#DDF1EC', borderRadius: radius.lg, padding: 18 },
  catchLabel: { fontSize: 12, fontWeight: '700', color: '#2F6B5E' },
  catchTitle: { fontSize: 18, fontWeight: '800', color: colors.navy },
  catchGo: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' },
  guest: { backgroundColor: '#FFF4D6', borderRadius: radius.lg, padding: 16, gap: 10 },
  guestBtn: { height: 46, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  guestBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: radius.md, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  rowIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.today, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.navy },
  bar: { height: 6, borderRadius: 3, backgroundColor: '#EEF0F5', overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: '#3FA98D' },
  pct: { fontSize: 15, fontWeight: '800', color: colors.navy, minWidth: 44, textAlign: 'right' },
  setUp: { borderWidth: 1, borderColor: colors.navy, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5 },
  setUpText: { fontSize: 13, fontWeight: '700', color: colors.navy },
  quick: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: radius.md, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line },
  quickText: { fontSize: 13, fontWeight: '700', color: colors.navy },
});
