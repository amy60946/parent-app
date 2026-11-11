import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Info from '../components/Info';
import { colors, radius } from '../theme';
import { Card, IconButton } from '../components/ui';
import { useAuth } from '../lib/auth';
import { todayISO } from '../dates';
import { track } from '../lib/track';
import { CareBarrier, CareGoal, CareLog, CareModule, CareRoutine, carePlan, listLinks, saveLog, todayLogs } from '../lib/clinic';
import { genitive } from '../lib/tr';
import { addDays, fromISO, toISO } from '../dates';
import { useStore } from '../store';
import { CARE_PLAN_FLAG } from '../lib/care';
import { useFlag } from '../clientConfig';

// Uzmanım › çocuk › Takip planı (ortak/sozlesme/akislar.md 12): uzmanın aileyle paylaştığı hedefler ve aile programı.
// Ebeveyn modülde günde bir kez "Bugün uyguladım" der; zorluk kendi bildirimidir, puan ya da ölçek değildir.
const goalStatus: Record<CareGoal['status'], string> = { active: 'Sürüyor', achieved: 'Ulaşıldı', paused: 'Ara verildi' };
const barriers: { id: CareBarrier; label: string }[] = [
  { id: 'no_time', label: 'Vakit yoktu' },
  { id: 'forgot', label: 'Unuttum' },
  { id: 'child_resisted', label: 'Çocuk istemedi' },
  { id: 'unsure', label: 'Nasıl yapacağımı bilemedim' },
];
const ease = ['Çok kolaydı', 'Kolaydı', 'Orta', 'Zorlandım', 'Çok zorlandım'];

// Bayrak kapalıyken (ortak akislar.md 12.2) bu ekrana giden yol yok; eski bir bildirim ya da bağlantıyla gelinirse kısa not.
export default function CarePlanScreen(props: any) {
  const planOn = useFlag(CARE_PLAN_FLAG);
  if (!planOn) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
        <View style={{ padding: 12 }}><IconButton name="chevron-back" label="Geri" onPress={() => props.navigation.goBack()} /></View>
        <Text style={{ padding: 24, textAlign: 'center', fontSize: 15, lineHeight: 22, color: colors.navy }}>Takip planı şu an kapalı. Uzmanının verdiği eğitim ve görevler Ben ve Uzmanım sayfalarında.</Text>
      </SafeAreaView>
    );
  }
  return <CarePlanInner {...props} />;
}

