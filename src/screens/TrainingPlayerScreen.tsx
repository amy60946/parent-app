import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { IconButton } from '../components/ui';
import { Bar, Check, Field, Footer, s as p } from '../components/TrainingParts';
import { Answer, TModule, TYPE_WORD, completeModule, moduleItems, patchTrainings, reloadTrainings, trainingError, useTrainings } from '../lib/trainings';
import { track } from '../lib/track';

// Oynatıcı (ortak akislar.md 23 adım 5; rakibin aile uygulamasına sadık, ClinicApp training/ParentPreview.tsx ile aynı akış):
// üstte "%x · n öğe kaldı"; okuma sayfa sayfa, son sayfada "Bu metni okudum" işaretlenmeden "Sonraki" açılmaz; test giriş kartı,
// "Cevabı kontrol et" → "✓ Doğru / ✗ Yanlış", sonuç kartı; açık uçlu giriş kartı + soru başına sayfa. Öğe bitince sunucuya
// family_training_module_complete (bir kez; bitmiş öğe salt okunur açılır). Son öğeden sonra kutlama yok, eğitim sayfasına dönülür.
// Kaydedilemezse ilerlenmez ve uyarı çıkar (sessiz başarısızlık yok).
export default function TrainingPlayerScreen({ navigation, route }: any) {
  const list = useTrainings();
  const t = list?.find((x) => x.id === route.params?.trainingId);
  const items = useMemo(() => (t ? moduleItems(t) : []), [t]);
  const [index, setIndex] = useState<number>(route.params?.index ?? 0);
  const [page, setPage] = useState(0);
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [readOk, setReadOk] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const close = () => navigation.goBack();

  if (!t || !items[index]) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.top}><View style={{ flex: 1 }} /><IconButton name="close" label="Kapat" onPress={close} /></View>
        <Text style={[p.p, { textAlign: 'center', padding: 24 }]}>Bu modül şu an açılamıyor.</Text>
      </SafeAreaView>
    );
  }

  const actor = t.mine && t.status === 'active';
  const { m, it } = items[index];
  const done = !!m.completedAt;
  const doneCount = items.filter((x) => x.m.completedAt).length;
  const pct = Math.round((doneCount / items.length) * 100);
  const remaining = items.length - doneCount;
  const nextItem = items[index + 1]?.it;
  const nextName = nextItem ? `Sonraki: ${TYPE_WORD[nextItem.type]}` : 'Bitir';
  // Bitmiş öğede kayıtlı yanıtlar gösterilir (salt okunur)
  const saved = (k: number): Answer | undefined => (done ? m.answers?.[k] : undefined);
  const pickOf = (k: number) => saved(k)?.pick ?? picks[`${it.key}:${k}`];
  const textOf = (k: number) => (done ? saved(k)?.text ?? '' : texts[`${it.key}:${k}`] ?? '');

  const goItem = (i: number) => { setIndex(i); setPage(0); };
  const advance = () => (nextItem ? goItem(index + 1) : close());

  const finish = async () => {
    if (done || !actor) return advance();
    let r: { answers?: Answer[]; correct?: number; total?: number } = {};
    if (it.type === 'quiz') {
      const qs = it.questions ?? [];
      const answers = qs.map((_, k) => ({ pick: picks[`${it.key}:${k}`] }));
      r = { answers, correct: qs.filter((q, k) => answers[k].pick === q.answer).length, total: qs.length };
    } else if (it.type === 'short') {
      r = { answers: (it.prompts ?? []).map((_, k) => ({ text: (texts[`${it.key}:${k}`] ?? '').trim() })) };
    }
    setBusy(true);
    try {
      await completeModule(m.id, r);
      const at = new Date().toISOString();
      patchTrainings((all) => all.map((x) => (x.id !== t.id ? x : { ...x, modules: x.modules.map((y): TModule =>
        (y.id === m.id ? { ...y, completedAt: at, answers: r.answers ?? null, correct: r.correct ?? null, total: r.total ?? null } : y)) })));
      track('training.module', { type: it.type, last: !nextItem });
      reloadTrainings();
      advance();
    } catch (e) {
      Alert.alert('Kaydedilemedi', trainingError(e));
    } finally { setBusy(false); }
  };

  const prev = () => (page > 0 ? setPage(page - 1) : index > 0 ? goItem(index - 1) : close());
  let content: React.ReactNode = null;
  let next = { label: 'İleri', onPress: () => setPage(page + 1), disabled: false };

  if (it.type === 'reading') {
    const secs = it.sections ?? [];
    const sec = secs[page];
    const last = page >= secs.length - 1;
    const ok = done || !!readOk[it.key];
    content = (
      <View style={{ gap: 10 }}>
        {page === 0 && <Text style={p.big}>{it.title}</Text>}
        {sec && <Text style={p.h}>{sec.heading}</Text>}
        {(sec?.paragraphs ?? []).map((x, j) => <Text key={j} style={p.p}>{x}</Text>)}
        {(sec?.bullets ?? []).map((b, j) => <Text key={`b${j}`} style={p.p}>{/^\d+[.)]\s/.test(b) ? b : `• ${b}`}</Text>)}
        {last && (
          <Pressable onPress={() => !done && setReadOk((x) => ({ ...x, [it.key]: !x[it.key] }))} style={styles.checkRow}
            accessibilityRole="checkbox" accessibilityState={{ checked: ok }}>
            <Check on={ok} />
            <Text style={p.p}>Bu metni okudum</Text>
          </Pressable>
        )}
      </View>
    );
    if (last) next = { label: nextName, onPress: finish, disabled: !ok };
  } else if (it.type === 'quiz') {
    const qs = it.questions ?? [];
    if (page === 0) {
      content = <Intro title={it.title} line={`${qs.length} soruluk çoktan seçmeli test`} />;
      next = { label: done ? 'Yanıtlarını gör' : 'Başla', onPress: () => setPage(1), disabled: false };
    } else if (page <= qs.length) {
      const k = page - 1, q = qs[k], id = `${it.key}:${k}`, pick = pickOf(k), shown = done || !!checked[id];
      content = (
        <View style={{ gap: 10 }}>
          <Text style={p.tiny}>Soru {page} / {qs.length}</Text>
          <Text style={p.h}>{q.q}</Text>
          {q.options.map((o, j) => {
            const on = pick === j, right = j === q.answer;
            return (
              <Pressable key={j} disabled={shown} onPress={() => setPicks((x) => ({ ...x, [id]: j }))}
                style={[p.opt, on && !shown && p.optOn, shown && right && styles.rightOpt, shown && on && !right && styles.wrongOpt]}
                accessibilityRole="radio" accessibilityState={{ selected: on }}>
                <Text style={[p.p, { flex: 1 }]}>{o}</Text>
                {shown && right && <Ionicons name="checkmark-circle" size={20} color="#2C4A9A" />}
                {shown && on && !right && <Ionicons name="close-circle" size={20} color={colors.danger} />}
              </Pressable>
            );
          })}
          {shown && pick !== undefined && (
            <Text style={[styles.verdict, { color: pick === q.answer ? colors.easy.fg : colors.danger }]}>{pick === q.answer ? '✓ Doğru' : '✗ Yanlış'}</Text>
          )}
        </View>
      );
      next = shown
        ? { label: page < qs.length ? 'Sonraki soru' : 'Bitir', onPress: () => setPage(page + 1), disabled: false }
        : { label: 'Cevabı kontrol et', onPress: () => setChecked((c) => ({ ...c, [id]: true })), disabled: pick === undefined };
    } else {
      const right = done && m.total !== null ? m.correct ?? 0 : qs.filter((q, k) => pickOf(k) === q.answer).length;
      const total = done && m.total !== null ? m.total : qs.length;
      content = (
        <View style={p.intro}>
          <Text style={styles.score}>%{total ? Math.round((right / total) * 100) : 0}</Text>
          <Text style={[p.h, { textAlign: 'center' }]}>{total} sorudan {right} tanesini doğru yanıtladın!</Text>
          <Text style={[p.p, { textAlign: 'center' }]}>Bu konuyu bir sonraki seansında uzmanınla gözden geçirmeni öneririz.</Text>
        </View>
      );
      next = { label: nextName, onPress: finish, disabled: false };
    }
  } else if (it.type === 'short') {
    const ps = it.prompts ?? [];
    if (page === 0) {
      content = <Intro title={it.title} line={`${ps.length} açık uçlu soru`} />;
      if (!ps.length) next = { label: nextName, onPress: finish, disabled: false };
    } else {
      const k = page - 1, q = ps[k], id = `${it.key}:${k}`;
      content = (
        <View style={{ gap: 10 }}>
          <Text style={p.tiny}>Soru {page} / {ps.length}</Text>
          <Field label={q} value={textOf(k)} onChange={(v) => setTexts((x) => ({ ...x, [id]: v }))} placeholder="Yanıtını yaz…" multiline max={1000} editable={!done && actor} />
        </View>
      );
      if (page >= ps.length) next = { label: nextName, onPress: finish, disabled: false };
    }
  } else {
    // video / pdf: kütüphanede henüz yok; yeni sürüm gelene dek ad ve açıklama
    content = <Intro title={it.title} line={it.desc} />;
    next = { label: nextName, onPress: finish, disabled: false };
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <Text style={styles.pct}>%{pct}</Text>
        <View style={{ flex: 1 }}><Bar pct={pct} /></View>
        <IconButton name="close" label="Eğitime dön" onPress={close} />
      </View>
      <Text style={[p.tiny, { paddingHorizontal: 20 }]}>{remaining ? `${remaining} öğe kaldı` : 'Hepsi bitti!'}</Text>
      {!actor && <Text style={[p.tiny, { paddingHorizontal: 20, marginTop: 4 }]}>{t.status === 'mastered' ? 'Bu eğitim tamamlandı; göz atıyorsun.' : `Bu eğitim ${t.parentName || 'öteki ebeveyn'} için; göz atıyorsun, kaydedilmez.`}</Text>}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 12, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <Text style={p.tiny}>{TYPE_WORD[it.type]}{done ? ' · tamamlandı' : ''}</Text>
          {content}
        </ScrollView>
        <Footer back={page > 0 || index > 0 ? 'Önceki' : undefined} onBack={prev} next={next.label} onNext={next.onPress} disabled={next.disabled} busy={busy} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Intro({ title, line }: { title: string; line: string }) {
  return (
    <View style={[p.intro, { marginTop: 12 }]}>
      <Text style={[p.big, { textAlign: 'center' }]}>{title}</Text>
      <Text style={[p.p, { textAlign: 'center' }]}>{line}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  pct: { fontSize: 14, fontWeight: '800', color: colors.navy, minWidth: 40 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, paddingVertical: 6 },
  rightOpt: { borderColor: '#2C4A9A', backgroundColor: '#E3EBFA' },
  wrongOpt: { borderColor: colors.danger, backgroundColor: '#FDE7EA' },
  verdict: { fontSize: 16, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  score: { fontSize: 40, fontWeight: '800', color: colors.navy },
});
