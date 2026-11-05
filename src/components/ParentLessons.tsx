import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { Card } from './ui';
import Info from './Info';
import { LessonsState, Lesson, familyLessons, startLesson, finishLesson, practiceLesson, lessonError, WEEK_DOTS } from '../lib/lessons';
import { listLinks, ClinicLink } from '../lib/clinic';
import { clinicianName } from '../lib/care';
import { useParentTasks } from '../parentTasks';
import { track } from '../lib/track';

// Gelişim › Ben: ebeveyn eğitimi (ortak akislar.md 22; kullanıcı kararları 5 Kasım 2026).
// "Bu haftanın becerisi" kartı (ders + Bu hafta dene + 5 nokta + Bugün uyguladım), Uzmanının önerisi, kütüphane, Öğrendiğin beceriler.
// İçerik yoksa ya da sunucu güncellemesi yoksa "Yakında" kartı. Seri, puan ve "kaçırdın" yok.

export const LESSON_NOTE = 'Bu dersler bilgi amaçlıdır; tanı ya da tedavi yerine geçmez.'; // hukuk/50 §13
const STONE_INFO = 'Bir derste "Bugün uyguladım" dediğin her gün 1 Güneş Taşı kazanırsın; haftada en çok 3. Aynı gün ikinci ders ek taş getirmez, dersi açmak da taş getirmez.\n\nTaşlarınla çocuğuna oyunda hediye gönderebilirsin (Aile › Ben › Güneş Taşım).';

export function useLessons() {
  const [state, setState] = useState<LessonsState | null | undefined>(undefined); // undefined: yükleniyor, null: sunucuda yok
  const reload = useCallback(() => familyLessons().then(setState).catch(() => setState((s) => s ?? null)), []);
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  return { state, setState, reload };
}

export const lessonByKey = (s: LessonsState | null | undefined, key: string) => s?.catalog.find((l) => l.key === key);

