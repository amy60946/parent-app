import React, { useEffect, useState } from 'react';
import Info from '../components/Info';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert } from 'react-native';
import NotificationBell from '../components/NotificationBell';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { Avatar } from '../components/ui';
import Sheet from '../components/Sheet';
import Dialog from '../components/Dialog';
import PushAsk from '../components/PushAsk';
import { useStore, Task, Child, ReviewDecision, ReviewExtra } from '../store';
import { formatTR, todayISO } from '../dates';
import { supabase } from '../lib/supabase';
import { shouldAskPush } from '../lib/notifications';
import { isFirstApproval } from '../lib/firsts';
import { afterModal } from '../lib/modal';

type Item = { key: string; task: Task; child: Child; date: string };

// Güneş Taşı varsayılanı zorluğa göre (ortak/sozlesme/ekonomi.md 5A); incelemede 0–6 arası değişir
const STONES = { easy: 1, medium: 2, hard: 3 } as const;
const MAX_STONES = 6;
const NOTE_MAX = 140;

export default function ReviewScreen() {
  const { tasks, children, completions, review } = useStore();
  const [filter, setFilter] = useState<string | 'all'>('all');
  const [open, setOpen] = useState<Item | null>(null); // ayrıntısı açık tamamlama
  const [ask, setAsk] = useState<Item | null>(null); // bildirim ön sorusu, ardından ayrıntı açılır
  const [party, setParty] = useState<string | null>(null); // ilk onay kutlaması (çocuğun adı)

  const pending = Object.entries(completions)
    .filter(([, s]) => s === 'pending')
    .map(([key]) => {
      const [taskId, childId, date] = key.split('|');
      return { key, task: tasks.find((t) => t.id === taskId), child: children.find((c) => c.id === childId), date };
    })
    .filter((x): x is Item => !!x.task && !!x.child && (filter === 'all' || x.child.id === filter));

  const openDetail = async (x: Item) => {
    if (await shouldAskPush()) setAsk(x);
    else setOpen(x);
  };

  const decide = async (x: Item, decision: ReviewDecision, extra?: ReviewExtra) => {
    const ok = await review(x.key, decision, extra);
    if (!ok) return false;
    setOpen(null);
    // Sayfa kapanırken ikinci pencere açılamaz (iOS): kapanış bitince kutlama
    if (decision === 'approved' && (await isFirstApproval())) afterModal(() => setParty(x.child.name));
    return true;
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={{ alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 4 }}>
        <NotificationBell />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Pressable onPress={() => setFilter('all')} style={{ alignItems: 'center', gap: 4 }}>
          <View style={[styles.all, filter === 'all' && { borderWidth: 2, borderColor: colors.navy }]}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Tümü</Text>
          </View>
        </Pressable>
        {children.map((c) => (
          <Pressable key={c.id} onPress={() => setFilter(c.id)} style={{ alignItems: 'center', gap: 4, opacity: filter === 'all' || filter === c.id ? 1 : 0.5 }}>
            <Avatar id={c.avatar} size={48} ring={filter === c.id} />
            <Text style={{ fontSize: 11, color: colors.navy, fontWeight: '600' }}>{c.name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20 }}>
        <Text style={styles.title}>İnceleme</Text>
        <Info title="İnceleme" text="Göreve dokun: motive etmek ne kadar zordu, Güneş Taşı, not; ardından Onayla, Tekrar dene ya da Reddet. Sağdaki ✓ hızlı onaydır (taş zorluğa göre)." />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 10 }}>
        {pending.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ color: colors.muted, textAlign: 'center', fontSize: 13 }}>
              Onay bekleyen görev yok.
            </Text>
          </View>
        ) : (
          pending.map((x) => (
            <Pressable key={x.key} onPress={() => openDetail(x)} style={styles.row} accessibilityRole="button" accessibilityLabel={`${x.task.title}, ${x.child.name}: incele`}>
              <Avatar id={x.child.avatar} size={36} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '600', color: colors.navy }}>
                  {x.task.title}
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                  {x.child.name} · {formatTR(x.date)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.faint} />
              <Pressable onPress={() => decide(x, 'approved')} style={[styles.btn, { backgroundColor: colors.navy }]} accessibilityLabel="Hızlı onayla" hitSlop={6}>
                <Ionicons name="checkmark" size={20} color="#fff" />
              </Pressable>
            </Pressable>
          ))
        )}
      </ScrollView>
      {open && <ReviewSheet item={open} onClose={() => setOpen(null)} onDecide={(d, e) => decide(open, d, e)} />}
      <PushAsk visible={!!ask} childName={ask?.child.name} onDone={() => { const x = ask; setAsk(null); if (x) afterModal(() => setOpen(x)); }} />
      <Dialog
        visible={!!party}
        icon="trophy-outline"
        badge="sparkles"
        title="İlk onayın tamam!"
        text={`${party ?? ''} Pofi Adası'nı açınca onayı kutlamayla görecek; coin ve Güneş Taşları hesabına geçer.`}
        primary="Harika"
        onPrimary={() => setParty(null)}
      />
    </SafeAreaView>
  );
}

