import React, { useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, useWindowDimensions, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DraggableFlatList, { ScaleDecorator, RenderItemParams } from 'react-native-draggable-flatlist';
import ReanimatedSwipeable, { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { colors, radius } from '../theme';
import { Avatar, DifficultyBadge } from '../components/ui';
import { useStore, taskOccursOn, completionKey, Task, CompletionStatus } from '../store';
import { DAY_SHORT, addDays, fromISO, monthYear, startOfWeek, toISO, todayISO } from '../dates';
import { pendingSuggestions } from '../lib/clinic';
import NotificationBell from '../components/NotificationBell';
import { TaskDayPart, dayPartLabel, taskDayPartOf } from '../data/dayParts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TrialBanner from '../components/TrialBanner';
import { useBilling } from '../billing';
import { usePlan } from '../lib/plan';
import { useParentTasks, doneKey, ParentAssign, Member } from '../parentTasks';
import { difficultyMeta } from '../theme';

const HINT_KEY = 'hint-plus-longpress-v2';
const NEW_REWARD_KEY = 'hint-reward-new';

type PartFilter = 'all' | TaskDayPart | 'any';
const partOf = (t: Task) => t.dayPart ?? (t.reminder ? taskDayPartOf(t.reminder) : undefined);

const WEEK_RANGE = 52; // bugünden ±52 hafta

type DayItem = { task: Task; assigns: Task['assignments']; parents: ParentAssign[] }; // parents: ebeveyn atamaları (akislar.md 18)

export default function TasksScreen({ navigation, route }: any) {
  const { width } = useWindowDimensions();
  const { tasks, children, completions, reorderTasks, deleteTask, familyId, parent } = useStore();
  const pt = useParentTasks();
  // Ebeveyn kendini her zaman görür (görevi olmasa da): kendine görev atayabileceğini fark etsin (kullanıcı geri bildirimi 27 Ekim 2026)
  const showMe = pt.ready && !!pt.me;
  const plan = usePlan(); // tanışma yanıtlarına göre rutin sırası (lib/plan.ts)
  // Uzmandan bekleyen görev önerisi varsa üstte kısa bir bildirim
  const [suggested, setSuggested] = useState(0);
  useFocusEffect(React.useCallback(() => {
    if (!familyId) return;
    pendingSuggestions(familyId).then((l) => setSuggested(l.length)).catch(() => setSuggested(0));
  }, [familyId]));
  const [selected, setSelected] = useState(todayISO());
  const [childFilter, setChildFilter] = useState<string | 'all'>('all');
  // Ben › Bugünün ilerlemesi / Senin görevlerin: kişi ve gün süzgeciyle açılır ('me' = ebeveynin kendisi)
  React.useEffect(() => {
    const p = route?.params as { filter?: string; date?: string } | undefined;
    if (!p?.filter && !p?.date) return;
    if (p.filter) setChildFilter(p.filter);
    if (p.date) setSelected(p.date);
    navigation.setParams({ filter: undefined, date: undefined });
  }, [route?.params?.filter, route?.params?.date]); // eslint-disable-line react-hooks/exhaustive-deps
  const [part, setPart] = useState<PartFilter>('all');
  // + düğmesi: kısa bas → görev oluştur; basılı tut → "Ödül" ve "Gözlem notu" düğmeleri (ilk seferde ipucu)
  const [dial, setDial] = useState<'menu' | null>(null);
  const [hint, setHint] = useState(false);
  const [newReward, setNewReward] = useState(false);
  React.useEffect(() => {
    AsyncStorage.getItem(HINT_KEY).then((v) => setHint(!v)).catch(() => {});
    AsyncStorage.getItem(NEW_REWARD_KEY).then((v) => setNewReward(!v)).catch(() => {});
  }, []);
  const seenHint = () => { setHint(false); AsyncStorage.setItem(HINT_KEY, '1').catch(() => {}); };
  const seenNewReward = () => { setNewReward(false); AsyncStorage.setItem(NEW_REWARD_KEY, '1').catch(() => {}); };
  const { allow } = useBilling();
  const go = (screen: string, params?: object) => { setDial(null); navigation.navigate(screen, params); };
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
      .filter((t) => part === 'all' || (part === 'any' ? !partOf(t) : partOf(t) === part))
      .map((t) => ({
        task: t,
        assigns: childFilter === 'me' ? [] : t.assignments.filter((a) => childFilter === 'all' || a.childId === childFilter),
        // "Ben" süzgecinde yalnız bana atananlar; çocuk süzgecinde ebeveyn satırı yok
        parents: (pt.assigns[t.id] ?? []).filter((x) => childFilter === 'all' || (childFilter === 'me' && x.userId === pt.me)),
      }))
      .filter((x) => x.assigns.length > 0 || x.parents.length > 0);
  }, [tasks, selected, childFilter, part, pt.assigns, pt.me]);

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
        members={pt.members}
        me={pt.me}
        done={pt.done}
        onDone={(on) => pt.markDone(item.task.id, selected, on)}
        active={isActive}
        onDrag={drag}
        onEdit={() => edit(item.task)}
        onDelete={(close) => confirmDelete(item.task, close)}
      />
    </ScaleDecorator>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.header, { flexDirection: 'row', alignItems: 'center' }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Görevler</Text>
          <Text style={styles.month}>{monthYear(fromISO(selected))}</Text>
        </View>
        <NotificationBell />
      </View>
      <TrialBanner />
      {suggested > 0 && (
        <Pressable onPress={() => navigation.navigate('Uzmanım')} style={styles.suggest} accessibilityLabel="Uzman önerilerini gör">
          <Ionicons name="medkit-outline" size={16} color={colors.navy} />
          <Text style={{ flex: 1, fontSize: 13, color: colors.navy, fontWeight: '600' }}>Uzmanından {suggested} görev önerisi var</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.muted} />
        </Pressable>
      )}

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

      {/* Günün bölümüne göre hızlı süzgeç */}
      <View style={styles.parts}>
        {(['all', 'morning', 'noon', 'evening', 'any'] as PartFilter[]).map((p) => {
          const on = part === p;
          const label = p === 'all' ? 'Tümü' : p === 'any' ? 'Herhangi' : dayPartLabel[p];
          return (
            <Pressable key={p} onPress={() => setPart(p)} style={[styles.part, on && styles.partOn]}
              accessibilityRole="button" accessibilityState={{ selected: on }}>
              <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '600', color: on ? colors.navy : colors.muted }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ height: 50, justifyContent: 'center', marginTop: 4 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8, alignItems: 'center' }}>
          <Chip label="Tümü" active={childFilter === 'all'} onPress={() => setChildFilter('all')} />
          {/* Aile üyesi (ben) önce, çocuklar ardından (geri bildirim 28 Ekim) */}
          {showMe && <Chip label="Ben" avatar={parent.avatar} active={childFilter === 'me'} onPress={() => setChildFilter('me')} />}
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
          ) : undefined
        }
        ListEmptyComponent={
          childFilter === 'me' ? (
            <View style={{ alignItems: 'center', gap: 6, marginTop: 40, paddingHorizontal: 12 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.navy }}>Bu gün sana atanmış görev yok</Text>
              <Text style={{ fontSize: 13, color: colors.muted, textAlign: 'center' }}>
                Bir görevi açıp Ebeveynler bölümünden kendine de atayabilirsin. "Yaptım" dedikçe Güneş Taşı kazanır, çocuğuna oyunda hediye gönderirsin.
              </Text>
            </View>
          ) : tasks.length === 0 ? (
            // Ailenin hiç görevi yok: hazır rutinle başlamak tek dokunuş (kullanıcı isteği 27 Ekim 2026)
            <View style={styles.starter}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.navy }}>Bir rutinle başla</Text>
              <Text style={{ fontSize: 13, color: colors.muted }}>Birkaç görevi tek seferde ekle, sonra dilediğin gibi düzenle.</Text>
              {plan.routines.slice(0, 3).map((r) => (
                <Pressable key={r.id} onPress={() => { if (allow('task')) navigation.navigate('Routine', { id: r.id }); }}
                  style={[styles.starterRow, { backgroundColor: r.tint }]} accessibilityRole="button">
                  <Ionicons name={r.icon} size={20} color={colors.navy} />
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: colors.navy }}>{r.title}</Text>
                  {plan.recommended === r.id && <Text style={styles.forYou}>Sana önerilen</Text>}
                  <Ionicons name="chevron-forward" size={16} color={colors.navy} />
                </Pressable>
              ))}
              <Text style={{ fontSize: 12, color: colors.muted, textAlign: 'center' }}>Ya da sağ alttaki + ile tek görev ata.</Text>
            </View>
          ) : (
            <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 48 }}>
              Bu gün için görev yok.{'\n'}Sağ alttaki + ile görev ata.
            </Text>
          )
        }
      />

      {dial && <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(245,246,248,0.7)' }]} onPress={() => setDial(null)} accessibilityLabel="Kapat" />}
      {dial === 'menu' && (
        <View style={styles.dial}>
          {newReward && (
            <Pressable onPress={seenNewReward} style={styles.newTip} accessibilityLabel="İpucunu kapat">
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Yeni: Ödüller</Text>
              <Text style={{ fontSize: 12, color: '#D6DBEA' }}>Görevlerden taş kazanılır; ödülü sen belirlersin.</Text>
            </Pressable>
          )}
          <Pressable style={styles.dialItem} accessibilityLabel="Ödüller ve Güneş Taşı"
            onPress={() => { seenNewReward(); go('Rewards', childFilter !== 'all' ? { childId: childFilter } : undefined); }}>
            <Text style={styles.dialLabel}>Ödül</Text>
            <View style={styles.dialIcon}><Ionicons name="gift-outline" size={20} color={colors.navy} /></View>
          </Pressable>
          <Pressable style={styles.dialItem} accessibilityLabel="Gözlem notu ekle"
            onPress={() => go('Abc', { new: true })}>
            <Text style={styles.dialLabel}>Gözlem notu</Text>
            <View style={styles.dialIcon}><Ionicons name="create-outline" size={20} color={colors.navy} /></View>
          </Pressable>
        </View>
      )}
      {hint && !dial && (
        <Pressable style={styles.hintBubble} onPress={seenHint} accessibilityLabel="İpucunu kapat">
          <Text style={{ fontSize: 12, color: '#fff' }}>Ödül ve gözlem notu için + düğmesini basılı tut</Text>
        </Pressable>
      )}
      <Pressable
        style={styles.fab}
        accessibilityLabel="Görev oluştur. Ödül ve gözlem notu için basılı tut."
        onPress={() => { if (dial) setDial(null); else if (allow('task')) navigation.navigate('CreateTask', { date: selected }); }}
        onLongPress={() => { setDial('menu'); seenHint(); }}
        delayLongPress={350}
      >
        <Ionicons name={dial ? 'close' : 'add'} size={32} color="#fff" />
      </Pressable>
    </SafeAreaView>
  );
}

