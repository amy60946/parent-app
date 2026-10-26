import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { Card, IconButton } from '../components/ui';
import { useAuth } from '../lib/auth';
import { todayISO } from '../dates';
import { track } from '../lib/track';
import { CareBarrier, CareGoal, CareLog, CareModule, carePlan, listLinks, saveLog, todayLogs } from '../lib/clinic';
import { useStore } from '../store';

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

export default function CarePlanScreen({ navigation, route }: any) {
  const { linkId } = route.params as { linkId: string; childName?: string; clinician?: string };
  const { session } = useAuth();
  const { children } = useStore();
  // Bildirimden açılınca yalnız paylaşım kimliği gelir: çocuk ve uzman adını paylaşımdan bul
  const [names, setNames] = useState({ childName: route.params.childName as string | undefined, clinician: route.params.clinician as string | undefined });
  useEffect(() => {
    if (names.childName) return;
    listLinks().then((ls) => {
      const l = ls.find((x) => x.linkId === linkId);
      if (l) setNames({ childName: children.find((c) => c.id === l.childId)?.name, clinician: l.clinician || l.clinic });
    }).catch(() => {});
  }, [linkId]); // eslint-disable-line react-hooks/exhaustive-deps
  const { childName, clinician } = names;
  const [plan, setPlan] = useState<{ goals: CareGoal[]; modules: CareModule[] } | null | undefined>();
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

  const empty = plan && !plan.goals.length && !plan.modules.length;
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <IconButton name="chevron-back" label="Geri" onPress={() => navigation.goBack()} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Takip planı</Text>
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
          {plan.modules.length > 0 && (
            <View style={{ gap: 10 }}>
              <Text style={styles.section}>Evde uygulama</Text>
              {plan.modules.map((m) => <Module key={m.id} m={m} log={logs[m.id]} onSave={save} />)}
            </View>
          )}
          {plan.goals.length > 0 && (
            <View style={{ gap: 10 }}>
              <Text style={styles.section}>Hedefler</Text>
              {plan.goals.map((g) => (
                <Card key={g.id} style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                    <Text style={[styles.h, { flex: 1 }]}>{g.title}</Text>
                    <Text style={[styles.tag, g.status === 'achieved' && { backgroundColor: colors.easy.bg, color: colors.easy.fg }]}>{goalStatus[g.status] ?? ''}</Text>
                  </View>
                  {!!g.description && <Text style={styles.body}>{g.description}</Text>}
                  {!!g.target && <Text style={styles.cap}>Hedef: {g.target}</Text>}
                  {!!g.homeSupport && <Text style={styles.body}><Text style={{ fontWeight: '700' }}>Evde: </Text>{g.homeSupport}</Text>}
                </Card>
              ))}
            </View>
          )}
          <Text style={styles.cap}>Bu bilgiler tanı ya da puan değildir. Uzmanın yalnız senin paylaştığın çocuk için görür.</Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Module({ m, log, onSave }: { m: CareModule; log?: CareLog; onSave: (l: CareLog) => void }) {
  const [open, setOpen] = useState(false);
  const active = m.status === 'active';
  return (
    <Card style={{ gap: 10 }}>
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
});
