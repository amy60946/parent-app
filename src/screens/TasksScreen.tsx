import React, { useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, useWindowDimensions, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DraggableFlatList, { ScaleDecorator, RenderItemParams } from 'react-native-draggable-flatlist';
import ReanimatedSwipeable, { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { colors, radius } from '../theme';
import { Avatar, DifficultyBadge } from '../components/ui';
import { useStore, taskOccursOn, completionKey, Task, CompletionStatus } from '../store';
import { DAY_SHORT, addDays, fromISO, monthYear, startOfWeek, toISO, todayISO } from '../dates';

const WEEK_RANGE = 52; // bugünden ±52 hafta

type DayItem = { task: Task; assigns: Task['assignments'] };

export default function TasksScreen({ navigation }: any) {
  const { width } = useWindowDimensions();
  const { tasks, children, completions, reorderTasks, deleteTask } = useStore();
  const [selected, setSelected] = useState(todayISO());
  const [childFilter, setChildFilter] = useState<string | 'all'>('all');
  const listRef = useRef<FlatList>(null);

  const weeks = useMemo(() => {
    const base = startOfWeek(new Date());
    return Array.from({ length: WEEK_RANGE * 2 + 1 }, (_, i) => addDays(base, (i - WEEK_RANGE) * 7));
  }, []);

  const today = todayISO();

  // tasks zaten sıra değerine göre dizili geliyor
  const dayTasks = useMemo<DayItem[]>(() => {
    return tasks
      .filter((t) => taskOccursOn(t, selected))
      .map((t) => ({
        task: t,
        assigns: t.assignments.filter((a) => childFilter === 'all' || a.childId === childFilter),
      }))
      .filter((x) => x.assigns.length > 0);
  }, [tasks, selected, childFilter]);

  const edit = (t: Task) => navigation.navigate('TaskDetails', { taskId: t.id });

  const confirmDelete = (t: Task, close: () => void) => {
    Alert.alert(
      'Görev silinsin mi?',
      t.recurring ? 'Bu tekrarlayan görev tüm günlerden silinir.' : 'Bu işlem geri alınamaz.',
      [
        { text: 'Vazgeç', style: 'cancel', onPress: close },
        { text: 'Sil', style: 'destructive', onPress: () => deleteTask(t.id) },
      ],
      { cancelable: true, onDismiss: close },
    );
  };

  const renderItem = ({ item, drag, isActive }: RenderItemParams<DayItem>) => (
    <ScaleDecorator activeScale={1.03}>
      <TaskRow
        item={item}
        date={selected}
        kids={children}
        completions={completions}
        active={isActive}
        onDrag={drag}
        onEdit={() => edit(item.task)}
        onDelete={(close) => confirmDelete(item.task, close)}
      />
    </ScaleDecorator>
  );

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
        style={{ flexGrow: 0, flexShrink: 0 }}
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

      <View style={{ height: 50, justifyContent: 'center', marginTop: 8 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8, alignItems: 'center' }}>
          <Chip label="Tümü" active={childFilter === 'all'} onPress={() => setChildFilter('all')} />
          {children.map((c) => (
            <Chip key={c.id} label={c.name} avatar={c.avatar} active={childFilter === c.id} onPress={() => setChildFilter(c.id)} />
          ))}
        </ScrollView>
      </View>

      <DraggableFlatList
        data={dayTasks}
        keyExtractor={(x) => x.task.id}
        renderItem={renderItem}
        onDragEnd={({ data }) => reorderTasks(data.map((x) => x.task.id))}
        activationDistance={12}
        containerStyle={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 120 }}
        ListHeaderComponent={
          dayTasks.length > 0 ? (
            <View style={styles.hint}>
              <Ionicons name="reorder-three" size={16} color={colors.muted} />
              <Text style={styles.hintText}>Sıralamak için basılı tut ve sürükle</Text>
              <Ionicons name="arrow-back" size={13} color={colors.muted} style={{ marginLeft: 8 }} />
              <Text style={styles.hintText}>Silmek için sola kaydır</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 48 }}>
            Bu gün için görev yok.{'\n'}Sağ alttaki + ile görev ata.
          </Text>
        }
      />

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

const statusMeta: Record<CompletionStatus, { label: string; bg: string; fg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  pending: { label: 'Onay bekliyor', bg: colors.medium.bg, fg: colors.medium.fg, icon: 'time-outline' },
  approved: { label: 'Tamamlandı', bg: colors.easy.bg, fg: colors.easy.fg, icon: 'checkmark-circle' },
  declined: { label: 'Yapamadı', bg: '#ECEEF3', fg: colors.muted, icon: 'remove-circle-outline' },
  rejected: { label: 'Reddedildi', bg: colors.hard.bg, fg: colors.hard.fg, icon: 'close-circle-outline' },
};

function TaskRow({ item, date, kids, completions, active, onDrag, onEdit, onDelete }: {
  item: DayItem; date: string; kids: ReturnType<typeof useStore>['children'];
  completions: ReturnType<typeof useStore>['completions']; active: boolean;
  onDrag: () => void; onEdit: () => void; onDelete: (close: () => void) => void;
}) {
  const swipe = useRef<SwipeableMethods>(null);
  const t = item.task;
  const first = item.assigns[0];
  // Çocuk tarafındaki durum (çocuk uygulaması işaretler; ebeveyn İnceleme'den onaylar)
  const statuses = item.assigns
    .map((a) => completions[completionKey(t.id, a.childId, date)])
    .filter(Boolean) as CompletionStatus[];
  const status: CompletionStatus | undefined =
    statuses.includes('pending') ? 'pending'
      : statuses.length === item.assigns.length && statuses.every((x) => x === 'approved') ? 'approved'
      : statuses.includes('rejected') ? 'rejected'
      : statuses.includes('declined') ? 'declined' : undefined;

  return (
    <View style={{ marginBottom: 10 }}>
      <ReanimatedSwipeable
        ref={swipe}
        friction={1.5}
        rightThreshold={40}
        overshootRight={false}
        enabled={!active}
        renderRightActions={() => (
          <Pressable
            onPress={() => onDelete(() => swipe.current?.close())}
            accessibilityLabel="Görevi sil"
            style={styles.deleteAction}
          >
            <Ionicons name="trash-outline" size={22} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700', marginTop: 2 }}>Sil</Text>
          </Pressable>
        )}
      >
        <Pressable
          onPress={onEdit}
          onLongPress={onDrag}
          delayLongPress={250}
          disabled={active}
          style={[styles.row, active && styles.rowActive]}
        >
          <Pressable onPressIn={onDrag} hitSlop={10} accessibilityLabel="Sırayı değiştirmek için sürükle" style={styles.handle}>
            <Ionicons name="reorder-three" size={24} color={colors.faint} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 16 }}>{t.emoji}</Text>
              <Text numberOfLines={1} style={styles.rowTitle}>{t.title}</Text>
            </View>
            {!!t.description && <Text numberOfLines={1} style={styles.rowDesc}>{t.description}</Text>}
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
              <DifficultyBadge d={first.difficulty} coins={first.coins} />
              {t.recurring && <Ionicons name="repeat" size={13} color={colors.muted} />}
              {t.reminder && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <Ionicons name="alarm-outline" size={12} color={colors.muted} />
                  <Text style={styles.meta}>{t.reminder}</Text>
                </View>
              )}
              {status && (
                <View style={[styles.status, { backgroundColor: statusMeta[status].bg }]}>
                  <Ionicons name={statusMeta[status].icon} size={12} color={statusMeta[status].fg} />
                  <Text style={{ fontSize: 11, fontWeight: '600', color: statusMeta[status].fg }}>{statusMeta[status].label}</Text>
                </View>
              )}
            </View>
          </View>
          <View style={{ flexDirection: 'row' }}>
            {item.assigns.slice(0, 3).map((a, i) => {
              const c = kids.find((k) => k.id === a.childId);
              return c ? (
                <View key={a.childId} style={{ marginLeft: i === 0 ? 0 : -10 }}>
                  <Avatar id={c.avatar} size={28} />
                </View>
              ) : null;
            })}
          </View>
          <Pressable onPress={onEdit} hitSlop={8} accessibilityLabel="Görevi düzenle" style={styles.editBtn}>
            <Ionicons name="create-outline" size={18} color={colors.navy} />
          </Pressable>
        </Pressable>
      </ReanimatedSwipeable>
    </View>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: radius.md, paddingVertical: 14, paddingLeft: 8, paddingRight: 10 },
  rowActive: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  handle: { width: 28, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  editBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F1F2F6', alignItems: 'center', justifyContent: 'center' },
  deleteAction: { width: 84, marginLeft: 10, borderRadius: radius.md, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  hint: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 10 },
  hintText: { fontSize: 11, color: colors.muted },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.navy, flexShrink: 1 },
  rowDesc: { fontSize: 12, color: colors.muted, marginTop: 3 },
  meta: { fontSize: 11, color: colors.muted },
  fab: {
    position: 'absolute', right: 20, bottom: 24, width: 60, height: 60, borderRadius: 30,
    backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
});
