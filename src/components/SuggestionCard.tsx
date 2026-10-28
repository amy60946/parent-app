import React, { useState } from 'react';
import { View, Text, Pressable, Alert, StyleSheet } from 'react-native';
import { colors, radius, difficultyMeta } from '../theme';
import { useStore, Task } from '../store';
import { formatTR, todayISO } from '../dates';
import { Suggestion, decideSuggestion, linkSuggestionTask } from '../lib/clinic';

// Kabul edilen öneri → görev: alanlar birebir taşınır, başlangıç yoksa ya da geçmişse bugün (akislar.md 5.4, 3a).
// Rutin paketindeyse görev rutinine bağlanır (5.4 v2 adım 6); override: paket düzenlemesinde seçilen tekrar.
export function suggestionTask(s: Suggestion, override?: Pick<Suggestion, 'recurring' | 'repeatKind' | 'repeatDays'>): Omit<Task, 'id' | 'sortOrder'> {
  const start = s.startDate && s.startDate > todayISO() ? s.startDate : todayISO();
  const rep = override ?? s;
  return {
    title: s.title, emoji: s.emoji, skill: s.skill, description: s.description,
    assignments: [{ childId: s.childId, difficulty: s.difficulty, coins: s.coins ?? difficultyMeta[s.difficulty].coins }],
    startDate: start, recurring: rep.recurring, repeatKind: rep.repeatKind, repeatDays: rep.repeatDays,
    endDate: s.endDate && s.endDate >= start ? s.endDate : undefined, reminder: s.reminder, requiresReview: s.requiresReview,
    routine: s.routine ? { id: s.routine.group, title: s.routine.title, icon: s.routine.icon, position: s.routine.position } : undefined,
  };
}

// Uzmanın tek görev önerisi: "Görevlere ekle" ya da "Şimdilik değil" (öneriyi kapatır; uzman görür).
export default function SuggestionCard({ s, childName, goal, onDecided }: { s: Suggestion; childName: string; goal?: string; onDecided: (id: string) => void }) {
  const { addTasks } = useStore();
  const [busy, setBusy] = useState(false);
  const decide = async (accept: boolean) => {
    setBusy(true);
    try {
      await decideSuggestion(s.id, accept);
      const task = suggestionTask(s);
      const start = task.startDate;
      if (accept) addTasks([task], ([taskId]) => { if (taskId) linkSuggestionTask(s.id, taskId).catch(() => {}); });
      onDecided(s.id);
      if (accept) Alert.alert('Görev eklendi', `"${s.title}" ${start === todayISO() ? 'bugünden' : formatTR(start) + ' tarihinden'} itibaren ${childName} için görevlerde.`);
    } catch (e) {
      Alert.alert('Kaydedilemedi', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text style={{ fontSize: 24 }}>{s.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.h}>{s.title}</Text>
          <Text style={styles.cap}>{childName} · {difficultyMeta[s.difficulty].label} · {s.coins ?? difficultyMeta[s.difficulty].coins} coin</Text>
        </View>
      </View>
      <Text style={styles.cap}>{scheduleText(s)}</Text>
      {!!goal && <Text style={[styles.cap, { color: '#2F6B5E', fontWeight: '600' }]}>Hedef: {goal}</Text>}
      {!!s.description && <Text style={styles.body}>{s.description}</Text>}
      {!!s.note && <Text style={[styles.body, { fontStyle: 'italic' }]}>Uzmanın notu: {s.note}</Text>}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable style={[styles.ghost, { flex: 1 }]} disabled={busy} onPress={() => decide(false)} accessibilityRole="button">
          <Text style={{ color: colors.navy, fontWeight: '600' }}>Şimdilik değil</Text>
        </Pressable>
        <Pressable style={[styles.cta, { flex: 1 }, busy && { opacity: 0.6 }]} disabled={busy} onPress={() => decide(true)} accessibilityRole="button">
          <Text style={styles.ctaText}>Görevlere ekle</Text>
        </Pressable>
      </View>
    </View>
  );
}

// "Pzt, Çar, Cum · 18:00'de hatırlat · 30 Kasım'a kadar · İnceleme gerekli"
const weekDays = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
export function scheduleText(s: Suggestion) {
  const when = !s.recurring ? 'Bir kez'
    : s.repeatKind === 'weekly' && s.repeatDays.length ? [...s.repeatDays].sort((a, b) => a - b).map((d) => weekDays[d - 1]).filter(Boolean).join(', ')
    : s.repeatKind === 'monthly' && s.repeatDays.length ? `Her ay ${[...s.repeatDays].sort((a, b) => a - b).join(', ')}. gün`
    : 'Her gün';
  return [
    when,
    s.startDate && s.startDate > todayISO() ? `${formatTR(s.startDate)} başlar` : '',
    s.endDate ? `${formatTR(s.endDate)} tarihine kadar` : '',
    s.reminder ? `${s.reminder} hatırlatma` : '',
    s.requiresReview ? 'Onayınla tamamlanır' : 'Onaysız tamamlanır',
  ].filter(Boolean).join(' · ');
}

const styles = StyleSheet.create({
  card: { gap: 10, backgroundColor: '#fff', borderRadius: radius.md, padding: 14 },
  h: { fontSize: 15, fontWeight: '600', color: colors.navy },
  cap: { fontSize: 12, color: colors.muted },
  body: { fontSize: 13, color: colors.navy, lineHeight: 19 },
  cta: { height: 44, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  ghost: { height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
});
