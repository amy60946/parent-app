import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationBell from '../components/NotificationBell';
import FirstSteps from '../components/FirstSteps';
import Onboarding from '../components/Onboarding';
import Info from '../components/Info';
import { COLUMN, WIDE_COLUMN } from '../components/Column';
import { Avatar } from '../components/ui';
import { colors, radius } from '../theme';
import { useStore, taskOccursOn } from '../store';
import { useParentTasks, doneKey } from '../parentTasks';
import { useAuth } from '../lib/auth';
import { useCare } from '../lib/care';
import { intakeStatus } from '../lib/intake';
import { countSuggestions } from '../lib/clinic';
import TrialBanner from '../components/TrialBanner';
import { todayISO } from '../dates';

// Ben (ana sayfa; kullanıcı isteği 28 Ekim 2026, Joon "Me" örneğinden): onay bekleyenler (İnceleme), aile davet et kartı (3 Kasım 2026),
// seni bekleyenler (uzman davetleri, önerileri, uygulamalar, tanışma soruları; boşsa yok), programına devam et (program varsa),
// bugünün ilerlemesi, hızlı düğmeler, en altta "ParentApp'i tanı". Sekmede adı yok, yalnız ev simgesi (3 Kasım 2026).
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
  const wide = Math.min(useWindowDimensions().width, WIDE_COLUMN) >= 900;
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
      rows.push({ id: 'me', name: 'Ben', avatar: parent.avatar, total: mine.length, // "Ben": Görevler'deki süzgeçle aynı (kullanıcı kararı 3 Kasım 2026)
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
    todo.push({ key: 'mods', icon: 'briefcase-outline', title: `Bugün ${openToday.length} uygulama seni bekliyor`, sub: `${who} · uyguladıysan işaretle`,
      onPress: () => navigation.navigate('Uzmanım', clinics.length === 1 ? { clinicId: clinics[0] } : undefined) });
  }
  // Uzmanın önerileri: yeni görev/rutin ve ekli görevlerde değişiklik (akislar.md 12.1); Uzmanım sekmesi o uzmanla açılır
  const openSug = (kind: 'new' | 'change') => {
    const list = (care?.suggestions ?? []).filter((x) => x.kind === kind);
    const clinic = [...new Set(list.map((x) => care!.links.find((l) => l.linkId === x.linkId)?.clinicId).filter(Boolean))] as string[];
    navigation.navigate('Uzmanım', clinic.length === 1 ? { clinicId: clinic[0] } : undefined);
  };
  const { tasks: newSug, changes: changeSug } = countSuggestions(care?.suggestions ?? []); // Görevler'deki bantla aynı sayım
  if (changeSug) {
    todo.push({ key: 'chg', icon: 'swap-horizontal', tint: '#FFF4D6', title: `Uzmanından ${changeSug} değişiklik önerisi`, sub: 'Saat ya da gün değişikliği; uygula ya da şimdilik değil',
      onPress: () => openSug('change') });
  }
  if (newSug) {
    todo.push({ key: 'sug', icon: 'sparkles-outline', title: `Uzmanından ${newSug} macera önerisi`, sub: 'Kabul edersen Maceralar\'a eklenir',
      onPress: () => openSug('new') });
  }
  if (intakeMissing) {
    todo.push({ key: 'intake', icon: 'clipboard-outline', title: 'Tanışma sorularını tamamla', sub: 'Yaklaşık 3 dakika; öneriler ailene göre kişiselleşir',
      onPress: () => navigation.navigate('Intake') });
  }

  const d = new Date();
  const hello = parent.nickname && parent.nickname !== 'Ben' ? `Merhaba, ${parent.nickname}!` : 'Merhaba!';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 18, width: '100%', maxWidth: wide ? undefined : COLUMN, alignSelf: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello} accessibilityRole="header">{hello}</Text>
            <Text style={styles.cap}>{d.getDate()} {MONTHS[d.getMonth()]}, {DAYS[d.getDay()]}</Text>
          </View>
          {guestHidden && (
            <Pressable onPress={() => navigation.navigate('GuestPass')} hitSlop={8} style={styles.gift} accessibilityRole="button" accessibilityLabel="Aile davet et">
              <Ionicons name="gift-outline" size={20} color={colors.navy} />
            </Pressable>
          )}
          <NotificationBell />
        </View>

        <TrialBanner style={{ marginHorizontal: 0, marginTop: 0, marginBottom: 0 }} />

        {/* Geniş ekranda (yatay iPad) iki sütun: solda yapılacaklar, sağda program ve ilerleme. Dar ekranda aynı sıra alt alta. */}
        <View style={wide ? styles.cols : styles.stack}>
        <View style={wide ? styles.col : styles.stack}>
        {/* Yeni hesapta: İlk adımlar (çocuk ekle → oyuna bağla → görev → onay → ödül; uzman isteğe bağlı) */}
        <FirstSteps navigation={navigation} hasClinician={!!care?.links.length} />

        {/* Onay bekleyenler → İnceleme */}
        {/* Bekleyen yoksa sade (beyaz/gri), bekleyen varsa yeşil (kullanıcı isteği 3 Kasım 2026) */}
        <Pressable onPress={() => navigation.navigate('Review')} style={[styles.catch, !pending && styles.catchIdle]} accessibilityRole="button">
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.catchLabel, !pending && { color: colors.muted }]}>Onay bekleyen</Text>
            <Text style={[styles.catchTitle, !pending && styles.catchTitleIdle]}>{pending ? `${pending} macera onayını bekliyor` : 'Onay bekleyen macera yok'}</Text>
          </View>
          <View style={[styles.catchGo, !pending && { backgroundColor: '#F1F2F6' }]}><Ionicons name="chevron-forward" size={20} color={pending ? colors.navy : colors.muted} /></View>
        </Pressable>

        {guestHidden === false && (
          <View style={styles.guest}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.h, { flex: 1 }]}>Aile davet et: onlara +1 hafta, sana 1 ay</Text>
              <Pressable onPress={hideGuest} hitSlop={10} accessibilityRole="button" accessibilityLabel="Kapat">
                <Ionicons name="close" size={20} color={colors.navy} />
              </Pressable>
            </View>
            <Text style={styles.text}>Davet ettiğin aile 14 gün ücretsiz dener. Abone olurlarsa sen 1 ay ücretsiz kazanırsın.</Text>
            <Pressable onPress={() => navigation.navigate('GuestPass')} style={styles.guestBtn} accessibilityRole="button">
              <Text style={styles.guestBtnText}>Davet kodunu paylaş</Text>
            </Pressable>
          </View>
        )}

        {/* Seni bekleyenler (eski "Senin görevlerin"; kullanıcı isteği 3 Kasım 2026): yalnız uzman davetleri, önerileri, uygulamalar ve
            tanışma soruları. Sana atanan görevler ve "Kendine de görev ver" Bugünün ilerlemesi › Kendim satırında; boşsa bölüm görünmez. */}
        {todo.length > 0 && <Section title="Seni bekleyenler">
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
        </Section>}

        </View>
        <View style={wide ? styles.col : styles.stack}>
        {/* Uzmanın programı varsa (kullanıcı isteği 3 Kasım 2026: program yokken başlık görünmez; rehber satırı en altta) */}
        {!!care?.todos.length && <Section title="Programına devam et">
          {care.todos.map((t, i) => (
            <Pressable key={t.module.id} onPress={() => navigation.navigate('CarePlan', { linkId: t.linkId, childName: childName(t.childId), clinician: t.clinician })}
              style={[styles.row, i > 0 && styles.sep]} accessibilityRole="button">
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={styles.rowTitle} numberOfLines={2}>{t.module.title}</Text>
                <View style={styles.bar}><View style={[styles.barFill, { width: `${Math.round((Math.min(t.module.practicedWeek, 7) / 7) * 100)}%` }]} /></View>
                <Text style={styles.cap}>{t.clinician} · {childName(t.childId)} · bu hafta {Math.min(t.module.practicedWeek, 7)}/7 gün</Text>
              </View>
              {t.doneToday ? <Ionicons name="checkmark-circle" size={22} color={colors.easy.fg} /> : <Ionicons name="chevron-forward" size={16} color={colors.faint} />}
            </Pressable>
          ))}
        </Section>}

        <Section title="Bugünün ilerlemesi">
          {progress.map((r, i) => {
            const pct = r.total ? Math.round((r.done / r.total) * 100) : 0;
            return (
              <Pressable key={r.id} onPress={() => (r.total ? navigation.navigate('Maceralar', { filter: r.id, date: today }) : navigation.navigate('CreateTask', { date: today }))}
                style={[styles.row, i > 0 && styles.sep]} accessibilityRole="button" accessibilityLabel={`${r.name}: ${r.total ? `yüzde ${pct}` : 'bugün macera yok'}`}>
                <Avatar id={r.avatar} size={34} />
                <View style={{ flex: 1, gap: 5 }}>
                  {r.id === 'me' ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.rowTitle}>{r.name}</Text>
                      <Info title="Sen de katıl" text={'Çocuğunla birlikte yaptığınız maceralara kendini de ekle (ör. ailecek piknik): macerayı aç › Ebeveynler › kendini seç.\n\nYaptıkça Güneş Taşı kazanırsın › Güneş Taşlarınla çocuğuna oyunda hediye gönderirsin (Aile › Ben › Güneş Taşım).'} />
                    </View>
                  ) : <Text style={styles.rowTitle}>{r.name}</Text>}
                  {r.total > 0 && <View style={styles.bar}><View style={[styles.barFill, { width: `${pct}%` }]} /></View>}
                </View>
                {r.total ? <Text style={styles.pct}>%{pct}</Text> : <View style={styles.setUp}><Text style={styles.setUpText}>Macera ekle</Text></View>}
              </Pressable>
            );
          })}
        </Section>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {([['add-circle-outline', 'Macera ekle', () => navigation.navigate('CreateTask', { date: today })],
            ['gift-outline', 'Ödül', () => navigation.navigate('Rewards')],
            ['document-text-outline', 'Davranış kaydı', () => navigation.navigate('Abc', { new: true })]] as const).map(([icon, label, go]) => (
            <Pressable key={label} onPress={go} style={styles.quick} accessibilityRole="button">
              <Ionicons name={icon} size={18} color={colors.navy} />
              <Text style={styles.quickText} numberOfLines={1}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Rehber: sayfanın en altında, başlıksız tek satır */}
        <Pressable onPress={() => setGuide(true)} style={[styles.card, styles.row]} accessibilityRole="button">
          <View style={styles.rowIcon}><Ionicons name="compass-outline" size={18} color={colors.navy} /></View>
          <View style={{ flex: 1, gap: 1 }}>
            <Text style={styles.rowTitle}>ParentApp'i tanı</Text>
            <Text style={styles.cap}>Adım adım rehber · 1 dakika</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.faint} />
        </Pressable>
        </View>
        </View>
      </ScrollView>
      <Onboarding visible={guide} mode="full" onClose={() => setGuide(false)} />
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
  cols: { flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
  col: { flex: 1, gap: 18 },
  stack: { gap: 18 },
  hello: { fontSize: 26, fontWeight: '800', color: colors.navy },
  cap: { fontSize: 12, lineHeight: 16, color: colors.muted },
  text: { fontSize: 14, lineHeight: 20, color: '#4A5165' },
  h: { fontSize: 16, fontWeight: '800', color: colors.navy },
  section: { fontSize: 16, fontWeight: '800', color: colors.navy },
  gift: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF4D6', alignItems: 'center', justifyContent: 'center' },
  catch: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#DDF1EC', borderRadius: radius.lg, padding: 18 },
  catchLabel: { fontSize: 12, fontWeight: '700', color: '#2F6B5E' },
  catchTitle: { fontSize: 18, fontWeight: '800', color: colors.navy },
  catchIdle: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line },
  catchTitleIdle: { fontSize: 17, fontWeight: '700', color: '#3D4559' },
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
  quick: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, height: 60, borderRadius: radius.md, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line },
  quickText: { fontSize: 13, fontWeight: '700', color: colors.navy },
});
