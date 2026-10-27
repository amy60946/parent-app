import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { IconButton, Segmented, Avatar } from '../components/ui';
import Info from '../components/Info';
import { useStore } from '../store';
import { useParentTasks } from '../parentTasks';
import { history, balances } from '../lib/rewards';
import { giftName } from '../data/giftItems';
import { startOfWeek, toISO } from '../dates';

// Güneş Taşı hesabı (kullanıcı isteği 27 Ekim 2026): Aile › seçili kişi › Genel'den. Ebeveynin kendi taşı (parent_stone_ledger)
// ya da çocuğun taşı (sun_stone_ledger). Dönem: bu hafta / bu ay / tümü; her satırda tarih, açıklama, miktar, kalan.
type Move = { id: string; at: string; text: string; amount: number };
type Period = 'week' | 'month' | 'all';

const childReason: Record<string, string> = {
  task: 'Görev onayı', task_undo: 'Onay geri alındı', adjust: 'Düzeltme', reward: 'Ödül', penalty: 'Taş düşüldü', goal: 'Haftalık hedef',
};

export default function StonesScreen({ navigation, route }: any) {
  const childId: string | undefined = route.params?.childId;
  const { tasks, children, familyId } = useStore();
  const pt = useParentTasks();
  const child = children.find((c) => c.id === childId);
  const [period, setPeriod] = useState<Period>('week');
  const [childMoves, setChildMoves] = useState<Move[] | null>(null);
  const [childBal, setChildBal] = useState<number | null>(null);

  useEffect(() => {
    if (!childId || !familyId) return;
    history(familyId).then((rows) => setChildMoves(rows.filter((r) => r.childId === childId).map((r) => ({
      id: String(r.id), at: r.at, amount: r.amount, text: [childReason[r.reason] ?? r.reason, r.note].filter(Boolean).join(' · '),
    })))).catch(() => setChildMoves([]));
    balances([childId]).then((b) => setChildBal(b[childId] ?? 0)).catch(() => setChildBal(null));
  }, [childId, familyId]);

  const myMoves = useMemo<Move[]>(() => (childId ? [] : pt.ledger.filter((r) => r.userId === pt.me).map((r) => {
    const task = tasks.find((t) => t.id === r.ref.split('|')[0])?.title ?? 'Görev';
    const kid = children.find((c) => c.id === r.childId)?.name;
    const text = r.reason === 'task' ? task : r.reason === 'task_undo' ? `Geri alındı · ${task}` : `Hediye: ${giftName(r.itemId)}${kid ? ` → ${kid}` : ''}`;
    return { id: String(r.id), at: r.createdAt, amount: r.amount, text };
  })), [childId, pt.ledger, pt.me, tasks, children]);

  const moves = childId ? childMoves : myMoves;
  const total = childId ? childBal : pt.me ? pt.balance(pt.me) : 0;
  const from = period === 'week' ? toISO(startOfWeek(new Date())) : period === 'month' ? toISO(new Date(new Date().getFullYear(), new Date().getMonth(), 1)) : '';
  // Aynı anda yazılan hareketlerde sıra kimliğe göre (defter kimliği artan sayı)
  const order = (a: Move, b: Move) => a.at.localeCompare(b.at) || Number(a.id) - Number(b.id);
  const shown = (moves ?? []).filter((m) => m.at.slice(0, 10) >= from).sort((a, b) => order(b, a));
  const earned = shown.filter((m) => m.amount > 0).reduce((s, m) => s + m.amount, 0);
  const spent = -shown.filter((m) => m.amount < 0).reduce((s, m) => s + m.amount, 0);
  // Satırdaki "kalan": o hareketten sonraki toplam (eskiden yeniye birikir)
  const running = useMemo(() => {
    const out: Record<string, number> = {};
    let sum = 0;
    [...(moves ?? [])].sort(order).forEach((m) => { sum = Math.max(0, sum + m.amount); out[m.id] = sum; });
    return out;
  }, [moves]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <IconButton name="chevron-back" label="Geri" onPress={() => navigation.goBack()} />
        <Text style={styles.topTitle}>Güneş Taşı hesabı</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {child && <Avatar id={child.avatar} size={36} />}
          <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: colors.navy }}>{child ? child.name : 'Benim taşlarım'}</Text>
          <Info title="Güneş Taşı hesabı" text={child
            ? `${child.name} onaylanan görevlerden taş kazanır (Kolay 1, Orta 2, Zor 3; incelemede değişebilir). Ödüller ve düşülen taşlar burada görünür.`
            : 'Sana atanan görevlerde "Yaptım" dedikçe taş kazanırsın. Taşlarla Hediye dükkânından çocuğuna oyunda hediye gönderirsin.'} />
        </View>
        <Segmented options={[{ id: 'week', label: 'Bu hafta' }, { id: 'month', label: 'Bu ay' }, { id: 'all', label: 'Tümü' }]} value={period} onChange={setPeriod} />
        <View style={styles.balance}>
          <View style={styles.stone} />
          <Text style={{ fontSize: 26, fontWeight: '800', color: colors.navy }}>{total ?? '–'}</Text>
          <Text style={styles.cap}>Kullanılabilir</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={[styles.box, { backgroundColor: colors.easy.bg }]}>
            <Text style={[styles.big, { color: colors.easy.fg }]}>+{earned}</Text>
            <Text style={styles.cap}>Kazanılan</Text>
          </View>
          <View style={[styles.box, { backgroundColor: colors.hard.bg }]}>
            <Text style={[styles.big, { color: colors.hard.fg }]}>{spent ? `−${spent}` : '0'}</Text>
            <Text style={styles.cap}>{child ? 'Harcanan ve düşülen' : 'Hediyeler'}</Text>
          </View>
        </View>
        {!childId && (
          <Pressable onPress={() => navigation.navigate('GiftShop')} style={styles.shop} accessibilityRole="button">
            <Ionicons name="gift-outline" size={18} color="#fff" />
            <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: '#fff' }}>Hediye dükkânı</Text>
            <Ionicons name="chevron-forward" size={18} color="#fff" />
          </Pressable>
        )}
        <View style={styles.list}>
          <View style={[styles.line, { borderTopWidth: 0 }]}>
            <Text style={[styles.th, { width: 52 }]}>Tarih</Text>
            <Text style={[styles.th, { flex: 1 }]}>Açıklama</Text>
            <Text style={[styles.th, { width: 44, textAlign: 'right' }]}>Taş</Text>
            <Text style={[styles.th, { width: 44, textAlign: 'right' }]}>Kalan</Text>
          </View>
          {moves === null ? (
            <ActivityIndicator color={colors.navy} style={{ padding: 16 }} />
          ) : shown.length === 0 ? (
            <Text style={[styles.cap, { padding: 14, textAlign: 'center' }]}>Bu dönemde hareket yok.</Text>
          ) : shown.map((m) => (
            <View key={m.id} style={styles.line}>
              <Text style={[styles.td, { width: 52 }]}>{m.at.slice(8, 10)}.{m.at.slice(5, 7)}</Text>
              <Text style={[styles.td, { flex: 1 }]} numberOfLines={2}>{m.text}</Text>
              <Text style={[styles.td, { width: 44, textAlign: 'right', fontWeight: '700', color: m.amount > 0 ? colors.easy.fg : colors.hard.fg }]}>
                {m.amount > 0 ? `+${m.amount}` : `−${-m.amount}`}
              </Text>
              <Text style={[styles.td, { width: 44, textAlign: 'right' }]}>{running[m.id]}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  topTitle: { fontSize: 16, fontWeight: '700', color: colors.navy },
  cap: { fontSize: 12, color: colors.muted },
  balance: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: radius.md, padding: 16 },
  stone: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.gold, borderWidth: 3, borderColor: '#F6D77A' },
  box: { flex: 1, borderRadius: radius.md, padding: 14, gap: 2 },
  big: { fontSize: 20, fontWeight: '800' },
  shop: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.navy, borderRadius: radius.md, paddingHorizontal: 16, height: 52 },
  list: { backgroundColor: '#fff', borderRadius: radius.md, paddingHorizontal: 12 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  th: { fontSize: 11, fontWeight: '700', color: colors.muted },
  td: { fontSize: 13, color: colors.navy },
});
