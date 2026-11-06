import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { IconButton } from '../components/ui';
import { Markdown } from '../components/LegalText';
import { Chip, LESSON_NOTE, lessonByKey, useLessons } from '../components/ParentLessons';
import { lessonBody, openLesson, startLesson, practiceLesson, lessonError } from '../lib/lessons';
import { useParentTasks } from '../parentTasks';
import { track } from '../lib/track';

// Ders sayfası (ortak akislar.md 22 adım 6): başlık, süre, metin, "Bu hafta dene", sınır notu.
// Başlanmış derste ilk açılış kaydedilir (taş yok). Uzmanın önerdiği derste uzmanın uygulama günlerini gördüğü yazılır.
export default function LessonScreen({ navigation, route }: any) {
  const key: string = route.params?.key;
  const { state, setState } = useLessons();
  const pt = useParentTasks();
  const [body, setBody] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lesson = lessonByKey(state, key);
  const mine = state?.mine.find((m) => m.lessonKey === key);
  const assigned = !!state?.assigned.some((a) => a.lessonKey === key) || !!mine?.assignmentId;

  useEffect(() => { lessonBody(key).then(setBody).catch(() => setBody('')); }, [key]);
  useEffect(() => {
    if (!mine) return;
    track('lesson.open', { key });
    if (!mine.openedAt) openLesson(key).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!mine, key]);

  const today = state?.today;
  const doneToday = !!mine && !!today && mine.weekDays.includes(today);

  const act = async () => {
    if (!lesson) return;
    setBusy(true);
    try {
      if (mine?.status !== 'current') {
        const cur = state?.mine.find((m) => m.status === 'current');
        if (cur) {
          const ok = await new Promise<boolean>((res) => Alert.alert('Bu haftanın becerisi değişsin mi?',
            cur.days > 0 ? 'Şimdiki beceri uyguladığın günlerle Öğrendiğin beceriler\'e geçer.' : 'Şimdiki beceri kütüphaneye döner.',
            [{ text: 'Vazgeç', style: 'cancel', onPress: () => res(false) }, { text: 'Değiştir', onPress: () => res(true) }]));
          if (!ok) { setBusy(false); return; }
        }
        setState(await startLesson(key));
        track('lesson.start', { key, assigned });
        openLesson(key).catch(() => {});
      } else {
        const r = await practiceLesson(key, !doneToday);
        setState((s) => s && ({ ...s, weekPracticed: r.weekPracticed, weekStones: r.weekStones, balance: r.balance,
          mine: s.mine.map((m) => (m.lessonKey === key ? { ...m, weekDays: r.weekDays, days: Math.max(0, m.days + (doneToday ? -1 : 1)) } : m)) }));
        track('lesson.practice', { key, on: !doneToday, stone: r.stoneGiven });
        pt.reload();
      }
    } catch (e) { Alert.alert('Kaydedilemedi', lessonError(e)); }
    setBusy(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <IconButton name="close" onPress={() => navigation.goBack()} label="Kapat" />
      </View>
      {!lesson ? (
        state === undefined ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.navy} />
          : <Text style={[styles.cap, { textAlign: 'center', marginTop: 40 }]}>Bu ders şu an açılamıyor.</Text>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 32, gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.cap}>{lesson.minutes} dk okuma</Text>
              {assigned && <Chip text="Uzmanının önerisi" />}
            </View>
            <Text style={styles.title}>{lesson.title}</Text>
            {!!lesson.summary && <Text style={styles.sub}>{lesson.summary}</Text>}
            {body === null ? <ActivityIndicator color={colors.navy} /> : !!body && <Markdown text={body} />}
            {!!lesson.tryText && (
              <View style={styles.tryBox}>
                <Text style={styles.tryLabel}>Bu hafta dene</Text>
                <Text style={styles.tryText}>{lesson.tryText}</Text>
              </View>
            )}
            {assigned && <Text style={[styles.cap, { textAlign: 'center' }]}>Uzmanın bu dersteki uygulama günlerini görür.</Text>}
            <Text style={styles.foot}>{LESSON_NOTE}</Text>
          </ScrollView>
          {!lesson.retired && (
            <View style={styles.bar}>
              <Pressable onPress={act} disabled={busy} style={[styles.btn, doneToday && styles.btnDone]} accessibilityRole="button">
                {busy ? <ActivityIndicator color={doneToday ? colors.navy : '#fff'} /> : (
                  <>
                    {mine?.status === 'current' && <Ionicons name={doneToday ? 'checkmark-circle' : 'checkmark-circle-outline'} size={18} color={doneToday ? colors.easy.fg : '#fff'} />}
                    <Text style={[styles.btnText, doneToday && { color: colors.easy.fg }]}>
                      {mine?.status === 'current' ? (doneToday ? 'Bugün uygulandı' : 'Bugün uyguladım') : 'Bu haftanın becerisi yap'}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 12, paddingTop: 4 },
  title: { fontSize: 22, fontWeight: '700', color: colors.navy },
  sub: { fontSize: 14, lineHeight: 20, color: colors.muted },
  cap: { fontSize: 12, color: '#5F6678' },
  tryBox: { backgroundColor: colors.today, borderRadius: radius.sm, padding: 14, gap: 4 },
  tryLabel: { fontSize: 11, fontWeight: '700', color: colors.navy, letterSpacing: 0.4 },
  tryText: { fontSize: 15, lineHeight: 21, color: colors.navy },
  foot: { fontSize: 11, lineHeight: 16, color: colors.muted, textAlign: 'center', marginTop: 8 },
  bar: { padding: 16, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, backgroundColor: colors.bg },
  btn: { height: 50, borderRadius: radius.md, backgroundColor: colors.navy, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  btnDone: { backgroundColor: colors.easy.bg },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