function CarePlanInner({ navigation, route }: any) {
  const { linkId } = route.params as { linkId: string; childName?: string; clinician?: string };
  const { session } = useAuth();
  const { children, completions } = useStore();
  // Bildirimden açılınca yalnız paylaşım kimliği gelir: çocuk ve uzman adını paylaşımdan bul (rutin satırı için çocuk kimliği de)
  const [names, setNames] = useState({ childName: route.params.childName as string | undefined, clinician: route.params.clinician as string | undefined, childId: undefined as string | undefined });
  useEffect(() => {
    listLinks().then((ls) => {
      const l = ls.find((x) => x.linkId === linkId);
      if (l) setNames({ childName: children.find((c) => c.id === l.childId)?.name, clinician: l.clinician || l.clinic, childId: l.childId });
    }).catch(() => {});
  }, [linkId]); // eslint-disable-line react-hooks/exhaustive-deps
  const { childName, clinician, childId } = names;
  const [plan, setPlan] = useState<{ goals: CareGoal[]; modules: CareModule[]; routines: CareRoutine[] } | null | undefined>();
  const [logs, setLogs] = useState<Record<string, CareLog>>({});
  const today = todayISO();

  const load = useCallback(async () => {
    try {
      const p = await carePlan(linkId);
      setPlan(p);
      if (p?.modules.length) {
        const l = await todayLogs(p.modules.map((m) => m.id), today);
        setLogs(Object.fromEntries(l.map((x) => [x.moduleId, x])));
      }
    } catch (e) {
      setPlan(null);
      Alert.alert('Yüklenemedi', (e as Error).message);
    }
  }, [linkId, today]);
  useEffect(() => { load(); }, [load]);

  const save = async (log: CareLog) => {
    if (!session) return;
    const prev = logs[log.moduleId];
    setLogs((p) => ({ ...p, [log.moduleId]: log }));
    try {
      await saveLog(session.user.id, today, log);
      if (!prev || prev.practiced !== log.practiced) {
        track('care.log', { practiced: log.practiced });
        setPlan((p) => p && ({ ...p, modules: p.modules.map((m) => (m.id === log.moduleId
          ? { ...m, practicedWeek: Math.max(0, m.practicedWeek + (log.practiced ? 1 : 0) - (prev?.practiced ? 1 : 0)) } : m)) }));
      }
    } catch (e) {
      setLogs((p) => { const n = { ...p }; if (prev) n[log.moduleId] = prev; else delete n[log.moduleId]; return n; });
      Alert.alert('Kaydedilemedi', (e as Error).message);
    }
  };

  const empty = plan && !plan.goals.length && !plan.modules.length && !plan.routines.length;
  // Sunucu programların hedeflerini ya da kabul edilen rutinleri döndürüyorsa gruplu görünüm; eski sunucuda bugünkü liste
  const grouped = !!plan && (plan.modules.some((m) => m.goalIds.length > 0) || plan.routines.length > 0);
  const goalIds = new Set(plan?.goals.map((g) => g.id) ?? []);
  const free = plan?.modules.filter((m) => !m.goalIds.some((id) => goalIds.has(id))) ?? [];
  const freeRts = plan?.routines.filter((r) => !r.goalId || !goalIds.has(r.goalId)) ?? [];
  // Rutinin bu haftaki onayları (son 7 gün; çocuk tarafı kayıtları)
  const weekStart = toISO(addDays(fromISO(today), -6));
  const approvedWeek = (r: CareRoutine) => Object.entries(completions).filter(([k, st]) => {
    const [taskId, cid, day] = k.split('|');
    return st === 'approved' && r.taskIds.includes(taskId) && (!childId || cid === childId) && day >= weekStart && day <= today;
  }).length;
  const openTasks = () => navigation.navigate('Tabs', { screen: 'Maceralar', params: childId ? { filter: childId, date: today } : { date: today } });
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <IconButton name="chevron-back" label="Geri" onPress={() => navigation.goBack()} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.title}>Takip planı</Text>
            <Info title="Takip planı" text={'Uzmanının seninle paylaştığı davranış hedefleri ve evde uygulama. Uyguladığın gün "Bugün uyguladım"a dokun; nasıl geçtiğini ya da engeli isteğe bağlı seç. Uzmanın bu kayıtları görür.\n\nBu bilgiler tanı ya da puan değildir. Uzmanın yalnız senin paylaştığın çocuk için görür.'} />
          </View>
          {!!(childName || clinician) && <Text style={styles.cap}>{[childName, clinician].filter(Boolean).join(' · ')}</Text>}
        </View>
      </View>
      {plan === undefined ? (
        <ActivityIndicator color={colors.navy} style={{ marginTop: 40 }} />
      ) : plan === null || empty ? (
        <View style={{ padding: 24, gap: 8 }}>
          <Text style={styles.body}>
            {plan === null ? 'Takip planı bu sürümde henüz açık değil.' : 'Uzmanın henüz seninle bir plan paylaşmadı. Paylaşınca bildirim gelir.'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 48 }}>
          {grouped ? (
            <>
              {/* Hedefe göre gruplu (akislar.md 12.1): hedef → bu haftaki program → çocuğun rutini */}
              {plan.goals.map((g) => {
                const mods = plan.modules.filter((m) => m.goalIds.includes(g.id));
                const rts = plan.routines.filter((r) => r.goalId === g.id);
                return (
                  <Card key={g.id} style={{ gap: 10 }}>
                    <GoalHead g={g} />
                    {mods.length > 0 && <Text style={styles.sub}>Bu hafta senin programın</Text>}
                    {mods.map((m) => <Module key={m.id} m={m} log={logs[m.id]} onSave={save} flat />)}
                    {rts.length > 0 && <Text style={styles.sub}>{childName ? `${genitive(childName)} rutini` : 'Çocuğunun rutini'}</Text>}
                    {rts.map((r) => <RoutineRow key={r.id} r={r} approved={approvedWeek(r)} onPress={openTasks} />)}
                  </Card>
                );
              })}
              {(free.length > 0 || freeRts.length > 0) && (
                <View style={{ gap: 10 }}>
                  <Text style={styles.section}>{plan.goals.length ? 'Davranış hedefine bağlı olmayanlar' : 'Evde uygulama'}</Text>
                  {free.map((m) => <Module key={m.id} m={m} log={logs[m.id]} onSave={save} />)}
                  {freeRts.length > 0 && (
                    <Card style={{ gap: 4 }}>
                      {freeRts.map((r) => <RoutineRow key={r.id} r={r} approved={approvedWeek(r)} onPress={openTasks} />)}
                    </Card>
                  )}
                </View>
              )}
            </>
          ) : (
            <>
              {plan.modules.length > 0 && (
                <View style={{ gap: 10 }}>
                  <Text style={styles.section}>Evde uygulama</Text>
                  {plan.modules.map((m) => <Module key={m.id} m={m} log={logs[m.id]} onSave={save} />)}
                </View>
              )}
              {plan.goals.length > 0 && (
                <View style={{ gap: 10 }}>
                  <Text style={styles.section}>Davranış hedefleri</Text>
                  {plan.goals.map((g) => <Card key={g.id} style={{ gap: 6 }}><GoalHead g={g} /></Card>)}
                </View>
              )}
            </>
          )}
          <Text style={[styles.cap, { textAlign: 'center' }]}>Bu bilgiler tanı ya da puan değildir.</Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function GoalHead({ g }: { g: CareGoal }) {
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <Text style={[styles.h, { flex: 1 }]}>{g.title}</Text>
        <Text style={[styles.tag, g.status === 'achieved' && { backgroundColor: colors.easy.bg, color: colors.easy.fg }]}>{goalStatus[g.status] ?? ''}</Text>
      </View>
      {!!g.description && <Text style={styles.body}>{g.description}</Text>}
      {!!g.target && <Text style={styles.cap}>Hedef düzey: {g.target}</Text>}
      {!!g.homeSupport && <Text style={styles.body}><Text style={{ fontWeight: '700' }}>Evde: </Text>{g.homeSupport}</Text>}
    </View>
  );
}