const statusMeta: Record<CompletionStatus, { label: string; bg: string; fg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  pending: { label: 'Onay bekliyor', bg: colors.medium.bg, fg: colors.medium.fg, icon: 'time-outline' },
  approved: { label: 'Tamamlandı', bg: colors.easy.bg, fg: colors.easy.fg, icon: 'checkmark-circle' },
  declined: { label: 'Yapamadı', bg: '#ECEEF3', fg: colors.muted, icon: 'remove-circle-outline' },
  rejected: { label: 'Reddedildi', bg: colors.hard.bg, fg: colors.hard.fg, icon: 'close-circle-outline' },
  retry: { label: 'Tekrar denesin', bg: colors.medium.bg, fg: colors.medium.fg, icon: 'refresh' },
};

function TaskRow({ item, date, kids, completions, members, me, done, onDone, active, onDrag, onEdit, onDelete }: {
  item: DayItem; date: string; kids: ReturnType<typeof useStore>['children'];
  completions: ReturnType<typeof useStore>['completions']; members: Member[]; me: string | null;
  done: Record<string, true>; onDone: (on: boolean) => void; active: boolean;
  onDrag: () => void; onEdit: () => void; onDelete: (close: () => void) => void;
}) {
  const swipe = useRef<SwipeableMethods>(null);
  const t = item.task;
  const first = item.assigns[0];
  const myPart = item.parents.find((x) => x.userId === me);
  const myDone = !!me && !!done[doneKey(t.id, me, date)];
  // Ebeveyn kendi görevini bir hafta geriye kadar işaretler (sunucu kuralı)
  const markable = date <= addDaysISO(todayISO(), 1) && date >= addDaysISO(todayISO(), -7);
  // Çocuk tarafındaki durum (çocuk uygulaması işaretler; ebeveyn İnceleme'den onaylar)
  const statuses = item.assigns
    .map((a) => completions[completionKey(t.id, a.childId, date)])
    .filter(Boolean) as CompletionStatus[];
  // Yalnız ebeveyne atanan görevde çocuk durumu yok (boş liste "hepsi onaylı" sayılmasın)
  const status: CompletionStatus | undefined = item.assigns.length === 0 ? undefined
    : statuses.includes('pending') ? 'pending'
      : statuses.includes('retry') ? 'retry'
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
        {/* Satıra dokunmak düzenleme açmaz (kaydırırken yanlışlıkla açılıyordu); yalnız düzenle tuşu açar */}
        <Pressable
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
              <Text numberOfLines={1} style={styles.rowTitle}>{t.title}</Text>
            </View>
            {!!t.description && <Text numberOfLines={1} style={styles.rowDesc}>{t.description}</Text>}
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
              {first ? <DifficultyBadge d={first.difficulty} coins={first.coins} /> : item.parents[0] && <StoneBadge d={item.parents[0].difficulty} />}
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
            {[
              // Ebeveynler önce, çocuklar ardından (Görevler'deki süzgeç sırasıyla aynı)
              ...item.parents.map((x) => ({ key: x.userId, avatar: members.find((m) => m.id === x.userId)?.avatar, ok: !!done[doneKey(t.id, x.userId, date)] })),
              ...item.assigns.map((a) => ({ key: a.childId, avatar: kids.find((k) => k.id === a.childId)?.avatar, ok: false })),
            ].filter((x) => x.avatar).slice(0, 4).map((x, i) => (
              <View key={x.key} style={{ marginLeft: i === 0 ? 0 : -10 }}>
                <Avatar id={x.avatar!} size={28} />
                {x.ok && <View style={styles.doneDot}><Ionicons name="checkmark" size={9} color="#fff" /></View>}
              </View>
            ))}
          </View>
          {myPart && (
            <Pressable onPress={() => markable && onDone(!myDone)} disabled={!markable} hitSlop={8}
              accessibilityRole="checkbox" accessibilityState={{ checked: myDone, disabled: !markable }}
              accessibilityLabel={myDone ? 'Yaptım işaretini kaldır' : 'Yaptım'}
              style={[styles.myDone, myDone && styles.myDoneOn, !markable && { opacity: 0.35 }]}>
              <Ionicons name="checkmark" size={18} color={myDone ? '#fff' : colors.faint} />
            </Pressable>
          )}
          <Pressable onPress={onEdit} hitSlop={8} accessibilityLabel="Görevi düzenle" style={styles.editBtn}>
            <Ionicons name="create-outline" size={18} color={colors.navy} />
          </Pressable>
        </Pressable>
      </ReanimatedSwipeable>
    </View>
  );
}

