import React, { useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, useWindowDimensions, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { Avatar, DifficultyBadge } from '../components/ui';
import { useStore, taskOccursOn, completionKey, Task } from '../store';
import { DAY_SHORT, addDays, fromISO, monthYear, startOfWeek, toISO, todayISO } from '../dates';

const WEEK_RANGE = 52; // bugünden ±52 hafta

export default function TasksScreen({ navigation }: any) {
  const { width } = useWindowDimensions();
  const { tasks, children, completions, toggleCompletion } = useStore();
  const [selected, setSelected] = useState(todayISO());
  const [childFilter, setChildFilter] = useState<string | 'all'>('all');
  const listRef = useRef<FlatList>(null);

  const weeks = useMemo(() => {
    const base = startOfWeek(new Date());
    return Array.from({ length: WEEK_RANGE * 2 + 1 }, (_, i) => addDays(base, (i - WEEK_RANGE) * 7));
  }, []);

  const today = todayISO();

  const dayTasks = useMemo(() => {
    return tasks
      .filter((t) => taskOccursOn(t, selected))
      .map((t) => ({
        task: t,
        assigns: t.assignments.filter((a) => childFilter === 'all' || a.childId === childFilter),
      }))
      .filter((x) => x.assigns.length > 0);
  }, [tasks, selected, childFilter]);

  const isDone = (t: Task, childIds: string[]) =>
    childIds.length > 0 && childIds.every((c) => !!completions[completionKey(t.id, c, selected)]);

  const open = dayTasks.filter((x) => !isDone(x.task, x.assigns.map((a) => a.childId)));
  const done = dayTasks.filter((x) => isDone(x.task, x.assigns.map((a) => a.childId)));

  const toggleRow = (t: Task, childIds: string[]) => {
    const allDone = isDone(t, childIds);
    childIds.forEach((c) => {
      const has = !!completions[completionKey(t.id, c, selected)];
      if (allDone ? has : !has) toggleCompletion(t, c, selected);
    });
  };

  const renderRow = (x: { task: Task; assigns: Task['assignments'] }, completed: boolean) => {
    const t = x.task;
    const ids = x.assigns.map((a) => a.childId);
    const first = x.assigns[0];
    return (
      <View key={t.id} style={[styles.row, completed && styles.rowDone]}>
        <Pressable onPress={() => toggleRow(t, ids)} hitSlop={10} accessibilityLabel="Tamamlandı olarak işaretle">
          <View style={[styles.check, completed && styles.checkDone]}>
            {completed && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
        </Pressable>
        <Pressable style={{ flex: 1 }} onPress={() => navigation.navigate('TaskDetails', { taskId: t.id })}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 16, opacity: completed ? 0.5 : 1 }}>{t.emoji}</Text>
            <Text
              numberOfLines={1}
              style={[styles.rowTitle, completed && { color: colors.muted, textDecorationLine: 'line-through' }]}
            >
              {t.title}
            </Text>
          </View>
          {!!t.description && (
            <Text numberOfLines={1} style={styles.rowDesc}>{t.description}</Text>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <DifficultyBadge d={first.difficulty} coins={first.coins} />
            {t.recurring && <Ionicons name="repeat" size={13} color={colors.muted} />}
            {t.reminder && <Text style={styles.meta}>{t.reminder}</Text>}
          </View>
        </Pressable>
        <View style={{ flexDirection: 'row' }}>
          {x.assigns.slice(0, 3).map((a, i) => {
            const c = children.find((k) => k.id === a.childId);
            return c ? (
              <View key={a.childId} style={{ marginLeft: i === 0 ? 0 : -10 }}>
                <Avatar id={c.avatar} size={28} />
              </View>
            ) : null;
          })}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Görevler</Text>
        <Text style={styles.month}>{monthYear(fromISO(selected))}</Text>
      </View>

      <FlatList
        ref={listRef}
        data={weeks}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(w) => toISO(w)}
        initialScrollIndex={WEEK_RANGE}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        style={{ flexGrow: 0 }}
        renderItem={({ item: weekStart }) => (
          <View style={{ width, flexDirection: 'row', paddingHorizontal: 12 }}>
            {Array.from({ length: 7 }, (_, i) => {
              const d = addDays(weekStart, i);
              const iso = toISO(d);
              const isSel = iso === selected;
              const isToday = iso === today;
              return (
                <Pressable key={iso} style={styles.dayCell} onPress={() => setSelected(iso)}>
                  <Text style={styles.dayName}>{DAY_SHORT[i]}</Text>
                  <View
                    style={[
                      styles.dayNum,
                      isToday && !isSel && { backgroundColor: colors.today },
                      isSel && { backgroundColor: colors.navy },
                    ]}
                  >
                    <Text style={{ fontSize: 15, fontWeight: isSel || isToday ? '700' : '500', color: isSel ? '#fff' : colors.navy }}>
                      {d.getDate()}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginTop: 14 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
        <Chip label="Tümü" active={childFilter === 'all'} onPress={() => setChildFilter('all')} />
        {children.map((c) => (
          <Chip key={c.id} label={c.name} avatar={c.avatar} active={childFilter === c.id} onPress={() => setChildFilter(c.id)} />
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120, gap: 10 }}>
        {dayTasks.length === 0 && (
          <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 48 }}>
            Bu gün için görev yok.
          </Text>
        )}
        {open.map((x) => renderRow(x, false))}
        {done.length > 0 && (
          <>
            <Text style={styles.section}>Tamamlanan · {done.length}</Text>
            {done.map((x) => renderRow(x, true))}
          </>
        )}
      </ScrollView>

      <Pressable
        style={styles.fab}
        accessibilityLabel="Görev oluştur"
        onPress={() => navigation.navigate('CreateTask', { date: selected })}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </Pressable>
    </SafeAreaView>
  );
}

function Chip({ label, active, onPress, avatar }: { label: string; active: boolean; onPress: () => void; avatar?: string }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && { backgroundColor: colors.navy }]}>
      {avatar && <Avatar id={avatar} size={20} />}
      <Text style={{ fontSize: 13, fontWeight: '600', color: active ? '#fff' : colors.navy }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10 },
  title: { fontSize: 17, fontWeight: '700', color: colors.navy },
  month: { fontSize: 13, color: colors.muted, marginTop: 2 },
  dayCell: { flex: 1, alignItems: 'center', gap: 6 },
  dayName: { fontSize: 11, color: colors.muted, fontWeight: '500' },
  dayNum: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: radius.md, padding: 14 },
  rowDone: { backgroundColor: '#FAFAFB' },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.navy, flexShrink: 1 },
  rowDesc: { fontSize: 12, color: colors.muted, marginTop: 3 },
  meta: { fontSize: 11, color: colors.muted },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: colors.faint, alignItems: 'center', justifyContent: 'center' },
  checkDone: { backgroundColor: colors.navy, borderColor: colors.navy },
  section: { fontSize: 11, fontWeight: '600', color: colors.muted, letterSpacing: 0.6, marginTop: 14, textTransform: 'uppercase' },
  fab: {
    position: 'absolute', right: 20, bottom: 24, width: 60, height: 60, borderRadius: 30,
    backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
});