// Uzmanın önerip ailenin eklediği rutin (ya da tek görev): görev sayısı, bu hafta onay; dokununca çocuğun görevleri
function RoutineRow({ r, approved, onPress }: { r: CareRoutine; approved: number; onPress: () => void }) {
  const icon = r.icon && /^[a-z0-9-]+$/.test(r.icon) ? (r.icon as keyof typeof Ionicons.glyphMap) : undefined;
  return (
    <Pressable onPress={onPress} style={styles.rt} accessibilityRole="button" accessibilityLabel={`${r.title}, maceralar`}>
      <View style={styles.rtIcon}>{icon ? <Ionicons name={icon} size={16} color={colors.navy} /> : <Text style={{ fontSize: 15 }}>{r.icon ?? '•'}</Text>}</View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={styles.h}>{r.title}</Text>
        <Text style={styles.cap}>{r.single ? 'Macera' : `${r.taskIds.length} macera`} · bu hafta {approved} onay</Text>
      </View>
      <Text style={styles.cap}>Maceralar ›</Text>
    </Pressable>
  );
}

function Module({ m, log, onSave, flat }: { m: CareModule; log?: CareLog; onSave: (l: CareLog) => void; flat?: boolean }) {
  const [open, setOpen] = useState(false);
  const active = m.status === 'active';
  return (
    <Card style={flat ? { gap: 10, ...styles.flat } : { gap: 10 }}>
      <Pressable onPress={() => setOpen(!open)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} accessibilityRole="button">
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.h}>{m.title}</Text>
          <Text style={styles.cap}>{active ? `Bu hafta ${m.practicedWeek} gün uygulandı` : 'Tamamlandı'}</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.muted} />
      </Pressable>
      {open && (
        <View style={{ gap: 8 }}>
          {!!m.aim && <Text style={styles.body}><Text style={{ fontWeight: '700' }}>Amaç: </Text>{m.aim}</Text>}
          {!!m.practice && <Text style={styles.body}><Text style={{ fontWeight: '700' }}>Evde: </Text>{m.practice}</Text>}
          {m.checklist.map((c, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
              <Text style={styles.body}>•</Text>
              <Text style={[styles.body, { flex: 1 }]}>{c}</Text>
            </View>
          ))}
        </View>
      )}
      {active && (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={() => onSave({ moduleId: m.id, practiced: true, difficulty: log?.practiced ? log.difficulty : undefined })}
              style={[styles.btn, log?.practiced && styles.btnOn]} accessibilityState={{ selected: !!log?.practiced }}>
              <Ionicons name="checkmark" size={16} color={log?.practiced ? '#fff' : colors.navy} />
              <Text style={[styles.btnText, log?.practiced && { color: '#fff' }]}>Bugün uyguladım</Text>
            </Pressable>
            <Pressable onPress={() => onSave({ moduleId: m.id, practiced: false, barrier: log && !log.practiced ? log.barrier : undefined })}
              style={[styles.btn, log && !log.practiced && styles.btnMuted]} accessibilityState={{ selected: !!log && !log.practiced }}>
              <Text style={styles.btnText}>Uygulayamadım</Text>
            </Pressable>
          </View>
          {log?.practiced && (
            <View style={{ gap: 6 }}>
              <Text style={styles.cap}>Nasıl geçti? (isteğe bağlı)</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {ease.map((t, i) => (
                  <Pressable key={t} onPress={() => onSave({ ...log, difficulty: log.difficulty === i + 1 ? undefined : i + 1 })}
                    style={[styles.chip, log.difficulty === i + 1 && styles.chipOn]}>
                    <Text style={[styles.chipText, log.difficulty === i + 1 && { color: '#fff' }]}>{t}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
          {log && !log.practiced && (
            <View style={{ gap: 6 }}>
              <Text style={styles.cap}>Ne engel oldu? (isteğe bağlı)</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {barriers.map((b) => (
                  <Pressable key={b.id} onPress={() => onSave({ ...log, barrier: log.barrier === b.id ? undefined : b.id })}
                    style={[styles.chip, log.barrier === b.id && styles.chipOn]}>
                    <Text style={[styles.chipText, log.barrier === b.id && { color: '#fff' }]}>{b.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  title: { fontSize: 20, fontWeight: '800', color: colors.navy },
  h: { fontSize: 15, fontWeight: '600', color: colors.navy },
  cap: { fontSize: 12, color: colors.muted },
  body: { fontSize: 13, color: colors.navy, lineHeight: 19 },
  section: { fontSize: 13, fontWeight: '600', color: colors.muted },
  tag: { fontSize: 11, fontWeight: '700', color: colors.navy, backgroundColor: colors.today, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  btn: { flex: 1, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  btnOn: { backgroundColor: colors.easy.fg, borderColor: colors.easy.fg },
  btnMuted: { backgroundColor: '#F1F2F6' },
  btnText: { fontSize: 14, fontWeight: '700', color: colors.navy },
  chip: { paddingHorizontal: 12, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.navy },
  sub: { fontSize: 12, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 4 },
  flat: { backgroundColor: '#F7F8FB', padding: 12 },
  rt: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  rtIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF1D6', alignItems: 'center', justifyContent: 'center' },
});