export default function ParentLessons({ navigation }: { navigation: any }) {
  const { state, setState } = useLessons();
  const pt = useParentTasks();
  const [links, setLinks] = useState<ClinicLink[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showLib, setShowLib] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => { listLinks().then(setLinks).catch(() => setLinks([])); }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const current = state?.mine.find((m) => m.status === 'current');
  const currentLesson = current ? lessonByKey(state, current.lessonKey) : undefined;
  const learned = useMemo(() => (state?.mine ?? []).filter((m) => m.status === 'learned'), [state]);
  const assigned = useMemo(() => (state?.assigned ?? []).filter((a) => a.lessonKey !== current?.lessonKey
    && !learned.some((m) => m.lessonKey === a.lessonKey)), [state, current, learned]);
  const library = useMemo(() => (state?.catalog ?? []).filter((l) => !l.retired && l.key !== current?.lessonKey
    && !assigned.some((a) => a.lessonKey === l.key) && !learned.some((m) => m.lessonKey === l.key)), [state, current, assigned, learned]);
  const fromClinician = (linkId?: string) => {
    const l = links.find((x) => x.linkId === linkId);
    return l ? clinicianName(l) : 'Uzmanın';
  };
  const isAssigned = (key: string) => !!state?.assigned.some((a) => a.lessonKey === key);

  if (state === undefined) return <ActivityIndicator style={{ marginTop: 24 }} color={colors.navy} />;
  if (!state || state.catalog.length === 0) return <Soon />;

  const flash = (t: string) => { setToast(t); clearTimeout(timer.current); timer.current = setTimeout(() => setToast(null), 2600); };

  const start = (l: Lesson) => {
    const go = async () => {
      setBusy(l.key);
      try {
        setState(await startLesson(l.key));
        track('lesson.start', { key: l.key, assigned: isAssigned(l.key) });
        setShowLib(false);
      } catch (e) { Alert.alert('Başlatılamadı', lessonError(e)); }
      setBusy(null);
    };
    if (!currentLesson) { go(); return; }
    const practiced = (current?.days ?? 0) > 0;
    Alert.alert('Bu haftanın becerisi değişsin mi?',
      practiced ? `"${currentLesson.title}" uyguladığın günlerle Öğrendiğin beceriler'e geçer.` : `"${currentLesson.title}" kütüphaneye döner; istediğin zaman yeniden başlayabilirsin.`,
      [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Değiştir', onPress: go }]);
  };

  const practice = async () => {
    if (!current || !state) return;
    const on = !current.weekDays.includes(state.today);
    setBusy('practice');
    try {
      const r = await practiceLesson(current.lessonKey, on);
      setState((s) => s && ({
        ...s, weekPracticed: r.weekPracticed, weekStones: r.weekStones, balance: r.balance,
        mine: s.mine.map((m) => (m.lessonKey === current.lessonKey ? { ...m, weekDays: r.weekDays, days: Math.max(0, m.days + (on ? 1 : -1)) } : m)),
      }));
      track('lesson.practice', { key: current.lessonKey, on, stone: r.stoneGiven });
      if (r.stoneGiven > 0) flash(`+${r.stoneGiven} Güneş Taşı`);
      else if (on && r.weekStones >= r.weekCap) flash('Harika! Bu haftanın taşları tamam.');
      pt.reload();
    } catch (e) { Alert.alert('Kaydedilemedi', lessonError(e)); }
    setBusy(null);
  };

  const finish = () => {
    if (!current || !currentLesson) return;
    Alert.alert('Bu beceriyi öğrendin mi?', 'Öğrendiğin beceriler\'e geçer; sonra yeni bir beceri seçebilirsin. İstediğin zaman yeniden açabilirsin.', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Öğrendim', onPress: async () => {
        setBusy('finish');
        try { setState(await finishLesson(current.lessonKey)); track('lesson.finish', { key: current.lessonKey }); setShowLib(true); }
        catch (e) { Alert.alert('Kaydedilemedi', lessonError(e)); }
        setBusy(null);
      } },
    ]);
  };

  const doneToday = !!current && current.weekDays.includes(state.today);
  const dots = Math.min(WEEK_DOTS, current?.weekDays.length ?? 0);
  const open = (key: string) => navigation.navigate('Lesson', { key });

  return (
    <View style={{ gap: 12 }}>
      {current && currentLesson && (
        <Card style={{ gap: 12 }}>
          <View style={styles.row}>
            {isAssigned(current.lessonKey) && <Chip text="Uzmanının önerisi" />}
            <Text style={styles.over}>BU HAFTANIN BECERİSİ</Text>
          </View>
          <Pressable onPress={() => open(current.lessonKey)} accessibilityRole="button" accessibilityLabel={`${currentLesson.title} dersini aç`}>
            <Text style={styles.lessonTitle}>{currentLesson.title}</Text>
            <View style={[styles.row, { marginTop: 4 }]}>
              <Ionicons name="book-outline" size={14} color={colors.navy} />
              <Text style={styles.link}>Dersi aç · {currentLesson.minutes} dk</Text>
            </View>
          </Pressable>
          {!!currentLesson.tryText && (
            <View style={styles.tryBox}>
              <Text style={styles.tryLabel}>Bu hafta dene</Text>
              <Text style={styles.tryText}>{currentLesson.tryText}</Text>
            </View>
          )}
          <View style={styles.row}>
            <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel={`Bu hafta ${current.weekDays.length} gün uygulandı`}>
              {Array.from({ length: WEEK_DOTS }, (_, i) => <View key={i} style={[styles.dot, i < dots && styles.dotOn]} />)}
            </View>
            <Text style={styles.cap}>Bu hafta {current.weekDays.length}/{WEEK_DOTS} gün</Text>
          </View>
          <Pressable onPress={practice} disabled={busy === 'practice'} style={[styles.btn, doneToday && styles.btnDone]}
            accessibilityRole="button" accessibilityLabel={doneToday ? 'Bugün uygulandı, geri almak için dokun' : 'Bugün uyguladım'}>
            {busy === 'practice' ? <ActivityIndicator color={doneToday ? colors.navy : '#fff'} /> : (
              <>
                <Ionicons name={doneToday ? 'checkmark-circle' : 'checkmark-circle-outline'} size={18} color={doneToday ? colors.easy.fg : '#fff'} />
                <Text style={[styles.btnText, doneToday && { color: colors.easy.fg }]}>{doneToday ? 'Bugün uygulandı' : 'Bugün uyguladım'}</Text>
              </>
            )}
          </Pressable>
          {doneToday && <Text style={[styles.cap, { textAlign: 'center', marginTop: -6 }]}>Yanlışlıkla mı? Geri almak için yeniden dokun.</Text>}
          <View style={styles.row}>
            <Ionicons name="sunny" size={15} color={colors.gold} />
            <Text style={[styles.cap, { flex: 1 }]}>{toast ?? `Bu hafta ${state.weekStones}/${state.weekCap} Güneş Taşı`}</Text>
            <Info title="Güneş Taşı" text={STONE_INFO} size={20} color={colors.navy} />
          </View>
          <View style={styles.footRow}>
            <Pressable onPress={finish} disabled={busy === 'finish'} hitSlop={8} accessibilityRole="button">
              <Text style={styles.link}>Öğrendim</Text>
            </Pressable>
            {library.length > 0 && (
              <Pressable onPress={() => setShowLib((v) => !v)} hitSlop={8} style={styles.row} accessibilityRole="button">
                <Text style={styles.link}>Başka beceri seç</Text>
                <Ionicons name={showLib ? 'chevron-up' : 'chevron-down'} size={14} color={colors.navy} />
              </Pressable>
            )}
          </View>
        </Card>
      )}

      {assigned.map((a) => {
        const l = lessonByKey(state, a.lessonKey);
        if (!l) return null;
        return (
          <Card key={a.id} style={{ gap: 8 }}>
            <View style={styles.row}><Chip text="Uzmanının önerisi" /><Text style={[styles.cap, { flex: 1 }]} numberOfLines={1}>{fromClinician(a.linkId)}</Text></View>
            <Text style={styles.lessonTitle}>{l.title}</Text>
            {!!l.summary && <Text style={styles.sub}>{l.summary}</Text>}
            {!!a.note && <Text style={styles.note}>“{a.note}”</Text>}
            <View style={[styles.row, { marginTop: 4 }]}>
              <Pressable onPress={() => start(l)} disabled={busy === l.key} style={[styles.btn, { flex: 1 }]}>
                {busy === l.key ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{current ? 'Bu haftanın becerisi yap' : 'Başla'}</Text>}
              </Pressable>
              <Pressable onPress={() => open(l.key)} style={styles.btnGhost}><Text style={styles.ghostText}>{l.minutes} dk · Oku</Text></Pressable>
            </View>
          </Card>
        );
      })}

      {library.length > 0 && (current && !showLib ? null : (
        <Card style={{ gap: 2 }}>
          <Text style={styles.h}>{current ? 'Kütüphane' : 'Bir beceri seç'}</Text>
          {!current && <Text style={[styles.cap, { marginBottom: 6 }]}>Haftada bir beceri: kısa ders, evde küçük bir deneme.</Text>}
          {library.map((l) => (
            <View key={l.key} style={styles.libRow}>
              <Pressable onPress={() => open(l.key)} style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={`${l.title} dersini oku`}>
                <Text style={styles.libTitle}>{l.title}</Text>
                <Text style={styles.cap} numberOfLines={2}>{[`${l.minutes} dk`, l.summary].filter(Boolean).join(' · ')}</Text>
              </Pressable>
              <Pressable onPress={() => start(l)} disabled={busy === l.key} style={styles.small} accessibilityRole="button" accessibilityLabel={`${l.title}: başla`}>
                {busy === l.key ? <ActivityIndicator size="small" color={colors.navy} /> : <Text style={styles.smallText}>Başla</Text>}
              </Pressable>
            </View>
          ))}
        </Card>
      ))}

      {learned.length > 0 && (
        <Card style={{ gap: 2 }}>
          <Text style={styles.h}>Öğrendiğin beceriler</Text>
          {learned.map((m) => {
            const l = lessonByKey(state, m.lessonKey);
            if (!l) return null;
            return (
              <Pressable key={m.lessonKey} onPress={() => open(m.lessonKey)} style={styles.libRow} accessibilityRole="button">
                <Ionicons name="ribbon-outline" size={18} color={colors.navy} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.libTitle}>{l.title}</Text>
                  <Text style={styles.cap}>{m.days} gün uyguladın</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.faint} />
              </Pressable>
            );
          })}
        </Card>
      )}
      <Text style={styles.foot}>{LESSON_NOTE}</Text>
    </View>
  );
}