// İnceleme ayrıntısı (ortak/sozlesme/akislar.md 3, 9c–9d): zorluk (uzmana akar), taş ±, not, Reddet / Tekrar dene / Onayla.
function ReviewSheet({ item, onClose, onDecide }: {
  item: Item; onClose: () => void; onDecide: (d: ReviewDecision, e: ReviewExtra) => Promise<boolean>;
}) {
  const { task, child, date } = item;
  const base = STONES[task.assignments.find((a) => a.childId === child.id)?.difficulty ?? 'easy'];
  const [motivation, setMotivation] = useState<number | null>(null);
  const [stones, setStones] = useState<number>(base);
  const [note, setNote] = useState('');
  const [doneAt, setDoneAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const today = date === todayISO();

  useEffect(() => {
    supabase.from('completions').select('child_done_at').match({ task_id: task.id, child_id: child.id, date }).maybeSingle()
      .then(({ data }) => setDoneAt((data as any)?.child_done_at ?? null));
  }, [task.id, child.id, date]);

  const go = async (d: ReviewDecision) => {
    if (d === 'retry' && !today) {
      Alert.alert('Yalnız bugünün görevi', 'Geçmiş günün görevi oyunda kapanmış olur; tekrar denenemez. Onaylayabilir ya da reddedebilirsin.');
      return;
    }
    setBusy(true);
    await onDecide(d, { note, motivation, stones: stones === base ? null : stones });
    setBusy(false);
  };

  const time = doneAt ? new Date(doneAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : null;
  return (
    <Sheet
      visible
      title="Görevi incele"
      onClose={onClose}
      footer={
        <View style={styles.actions}>
          <ActionButton icon="thumbs-down-outline" label="Reddet" color={colors.danger} onPress={() => go('rejected')} disabled={busy} />
          <ActionButton icon="refresh" label="Tekrar dene" color={colors.navy} onPress={() => go('retry')} disabled={busy} dim={!today} />
          <Pressable onPress={() => go('approved')} disabled={busy} style={[styles.approve, busy && { opacity: 0.6 }]} accessibilityRole="button" accessibilityLabel="Onayla">
            <Ionicons name="thumbs-up" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Onayla</Text>
          </Pressable>
        </View>
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Avatar id={child.avatar} size={40} />
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.navy }}>{child.name}</Text>
      </View>
      <View style={styles.taskCard}>
        <Text style={styles.cap}>{today ? 'Bugünün görevi' : formatTR(date)}</Text>
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.navy }}>{task.title}</Text>
        {time && <Text style={styles.cap}>Yaptım dedi: {time}</Text>}
      </View>

      <View style={{ gap: 8 }}>
        <View style={styles.headRow}>
          <Text style={[styles.h, { flex: 1 }]}>Motive etmek ne kadar zordu?</Text>
          <Info title="Motive etmek ne kadar zordu?" text="İsteğe bağlı. Hangi görevlerde desteğe ihtiyaç olduğunu zamanla gösterir; uzmanla paylaşım açıksa uzmanın da görür. Bir puan ya da tanı değildir; çocuğun görmez." />
        </View>
        <View style={styles.scale} accessibilityRole="adjustable" accessibilityLabel="Motive etme zorluğu" accessibilityValue={{ text: motivation ? `${motivation} / 5` : 'seçilmedi' }}>
          <View style={styles.track} />
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} onPress={() => setMotivation(n)} hitSlop={10} accessibilityLabel={`${n}`}
              style={[styles.dot, motivation != null && n <= motivation && styles.dotOn, motivation === n && styles.dotSel]} />
          ))}
        </View>
        <View style={{ flexDirection: 'row' }}>
          <Text style={[styles.cap, { flex: 1 }]}>Çok kolay</Text>
          <Text style={styles.cap}>Çok zor</Text>
        </View>
        {motivation != null && (
          <Pressable onPress={() => setMotivation(null)} hitSlop={8} style={{ alignSelf: 'flex-end' }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.danger }}>Temizle</Text>
          </Pressable>
        )}
      </View>

      <View style={{ gap: 8 }}>
        <View style={styles.headRow}>
          <Text style={[styles.h, { flex: 1 }]}>Güneş Taşı</Text>
          <Info title="Güneş Taşı" text={`Onaylayınca ${child.name} bu kadar taş kazanır. Varsayılan zorluğa göre: Kolay 1, Orta 2, Zor 3. Özenle yaptıysa artır, eksik kaldıysa azalt (0–${MAX_STONES}). Coin ödülü değişmez.`} />
        </View>
        <View style={styles.stepper}>
          <Pressable onPress={() => setStones((n) => Math.max(0, n - 1))} disabled={stones <= 0} style={[styles.step, stones <= 0 && { opacity: 0.35 }]} accessibilityLabel="Azalt">
            <Ionicons name="remove" size={20} color="#fff" />
          </Pressable>
          <View style={styles.stepVal}>
            <View style={styles.stone} />
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.navy }}>{stones}</Text>
          </View>
          <Pressable onPress={() => setStones((n) => Math.min(MAX_STONES, n + 1))} disabled={stones >= MAX_STONES} style={[styles.step, stones >= MAX_STONES && { opacity: 0.35 }]} accessibilityLabel="Artır">
            <Ionicons name="add" size={20} color="#fff" />
          </Pressable>
        </View>
        {stones !== base && <Text style={[styles.cap, { textAlign: 'center' }]}>Zorluğa göre {base}</Text>}
      </View>

      <View style={{ gap: 6 }}>
        <View style={styles.headRow}>
          <Text style={[styles.h, { flex: 1 }]}>{child.name} için not</Text>
          <Info title="Not" text="Not, kararla birlikte çocuğun oyununda görünür. Tekrar dene ya da Reddet seçersen ne yapması gerektiğini kısaca yaz." />
        </View>
        <TextInput
          value={note}
          onChangeText={(v) => setNote(v.slice(0, NOTE_MAX))}
          placeholder="Örn. Yatağı da toplarsan tamam"
          placeholderTextColor={colors.muted}
          multiline
          style={styles.input}
        />
        <Text style={[styles.cap, { alignSelf: 'flex-end' }]}>{note.length}/{NOTE_MAX}</Text>
      </View>
    </Sheet>
  );
}

