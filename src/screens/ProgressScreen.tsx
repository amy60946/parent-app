import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { Avatar, Card } from '../components/ui';
import { useStore, taskOccursOn, completionKey } from '../store';
import { DAY_SHORT, addDays, toISO, startOfWeek } from '../dates';

export default function ProgressScreen({ navigation }: any) {
  const { children, tasks, completions } = useStore();
  const [childId, setChildId] = useState(children[0]?.id);
  const child = children.find((c) => c.id === childId) ?? children[0];
  const today = new Date();

  const stat = (iso: string) => {
    if (!child) return { total: 0, done: 0 };
    const scheduled = tasks.filter((t) => taskOccursOn(t, iso) && t.assignments.some((a) => a.childId === child.id));
    const done = scheduled.filter((t) => completions[completionKey(t.id, child.id, iso)] === 'approved').length;
    return { total: scheduled.length, done };
  };

  const data = useMemo(() => {
    const todayStat = stat(toISO(today));
    // Seri: bugünden geriye, görevi olan ve hepsi tamamlanan ardışık günler
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const s = stat(toISO(addDays(today, -i)));
      if (s.total === 0) { if (i === 0) continue; break; }
      if (s.done === s.total) streak++;
      else if (i === 0) continue;
      else break;
    }
    // Son 7 gün
    const week = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(today, i - 6);
      return { d, ...stat(toISO(d)) };
    });
    // Haftalık %
    const base = startOfWeek(today);
    const weekly = Array.from({ length: 6 }, (_, i) => {
      let total = 0, done = 0;
      for (let k = 0; k < 7; k++) {
        const iso = toISO(addDays(base, (i - 5) * 7 + k));
        if (iso > toISO(today)) continue;
        const s = stat(iso);
        total += s.total; done += s.done;
      }
      return { label: i === 5 ? 'Bu hf' : `${5 - i} hf`, pct: total ? Math.round((done / total) * 100) : 0, total };
    });
    // Alışkanlıklar (son 4 hafta, başlığa göre)
    const habits = new Map<string, { emoji: string; total: number; done: number }>();
    for (let i = 0; i < 28; i++) {
      const iso = toISO(addDays(today, -i));
      tasks.forEach((t) => {
        if (!child || !taskOccursOn(t, iso) || !t.assignments.some((a) => a.childId === child.id)) return;
        const h = habits.get(t.title) ?? { emoji: t.emoji, total: 0, done: 0 };
        h.total++;
        if (completions[completionKey(t.id, child.id, iso)] === 'approved') h.done++;
        habits.set(t.title, h);
      });
    }
    return { todayStat, streak, week, weekly, habits: [...habits.entries()] };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, completions, child?.id]);

  if (!child) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 12 }}>
        {/* Zor anlar: kayıt + arşiv */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable style={styles.abcMain} onPress={() => navigation.navigate('Abc', { new: true })} accessibilityLabel="Zor bir anı kaydet">
            <Ionicons name="pulse-outline" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Zor bir anı kaydet</Text>
          </Pressable>
          <Pressable style={styles.abcList} onPress={() => navigation.navigate('Abc')} accessibilityLabel="Geçmiş zor anlar">
            <Ionicons name="time-outline" size={20} color={colors.navy} />
            <Text style={{ color: colors.navy, fontSize: 13, fontWeight: '600' }}>Geçmiş</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', gap: 16 }}>
          {children.map((c) => (
            <Pressable key={c.id} onPress={() => setChildId(c.id)} style={{ alignItems: 'center', gap: 4, opacity: c.id === child.id ? 1 : 0.5 }}>
              <Avatar id={c.avatar} size={48} ring={c.id === child.id} />
              <Text style={{ fontSize: 11, color: colors.navy, fontWeight: '600' }}>{c.name}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.title}>{child.name}'in gelişimi</Text>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Card style={{ flex: 1, padding: 14 }}>
            <Text style={styles.big}>{data.todayStat.done}/{data.todayStat.total}</Text>
            <Text style={styles.cap}>Bugün tamamlanan</Text>
          </Card>
          <Card style={{ flex: 1, padding: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="flame" size={16} color="#E8742B" />
              <Text style={styles.big}>{data.streak} gün</Text>
            </View>
            <Text style={styles.cap}>Güncel seri</Text>
          </Card>
        </View>

        <Card>
          <Text style={styles.h}>Günlük tutarlılık</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 12 }}>
            {data.week.map((w) => {
              const ratio = w.total ? w.done / w.total : 0;
              const bg = w.total === 0 ? '#F1F3F8' : ratio === 1 ? colors.navy : ratio > 0 ? '#9AA6C9' : '#EBA5AF';
              return (
                <View key={toISO(w.d)} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 10, color: colors.muted }}>{DAY_SHORT[(w.d.getDay() + 6) % 7]}</Text>
                  <View style={{ height: 24, width: '100%', borderRadius: 6, backgroundColor: bg }} />
                </View>
              );
            })}
          </View>
        </Card>

        <Card>
          <Text style={styles.h}>Haftalık tamamlama</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 110, gap: 10, marginTop: 14 }}>
            {data.weekly.map((w, i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                <View style={{ flex: 1, width: '100%', justifyContent: 'flex-end', backgroundColor: '#F1F3F8', borderRadius: 6, overflow: 'hidden' }}>
                  <View style={{ height: `${w.pct}%`, backgroundColor: colors.navy }} />
                </View>
                <Text style={{ fontSize: 10, color: colors.muted }}>{w.label}</Text>
              </View>
            ))}
          </View>
        </Card>

        <Card>
          <Text style={styles.h}>Alışkanlıklar · son 4 hafta</Text>
          {data.habits.length === 0 && <Text style={[styles.cap, { marginTop: 10 }]}>Henüz veri yok.</Text>}
          {data.habits.map(([title, h]) => {
            const pct = h.total ? Math.round((h.done / h.total) * 100) : 0;
            return (
              <View key={title} style={{ marginTop: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 13, color: colors.navy }}>{h.emoji} {title}</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.navy }}>%{pct}</Text>
                </View>
                <View style={{ height: 5, borderRadius: 3, backgroundColor: '#F1F3F8', marginTop: 6, overflow: 'hidden' }}>
                  <View style={{ width: `${pct}%`, height: 5, backgroundColor: colors.navy }} />
                </View>
              </View>
            );
          })}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  abcMain: { flex: 1, flexDirection: 'row', gap: 8, height: 50, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  abcList: { flexDirection: 'row', gap: 6, height: 50, paddingHorizontal: 16, borderRadius: radius.md, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  safe: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 17, fontWeight: '700', color: colors.navy },
  big: { fontSize: 18, fontWeight: '700', color: colors.navy },
  cap: { fontSize: 11, color: colors.muted, marginTop: 2 },
  h: { fontSize: 13, fontWeight: '600', color: colors.navy },
});
