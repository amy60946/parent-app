import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { IconButton } from '../components/ui';
import { Field, Footer, Scale, s as p } from '../components/TrainingParts';
import { logTask, reloadTrainings, setTodo, patchTrainings, trainingError, useTrainings } from '../lib/trainings';
import { formatTR, toISO, todayISO } from '../dates';
import { track } from '../lib/track';

// Uygulama görevi (ortak akislar.md 23 adım 6): "Parçası: <eğitim>", sarı başlık, açıklama, ölçüme göre sayı alanı,
// "Paylaşmak istediğin bir düşünce var mı?" ≤ 255, Gönder → family_training_log (bugünün kaydı).
export default function TrainingTaskScreen({ navigation, route }: any) {
  const list = useTrainings();
  const t = list?.find((x) => x.id === route.params?.trainingId);
  const task = t?.tasks.find((k) => k.id === route.params?.taskId);
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [r, setR] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const close = () => navigation.goBack();

  if (!t || !task) return <Missing onClose={close} />;
  const actor = t.mine && t.status === 'active';
  const m = task.measure;
  const ok = m === 'frequency' ? a !== '' : m === 'accuracy' ? a !== '' && b !== '' && Number(a) <= Number(b) : m === 'duration' ? a !== '' && Number(a) <= 1440 : true;

  const send = async () => {
    setBusy(true);
    try {
      await logTask(task.id, {
        count: m === 'frequency' ? Number(a) : undefined,
        successes: m === 'accuracy' ? Number(a) : undefined, attempts: m === 'accuracy' ? Number(b) : undefined,
        minutes: m === 'duration' ? Number(a) : undefined, reflection: r.trim(),
      });
      track('training.log', { measure: m, note: !!r.trim() });
      reloadTrainings();
      setSent(true);
    } catch (e) { Alert.alert('Gönderilemedi', trainingError(e)); } finally { setBusy(false); }
  };

  if (sent) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={[styles.pad, { flexGrow: 1, justifyContent: 'center' }]}>
          <View style={p.intro}>
            <Ionicons name="checkmark-circle-outline" size={36} color={colors.easy.fg} />
            <Text style={[p.h, { textAlign: 'center' }]}>Kaydın gönderildi</Text>
            <Text style={[p.p, { textAlign: 'center' }]}>Uzmanın bugünkü uygulamanı görür.</Text>
          </View>
        </ScrollView>
        <Footer next="Tamam" onNext={close} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <Text style={[p.tiny, { flex: 1 }]} numberOfLines={2}>Parçası: {t.title}</Text>
        <IconButton name="close" label="Kapat" onPress={close} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
          <View style={p.yellow}><Text style={p.yellowTitle}>{task.title}</Text></View>
          {!!task.description && <Text style={p.p}>{task.description}</Text>}
          {!actor ? (
            <Text style={p.tiny}>{t.status === 'mastered' ? 'Bu eğitim tamamlandı.' : `Bu görev ${t.parentName || 'öteki ebeveyn'} için; kaydı o girer.`}</Text>
          ) : (
            <>
              <Text style={p.tiny}>{formatTR(todayISO())} · bugünün kaydı</Text>
              {m === 'frequency' && <Field label="Sıklık sayısı" value={a} onChange={setA} placeholder="0" numeric />}
              {m === 'accuracy' && <>
                <Field label="Başarılı deneme sayısı" value={a} onChange={setA} placeholder="0" numeric />
                <Field label="Toplam deneme sayısı" value={b} onChange={setB} placeholder="0" numeric />
                {a !== '' && b !== '' && Number(a) > Number(b) && <Text style={[p.tiny, { color: colors.danger }]}>Başarılı deneme toplamdan fazla olamaz.</Text>}
              </>}
              {m === 'duration' && <Field label="Süre (dakika)" value={a} onChange={setA} placeholder="0" numeric />}
              <Field label="Paylaşmak istediğin bir düşünce var mı?" value={r} onChange={setR} placeholder="Ne iyi gitti? Ne daha iyi olabilirdi?" multiline max={255} />
            </>
          )}
        </ScrollView>
        {actor && <Footer next="Gönder" onNext={send} disabled={!ok} busy={busy} />}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Tek seferlik görev (ortak akislar.md 23 adım 7): "Atandı: Bugün", açıklama, atanma tarihi, "✓ Tamamlandı olarak işaretle"
// → "Nasıl geçti?" (1 Çok kötü … 5 Harika) + düşünce ≤ 140 ("Bu yalnızca uzmanınla paylaşılır.") → "🎉 Tamamlandı!"
const RATE = ['Çok kötü', 'Kötü', 'Fena değil', 'İyi', 'Harika'];
export function TrainingTodoScreen({ navigation, route }: any) {
  const list = useTrainings();
  const t = list?.find((x) => x.id === route.params?.trainingId);
  const todo = t?.todos.find((d) => d.id === route.params?.todoId);
  const [step, setStep] = useState<'view' | 'rate'>('view');
  const [rate, setRate] = useState<number | null>(3);
  const [r, setR] = useState('');
  const [busy, setBusy] = useState(false);
  const close = () => navigation.goBack();

  if (!t || !todo) return <Missing onClose={close} />;
  const actor = t.mine && t.status === 'active';
  const assigned = toISO(new Date(todo.createdAt)); // cihazın günü (UTC değil)
  const daysAgo = Math.round((new Date(`${todayISO()}T12:00:00`).getTime() - new Date(`${assigned}T12:00:00`).getTime()) / 864e5);
  const when = daysAgo <= 0 ? 'Bugün' : daysAgo === 1 ? 'Dün' : `${daysAgo} gün önce`;

  const save = async (done: boolean) => {
    setBusy(true);
    try {
      await setTodo(todo.id, done, done ? rate ?? undefined : undefined, done ? r.trim() : '');
      const at = new Date().toISOString();
      patchTrainings((all) => all.map((x) => (x.id !== t.id ? x : { ...x, todos: x.todos.map((d) =>
        (d.id === todo.id ? { ...d, doneAt: done ? at : null, rating: done ? rate : null, reflection: done ? r.trim() : '' } : d)) })));
      track('training.todo', { done, rating: done ? rate ?? 0 : 0 });
      reloadTrainings();
      setStep('view');
    } catch (e) { Alert.alert('Kaydedilemedi', trainingError(e)); } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <View style={{ flex: 1 }} />
        <IconButton name="close" label="Kapat" onPress={close} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
          <View style={p.yellow}>
            <Text style={p.tiny}>Atandı: {when}</Text>
            <Text style={p.yellowTitle}>{todo.title}</Text>
          </View>
          {!!todo.description && <Text style={p.p}>{todo.description}</Text>}
          <Text style={p.tiny}>{formatTR(assigned)} · Atanma tarihi</Text>
          {todo.doneAt ? (
            <View style={[p.intro, { marginTop: 8 }]}>
              <Text style={p.big}>🎉 Tamamlandı!</Text>
              {todo.rating !== null && <Text style={p.p}>Nasıl geçti: {RATE[todo.rating - 1]}</Text>}
              {!!todo.reflection && <Text style={[p.p, { textAlign: 'center' }]}>“{todo.reflection}”</Text>}
              {actor && (
                <Pressable onPress={() => save(false)} disabled={busy} hitSlop={8} accessibilityRole="button">
                  <Text style={styles.link}>Geri al</Text>
                </Pressable>
              )}
            </View>
          ) : !actor ? (
            <Text style={p.tiny}>{t.status === 'mastered' ? 'Bu eğitim tamamlandı.' : `Bu görev ${t.parentName || 'öteki ebeveyn'} için; işareti o koyar.`}</Text>
          ) : step === 'view' ? (
            <Pressable onPress={() => setStep('rate')} style={styles.primary} accessibilityRole="button">
              <Text style={styles.primaryText}>✓ Tamamlandı olarak işaretle</Text>
            </Pressable>
          ) : (
            <View style={{ gap: 12 }}>
              <Text style={p.label}>Nasıl geçti?</Text>
              <Scale value={rate} onChange={setRate} low="Çok kötü" high="Harika" labels={RATE} />
              <Field label="Paylaşmak istediğin bir düşünce var mı?" value={r} onChange={setR} multiline max={140} />
              <Text style={[p.tiny, { marginTop: -6 }]}>Bu yalnızca uzmanınla paylaşılır.</Text>
            </View>
          )}
        </ScrollView>
        {actor && !todo.doneAt && step === 'rate' && <Footer back="Vazgeç" onBack={() => setStep('view')} next="Gönder" onNext={() => save(true)} disabled={rate === null} busy={busy} />}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Missing({ onClose }: { onClose: () => void }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.top}><View style={{ flex: 1 }} /><IconButton name="close" label="Kapat" onPress={onClose} /></View>
      <Text style={[p.p, { textAlign: 'center', padding: 24 }]}>Bu görev şu an açılamıyor. Uzmanın eğitimi kapatmış ya da paylaşım bitmiş olabilir.</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  pad: { padding: 20, paddingTop: 8, gap: 14 },
  primary: { height: 52, borderRadius: radius.pill, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  link: { fontSize: 14, fontWeight: '600', color: colors.muted, textDecorationLine: 'underline', marginTop: 4 },
});