function ActionButton({ icon, label, color, onPress, disabled, dim }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; color: string; onPress: () => void; disabled?: boolean; dim?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.action, dim && { opacity: 0.45 }]} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={{ fontSize: 12, fontWeight: '700', color }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  all: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '700', color: colors.navy },
  empty: { backgroundColor: '#fff', borderRadius: radius.lg, padding: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: radius.md, padding: 14 },
  btn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1F2F6', alignItems: 'center', justifyContent: 'center' },
  taskCard: { backgroundColor: '#FFF6DF', borderRadius: radius.md, padding: 14, gap: 4 },
  cap: { fontSize: 12, color: colors.muted },
  h: { fontSize: 14, fontWeight: '700', color: colors.navy },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scale: { height: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  track: { position: 'absolute', left: 12, right: 12, height: 6, borderRadius: 3, backgroundColor: '#E3E6EF' },
  dot: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', borderWidth: 2, borderColor: '#C9CEDC' },
  dotOn: { backgroundColor: colors.today, borderColor: colors.navy },
  dotSel: { backgroundColor: colors.navy, transform: [{ scale: 1.15 }] },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  step: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  stepVal: { flex: 1, height: 40, borderRadius: radius.sm, backgroundColor: '#F3F4F8', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  stone: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.gold, borderWidth: 2, borderColor: '#F6D77A' },
  input: { letterSpacing: 0, backgroundColor: '#F3F4F8', borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.navy, minHeight: 64, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: 8, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, marginTop: 10 },
  action: { flex: 1, height: 56, borderRadius: radius.md, backgroundColor: '#F1F2F6', alignItems: 'center', justifyContent: 'center', gap: 2 },
  approve: { flex: 1.6, height: 56, borderRadius: radius.md, backgroundColor: colors.navy, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
