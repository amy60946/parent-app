import React, { useState } from 'react';
import { View, Text, Pressable, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { useStore, Task } from '../store';
import { Suggestion, decideSuggestion } from '../lib/clinic';
import { taskDayPartOf } from '../data/dayParts';
import { formatTR, todayISO } from '../dates';
import { WEEKDAYS } from '../data/routines';
import { track } from '../lib/track';

// Uzmanın değişiklik önerisi (kullanıcı kararları 30 Ekim ve 2 Kasım 2026; ortak akislar.md 12.1 adım 6–8): uzman ailede ekli
// göreve doğrudan dokunmaz; yeni saat / gün / tekrar ya da "görevi çıkar" önerir. Aynı rutinin değişiklikleri tek kart.
// Uygula → aynı görev güncellenir (silinip yeniden açılmaz; yapılan adımlar, onaylar ve coin korunur); çıkarılan görev bugün
// biter (başlangıcı ileride ise silinir). Şimdilik değil → öneri reddedilir; uzmana bildirilir.
const DAY = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

function repeatText(t: Pick<Task, 'recurring' | 'repeatKind' | 'repeatDays'>) {
  if (!t.recurring) return 'Bir kez';
  if (t.repeatKind === 'daily') return 'Her gün';
  const d = [...t.repeatDays].sort((a, b) => a - b);
  if (t.repeatKind === 'weekly' && d.join() === WEEKDAYS.join()) return 'Hafta içi';
  if (t.repeatKind === 'weekly' && d.length === 7) return 'Her gün';
  return t.repeatKind === 'weekly' ? d.map((x) => DAY[x - 1]).filter(Boolean).join(', ') : `Her ay ${d.join(', ')}. gün`;
}

// Görevin bugünkü hâliyle önerilen hâlinin farkı: "07:00 → 07:15", "Hafta içi → Her gün", "Bitiş: 30 Kasım"
function diffs(t: Task, s: Suggestion): { old?: string; now: string }[] {
  if (s.changeRemove) return [{ now: 'Maceralardan çıkar' }];
  const out: { old?: string; now: string }[] = [];
  if ((t.reminder ?? '') !== (s.reminder ?? '')) out.push({ old: t.reminder ?? 'saatsiz', now: s.reminder ?? 'saatsiz' });
  const a = repeatText(t), b = repeatText(s);
  if (a !== b) out.push({ old: a, now: b });
  if ((t.endDate ?? '') !== (s.endDate ?? '')) out.push({ old: t.endDate ? `bitiş ${formatTR(t.endDate)}` : 'bitiş yok', now: s.endDate ? `bitiş ${formatTR(s.endDate)}` : 'bitiş yok' });
  return out.length ? out : [{ now: 'Değişiklik yok' }];
}

export default function ChangeSuggestionCard({ items, childName, onDecided }: { items: Suggestion[]; childName: string; onDecided: (ids: string[]) => void }) {
  const { tasks, updateTask, deleteTask } = useStore();
  const [busy, setBusy] = useState(false);
  const list = [...items].sort((a, b) => (a.routine?.position ?? 0) - (b.routine?.position ?? 0));
  const r = list[0].routine;
  const today = todayISO();

  const apply = async () => {
    setBusy(true);
    try {
      for (const s of list) {
        const t = tasks.find((x) => x.id === s.targetTaskId);
        if (t) {
          if (s.changeRemove) {
            if (t.startDate > today) deleteTask(t.id);
            else updateTask(t.id, { endDate: today });
          } else {
            updateTask(t.id, {
              reminder: s.reminder, dayPart: s.reminder ? taskDayPartOf(s.reminder) : t.dayPart,
              recurring: s.recurring, repeatKind: s.repeatKind, repeatDays: s.repeatDays, endDate: s.endDate,
            });
          }
        }
        await decideSuggestion(s.id, true);
      }
      track('clinic.change_apply', { n: list.length });
      onDecided(list.map((s) => s.id));
    } catch (e) {
      Alert.alert('Uygulanamadı', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const decline = async () => {
    setBusy(true);
    try {
      await Promise.all(list.map((s) => decideSuggestion(s.id, false)));
      track('clinic.change_decline', { n: list.length });
      onDecided(list.map((s) => s.id));
    } catch (e) {
      Alert.alert('Kaydedilemedi', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="swap-horizontal" size={18} color={colors.navy} />
        <Text style={[styles.h, { flex: 1 }]}>Uzmanın değişiklik önerisi</Text>
        <Text style={styles.pill}>{r ? `${r.title}` : 'Macera'}</Text>
      </View>
      <Text style={styles.cap}>{childName}{list[0].note ? ` · ${list[0].note}` : ''}</Text>
      <View style={{ gap: 6 }}>
        {list.map((s) => {
          const t = tasks.find((x) => x.id === s.targetTaskId);
          return (
            <View key={s.id} style={{ gap: 2 }}>
              <Text style={styles.item}>{t?.emoji ?? s.emoji} {t?.title ?? s.title}</Text>
              {t ? diffs(t, s).map((d, i) => (
                <Text key={i} style={styles.diff}>
                  {d.old ? <Text style={styles.old}>{d.old}</Text> : null}{d.old ? ' → ' : ''}<Text style={{ fontWeight: '700', color: s.changeRemove ? colors.danger : colors.navy }}>{d.now}</Text>
                </Text>
              )) : <Text style={styles.cap}>Bu macera artık listende yok</Text>}
            </View>
          );
        })}
      </View>
      <Text style={styles.cap}>Uygulanınca aynı maceralar güncellenir; yapılanlar, onaylar ve coin değişmez.</Text>
      {busy ? <ActivityIndicator color={colors.navy} style={{ marginVertical: 8 }} /> : (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable style={[styles.ghost, { flex: 1 }]} onPress={decline} accessibilityRole="button"><Text style={styles.ghostText}>Şimdilik değil</Text></Pressable>
          <Pressable style={[styles.cta, { flex: 1 }]} onPress={apply} accessibilityRole="button"><Text style={styles.ctaText}>Uygula</Text></Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10, backgroundColor: '#fff', borderRadius: radius.md, padding: 14, borderWidth: 1, borderColor: '#F3DFA2' },
  h: { fontSize: 15, fontWeight: '700', color: colors.navy },
  pill: { fontSize: 11, fontWeight: '700', color: colors.navy, backgroundColor: colors.today, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  cap: { fontSize: 12, lineHeight: 17, color: colors.muted },
  item: { fontSize: 14, fontWeight: '600', color: colors.navy },
  diff: { fontSize: 13, color: colors.navy, marginLeft: 26 },
  old: { color: colors.muted, textDecorationLine: 'line-through' },
  cta: { height: 44, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  ghost: { height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  ghostText: { color: colors.navy, fontWeight: '600' },
});