// Ebeveyn görevinde ödül: zorluğa göre Güneş Taşı (kolay 1 / orta 2 / zor 3)
const STONE_BY: Record<string, number> = { easy: 1, medium: 2, hard: 3 };
function StoneBadge({ d }: { d: ParentAssign['difficulty'] }) {
  const c = d === 'easy' ? colors.easy : d === 'medium' ? colors.medium : colors.hard;
  return (
    <View style={[styles.status, { backgroundColor: c.bg }]}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: c.fg }}>{difficultyMeta[d].label} · {STONE_BY[d]} taş</Text>
    </View>
  );
}

const addDaysISO = (iso: string, n: number) => toISO(addDays(fromISO(iso), n));

function Chip({ label, active, onPress, avatar }: { label: string; active: boolean; onPress: () => void; avatar?: string }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && { backgroundColor: colors.navy }]}>
      {avatar && <Avatar id={avatar} size={20} />}
      <Text style={{ fontSize: 13, fontWeight: '600', color: active ? '#fff' : colors.navy }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  starter: { backgroundColor: '#fff', borderRadius: radius.lg, padding: 16, gap: 10, marginTop: 12 },
forYou: { fontSize: 11, fontWeight: '700', color: colors.navy, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
    starterRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: radius.md, paddingHorizontal: 14, height: 48 },
  suggest: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginBottom: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.md, backgroundColor: '#FFF6DE' },
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10 },
  parts: { flexDirection: 'row', marginHorizontal: 20, marginTop: 10, padding: 3, borderRadius: radius.pill, backgroundColor: '#E9EBF0' },
  part: { flex: 1, height: 30, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  partOn: { backgroundColor: '#fff' },
  badge: { position: 'absolute', top: -6, right: -8, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 10, fontWeight: '800', color: colors.navy },
  title: { fontSize: 17, fontWeight: '700', color: colors.navy },
  month: { fontSize: 13, color: colors.muted, marginTop: 2 },
  dayCell: { flex: 1, alignItems: 'center', gap: 6 },
  dayName: { fontSize: 11, color: colors.muted, fontWeight: '500' },
  dayNum: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: radius.md, paddingVertical: 14, paddingLeft: 8, paddingRight: 10 },
  rowActive: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  handle: { width: 28, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  doneDot: { position: 'absolute', right: -2, bottom: -2, width: 14, height: 14, borderRadius: 7, backgroundColor: colors.easy.fg, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#fff' },
  myDone: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: colors.faint, alignItems: 'center', justifyContent: 'center' },
  myDoneOn: { backgroundColor: colors.easy.fg, borderColor: colors.easy.fg },
  editBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F1F2F6', alignItems: 'center', justifyContent: 'center' },
  deleteAction: { width: 84, marginLeft: 10, borderRadius: radius.md, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  hint: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 10 },
  hintText: { fontSize: 11, color: colors.muted },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.navy, flexShrink: 1 },
  rowDesc: { fontSize: 12, color: colors.muted, marginTop: 3 },
  meta: { fontSize: 11, color: colors.muted },
  dial: { position: 'absolute', right: 20, bottom: 96, alignItems: 'flex-end', gap: 12 },
  dialItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dialLabel: { fontSize: 14, fontWeight: '700', color: colors.navy, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.sm, overflow: 'hidden' },
  dialIcon: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginRight: 6,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 5,
  },
  newTip: { maxWidth: 250, gap: 2, padding: 12, borderRadius: radius.md, backgroundColor: colors.navy, marginRight: 6 },
  hintBubble: { position: 'absolute', right: 90, bottom: 36, maxWidth: 220, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md, backgroundColor: colors.navy },
  fab: {
    position: 'absolute', right: 20, bottom: 24, width: 60, height: 60, borderRadius: 30,
    backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
});
