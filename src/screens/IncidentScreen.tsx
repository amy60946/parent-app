import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { IconButton } from '../components/ui';
import DateField from '../components/DateField';
import { Bar, Field, Footer, Radio, Scale, s as p } from '../components/TrainingParts';
import { RESPONSES, incidentError, reportIncident, reportable, useTargetBehaviors } from '../lib/incidents';
import { fromISO, todayISO } from '../dates';
import { track } from '../lib/track';

// Davranış olayı bildir (ortak akislar.md 24 adım 2; rakibin aile uygulamasına sadık, ClinicApp behaviors/IncidentPreview.tsx ile aynı):
// 1 "Hangi davranış oldu?" (uzmanın hedef davranışları + Hiçbiri) → 2 kayıt türüne göre ayrıntı (sıklık: tarih + kaç kez; ABC: tarih +
// önce + sonra; süre: tarih + ne kadar; Hiçbiri: ne oldu + hepsi) → 3 "Hangi stratejiyi denedin?" + çocuğun tepkisi (1 Kötü … 5 Çok iyi;
// ebeveynin gözlemi, puan değil) → Gönder (family_incident_report) → teşekkür. Mevcut "Davranış kaydı" (Abc) ile birleştirilmedi.
// Birden çok çocuk uzmanla paylaşılmışsa 1. adımın üstünde çocuk seçilir. `clinicId` verilirse yalnız o uzmanın paylaşımları.
type Step = 'pick' | 'details' | 'strategy' | 'thanks';
const NONE = '__none__';
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export default function IncidentScreen({ navigation, route }: any) {
  const all = useTargetBehaviors();
  const links = useMemo(() => reportable(all).filter((l) => !route.params?.clinicId || l.clinicId === route.params.clinicId), [all, route.params?.clinicId]);
  const [linkId, setLinkId] = useState<string | null>(route.params?.linkId ?? null);
  const link = links.find((l) => l.linkId === linkId) ?? (links.length === 1 ? links[0] : undefined);
  useEffect(() => { if (!linkId && links.length === 1) setLinkId(links[0].linkId); }, [links, linkId]);

  const [step, setStep] = useState<Step>('pick');
  const [pick, setPick] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState(hhmm(new Date()));
  const [f, setF] = useState({ name: '', count: '', minutes: '', before: '', after: '', tried: '' });
  const [strategy, setStrategy] = useState<string | null>(null);
  const [response, setResponse] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const reset = () => {
    setPick(null); setDate(todayISO()); setTime(hhmm(new Date())); setF({ name: '', count: '', minutes: '', before: '', after: '', tried: '' });
    setStrategy(null); setResponse(null); setStep('pick');
  };
  const close = () => navigation.goBack();
  const home = () => navigation.navigate('Tabs', { screen: 'Ben' });

  const b = link?.behaviors.find((x) => x.id === pick);
  const other = pick === NONE;
  const at = (() => { const d = fromISO(date); const [h, m] = time.split(':').map(Number); d.setHours(h || 0, m || 0, 0, 0); return d; })();
  const dateErr = at.getTime() > Date.now() + 5 * 60e3 ? 'Olay zamanı ileri olamaz.'
    : at.getTime() < Date.now() - 30 * 864e5 ? 'En çok 30 gün öncesinin olayı bildirilebilir.' : '';
  // Sunucudaki kurallar (family_incident_report): sıklıkta sayı ≥ 1, ABC'de önce + sonra, sürede dakika, diğer olayda davranışın adı
  const detailsOk = !dateErr && (other ? !!f.name.trim()
    : b?.logType === 'frequency' ? Number(f.count) >= 1
    : b?.logType === 'abc' ? !!f.before.trim() && !!f.after.trim()
    : b?.logType === 'duration' ? f.minutes !== '' && Number(f.minutes) <= 1440 : false);
  const strategyOk = (other || strategy !== null) && response !== null;

  const send = async () => {
    if (!link) return;
    setBusy(true);
    try {
      const num = (v: string) => (v === '' ? undefined : Number(v));
      await reportIncident(other ? {
        linkId: link.linkId, occurredAt: at.toISOString(), otherBehavior: f.name.trim(), count: num(f.count), durationMin: num(f.minutes),
        antecedent: f.before.trim(), consequence: f.after.trim(), strategy: f.tried.trim(), response: response ?? undefined,
      } : {
        linkId: link.linkId, behaviorId: b!.id, occurredAt: at.toISOString(),
        count: b!.logType === 'frequency' ? num(f.count) : undefined, durationMin: b!.logType === 'duration' ? num(f.minutes) : undefined,
        antecedent: b!.logType === 'abc' ? f.before.trim() : '', consequence: b!.logType === 'abc' ? f.after.trim() : '',
        strategy: strategy && strategy !== NONE ? strategy : '', response: response ?? undefined,
      });
      track('incident.report', { type: other ? 'other' : b!.logType, strategy: other ? !!f.tried.trim() : strategy !== NONE });
      setStep('thanks');
    } catch (e) { Alert.alert('Gönderilemedi', incidentError(e)); } finally { setBusy(false); }
  };

  if (all === undefined) {
    return <SafeAreaView style={styles.safe}><ActivityIndicator color={colors.navy} style={{ marginTop: 60 }} /></SafeAreaView>;
  }
  if (!links.length) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.top}><View style={{ flex: 1 }} /><IconButton name="close" label="Kapat" onPress={close} /></View>
        <Text style={[p.p, { textAlign: 'center', padding: 24 }]}>Uzmanın henüz bildirilecek bir davranış eklemedi.</Text>
      </SafeAreaView>
    );
  }

  if (step === 'thanks') {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 12, flexGrow: 1, justifyContent: 'center' }}>
          <View style={p.intro}>
            <Ionicons name="checkmark-circle-outline" size={36} color={colors.easy.fg} />
            <Text style={[p.h, { textAlign: 'center' }]}>Bu olayı kaydettiğin için teşekkürler</Text>
            <Text style={[p.p, { textAlign: 'center' }]}>Düzenli kayıt, uzmanının davranışın ne zaman ve neden olduğunu görmesine ve birlikte en işe yarayan stratejiyi bulmanıza yardım eder.</Text>
          </View>
          <Pressable onPress={reset} style={styles.primary} accessibilityRole="button"><Text style={styles.primaryText}>Başka bir olay bildir</Text></Pressable>
          <Pressable onPress={home} style={styles.ghost} accessibilityRole="button"><Text style={styles.ghostText}>Ana sayfaya dön</Text></Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const n = step === 'pick' ? 1 : step === 'details' ? 2 : 3;
  let content: React.ReactNode = null;
  let footer: React.ReactNode = null;
  if (step === 'pick') {
    content = (
      <>
        {links.length > 1 && (
          <View style={{ gap: 8 }}>
            <Text style={p.label}>Hangi çocuğun?</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {links.map((l) => {
                const on = link?.linkId === l.linkId;
                return (
                  <Pressable key={l.linkId} onPress={() => { setLinkId(l.linkId); setPick(null); }} style={[styles.chip, on && styles.chipOn]}
                    accessibilityRole="radio" accessibilityState={{ selected: on }}>
                    <Text style={[styles.chipText, on && { color: '#fff' }]}>{l.childName || 'Çocuk'}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
        {link && (
          <>
            <Text style={p.h}>Hangi davranış oldu?</Text>
            {[...link.behaviors.map((x) => ({ id: x.id, title: x.title })), { id: NONE, title: 'Hiçbiri' }].map((o) => (
              <Radio key={o.id} label={o.title} on={pick === o.id} onPress={() => { setPick(o.id); setStrategy(null); }} />
            ))}
          </>
        )}
      </>
    );
    footer = <Footer back="Vazgeç" onBack={close} next="İleri" disabled={!link || !pick} onNext={() => setStep('details')} />;
  } else if (step === 'details') {
    const when = (
      <View style={{ gap: 6 }}>
        <Text style={p.label}>Olay tarihi</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 3 }}><DateField mode="date" value={date} onChange={(v) => v && setDate(v)} placeholder="Gün seç" maximumDate={new Date()} /></View>
          <View style={{ flex: 2 }}><DateField mode="time" value={time} onChange={(v) => v && setTime(v)} placeholder="Saat" /></View>
        </View>
        {!!dateErr && <Text style={[p.tiny, { color: colors.danger }]}>{dateErr}</Text>}
      </View>
    );
    const before = <Field label="Bu olaydan önce ne oldu?" value={f.before} onChange={set('before')} placeholder="ör. Televizyonu kapatması istendi" multiline max={500} />;
    const after = <Field label="Bu olaydan sonra ne oldu?" value={f.after} onChange={set('after')} placeholder="ör. Bağırdı, bir ayrıcalık kaldırıldı" multiline max={500} />;
    const minutes = <Field label="Ne kadar sürdü? (dakika)" value={f.minutes} onChange={set('minutes')} placeholder="0" numeric />;
    const count = <Field label="Kaç kez oldu?" value={f.count} onChange={set('count')} placeholder="0" numeric />;
    content = (
      <>
        <Text style={p.tiny}>{other ? 'Diğer olay' : b?.title}</Text>
        {other ? (
          <>
            <Field label="Ne oldu?" value={f.name} onChange={set('name')} placeholder="Davranışın adı" max={120} />
            {when}{before}{after}{minutes}{count}
          </>
        ) : b?.logType === 'frequency' ? <>{when}{count}</>
          : b?.logType === 'abc' ? <>{when}{before}{after}</>
          : <>{when}{minutes}</>}
      </>
    );
    footer = <Footer back="Geri" onBack={() => setStep('pick')} next="İleri" disabled={!detailsOk} onNext={() => setStep('strategy')} />;
  } else {
    content = (
      <>
        <Text style={p.h}>Hangi stratejiyi denedin?</Text>
        {other ? (
          <Field label="Ne denedin?" value={f.tried} onChange={set('tried')} placeholder="ör. Sakin bir köşeye geçtik" multiline max={200} />
        ) : (
          [...(b?.strategies ?? []), NONE].map((x, i) => (
            <Radio key={`${i}:${x}`} label={x === NONE ? 'Hiçbiri' : x} on={strategy === x} onPress={() => setStrategy(x)} />
          ))
        )}
        <Text style={[p.h, { marginTop: 10 }]}>Çocuğun bu uygulamaya ne kadar iyi tepki verdi?</Text>
        <Scale value={response} onChange={setResponse} low="Kötü" high="Çok iyi" labels={RESPONSES.map((r) => r.label)} />
      </>
    );
    footer = <Footer back="Geri" onBack={() => setStep('details')} next="Gönder" disabled={!strategyOk} busy={busy} onNext={send} />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[p.h, { flexShrink: 1 }]} accessibilityRole="header">Davranış olayı bildir</Text>
          <View style={{ flexGrow: 1 }} />
          <Text style={[p.tiny, { flexShrink: 0 }]}>{n} / 3</Text>
          <IconButton name="close" label="Kapat" onPress={close} />
        </View>
        <Bar pct={(n / 3) * 100} tone={colors.navy} />
        {!!link?.childName && <Text style={p.tiny}>{link.childName}</Text>}
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 12, flexGrow: 1 }} keyboardShouldPersistTaps="handled">{content}</ScrollView>
        {footer}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#fff' },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { fontSize: 14, fontWeight: '700', color: colors.navy },
  primary: { height: 52, borderRadius: radius.pill, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  ghost: { height: 50, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  ghostText: { color: colors.navy, fontSize: 15, fontWeight: '600' },
});