export function Chip({ text }: { text: string }) {
  return <View style={styles.chip}><Text style={styles.chipText}>{text}</Text></View>;
}

function Soon() {
  return (
    <View style={{ gap: 12 }}>
      <Card style={{ gap: 8, alignItems: 'flex-start' }}>
        <View style={styles.soonIcon}><Ionicons name="school-outline" size={22} color={colors.navy} /></View>
        <Text style={styles.lessonTitle}>Yakında: kısa ebeveyn dersleri</Text>
        <Text style={styles.sub}>Haftada bir beceri: 3–5 dakikalık bir ders ve evde denemek için küçük bir adım. Uyguladığın günler Güneş Taşı kazandırır; uzmanın varsa sana ders de önerebilir.</Text>
      </Card>
      <Text style={styles.foot}>{LESSON_NOTE}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  over: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, color: colors.muted, flex: 1 },
  lessonTitle: { fontSize: 17, fontWeight: '700', color: colors.navy },
  sub: { fontSize: 13, lineHeight: 19, color: colors.muted },
  note: { fontSize: 13, lineHeight: 19, color: colors.navy, fontStyle: 'italic' },
  link: { fontSize: 13, fontWeight: '600', color: colors.navy, textDecorationLine: 'underline' },
  tryBox: { backgroundColor: colors.today, borderRadius: radius.sm, padding: 12, gap: 4 },
  tryLabel: { fontSize: 11, fontWeight: '700', color: colors.navy, letterSpacing: 0.4 },
  tryText: { fontSize: 14, lineHeight: 20, color: colors.navy },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: '#A3AABB', backgroundColor: '#fff' },
  dotOn: { backgroundColor: colors.easy.fg, borderColor: colors.easy.fg },
  btn: { height: 48, borderRadius: radius.md, backgroundColor: colors.navy, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  btnDone: { backgroundColor: colors.easy.bg },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnGhost: { height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  ghostText: { color: colors.navy, fontSize: 14, fontWeight: '600' },
  footRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  h: { fontSize: 13, fontWeight: '600', color: colors.navy, marginBottom: 4 },
  libRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  libTitle: { fontSize: 14, fontWeight: '600', color: colors.navy },
  small: { minWidth: 64, height: 34, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.navy, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  smallText: { fontSize: 13, fontWeight: '700', color: colors.navy },
  cap: { fontSize: 12, color: '#5F6678' },
  chip: { backgroundColor: colors.medium.bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  chipText: { fontSize: 11, fontWeight: '700', color: colors.medium.fg },
  soonIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.today, alignItems: 'center', justifyContent: 'center' },
  foot: { fontSize: 11, lineHeight: 16, color: colors.muted, textAlign: 'center' },
});
