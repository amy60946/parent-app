import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius } from '../theme';
import { useStore } from '../store';
import { useAuth } from '../lib/auth';
import { hasRewards } from '../lib/rewards';
import { track } from '../lib/track';
import { todayISO } from '../dates';

// Ben › "İlk adımlar" (kullanıcı kararı 3 Kasım 2026; benchmark: kurulum kontrol listesi + ilerleme göstergesi,
// "yaparak öğren"). Yeni hesapta (ilk 30 gün) görünür; her satır ilgili ekranı açar, yapılınca kendiliğinden işaretlenir.
// Zorunlu 5 adım bitince kaybolur. Uzman isteğe bağlıdır, sayıya girmez.
// 3 Kasım 2026 (kullanıcı isteği): çarpı yok; başlıktaki ok kartı daraltır/açar (daraltılınca başlık + sayı + çubuk kalır),
// böylece ebeveyn kalan adımları her zaman görebilir. Eski "gizle" kaydı (HIDE_KEY) daraltılmış olarak açılır.
const HIDE_KEY = (uid: string) => `first-steps-hidden-${uid}`;
const DONE_KEY = (uid: string) => `first-steps-done-${uid}`;
const NEW_DAYS = 30;

type Item = { key: string; title: string; sub: string; done: boolean; optional?: boolean; go: () => void };

export default function FirstSteps({ navigation, hasClinician }: { navigation: any; hasClinician: boolean }) {
  const { children, tasks, completions, familyId } = useStore();
  const { session } = useAuth();
  const uid = session?.user.id ?? '';
  const created = session?.user.created_at ? new Date(session.user.created_at).getTime() : 0;
  const isNew = !!created && Date.now() - created < NEW_DAYS * 864e5;
  const [hidden, setHidden] = useState<boolean | null>(null); // yalnız "hepsi bitti" kaydı
  const [open, setOpen] = useState(true);
  const [rewards, setRewards] = useState(false);

  useEffect(() => {
    if (!uid) return;
    AsyncStorage.multiGet([HIDE_KEY(uid), DONE_KEY(uid)])
      .then(([[, h], [, d]]) => { setOpen(h !== '1'); setHidden(d === '1'); }).catch(() => setHidden(false));
  }, [uid]);
  // Ödül başka ekranda eklenir: Ben'e her dönüşte yeniden bak
  useFocusEffect(useCallback(() => {
    if (!familyId || !isNew || hidden !== false) return;
    hasRewards(familyId).then(setRewards).catch(() => {});
  }, [familyId, isNew, hidden]));

  const kids = children.length > 0;
  const items: Item[] = [
    { key: 'child', title: 'Çocuğunu ekle', sub: 'Adı ve avatarı yeter', done: kids,
      go: () => navigation.navigate('Aile', { add: Date.now() }) },
    { key: 'link', title: 'Oyuna bağla', sub: 'Çocuğunun cihazında kodu yaz ya da QR\'ı okut', done: children.some((c) => c.linked),
      go: () => (kids ? navigation.navigate('DeviceSetup') : navigation.navigate('Aile', { add: Date.now() })) },
    { key: 'task', title: 'İlk rutini ekle', sub: 'Hazır rutinle birkaç adım tek seferde', done: tasks.length > 0,
      go: () => navigation.navigate('CreateTask', { date: todayISO() }) },
    { key: 'approve', title: 'İlk onayı yap', sub: 'Çocuğun "Yaptım" deyince Onay bekleyen\'den', done: Object.values(completions).includes('approved'),
      go: () => navigation.navigate('Review') },
    { key: 'reward', title: 'Bir ödül belirle', sub: 'Güneş Taşı yetince oyundan ister', done: rewards,
      go: () => navigation.navigate('Rewards') },
    { key: 'clinic', title: 'Uzmanını bağla', sub: 'Uzmanından aldığın kodla', done: hasClinician, optional: true,
      go: () => navigation.navigate('Uzmanım') },
  ];
  const required = items.filter((i) => !i.optional);
  const doneCount = required.filter((i) => i.done).length;
  const allDone = doneCount === required.length;

  // Zorunlu adımlar bitince bir kez kaydet ve bir daha gösterme
  useEffect(() => {
    if (!uid || !isNew || hidden !== false || !allDone) return;
    track('first_steps.complete');
    AsyncStorage.setItem(DONE_KEY(uid), '1').catch(() => {});
    setHidden(true);
  }, [allDone, uid, isNew, hidden]);

  if (!isNew || hidden !== false || allDone) return null;

  const toggle = () => {
    const next = !open;
    track(next ? 'first_steps.expand' : 'first_steps.collapse', { n: doneCount });
    setOpen(next);
    (next ? AsyncStorage.removeItem(HIDE_KEY(uid)) : AsyncStorage.setItem(HIDE_KEY(uid), '1')).catch(() => {});
  };
  const go = (i: Item) => { track('first_steps.open', { item: i.key }); i.go(); };
  const pct = Math.round((doneCount / required.length) * 100);

  return (
    <View style={styles.card} accessibilityLabel={`İlk adımlar, ${required.length} adımdan ${doneCount} tamam`}>
      <Pressable onPress={toggle} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
        accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={open ? 'İlk adımları daralt' : 'İlk adımları aç'}>
        <Text style={[styles.h, { flex: 1 }]} accessibilityRole="header">İlk adımlar</Text>
        <Text style={styles.count}>{doneCount} / {required.length}</Text>
        <View style={styles.toggle}><Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.navy} /></View>
      </Pressable>
      <View style={styles.bar}><View style={[styles.barFill, { width: `${pct}%` }]} /></View>
      {open && items.map((i) => (
        <React.Fragment key={i.key}>
        {i.optional && <Text style={styles.optional}>İsteğe bağlı</Text>}
        <Pressable onPress={() => go(i)} disabled={i.done} style={styles.row}
          accessibilityRole="button" accessibilityState={{ disabled: i.done, checked: i.done }} accessibilityLabel={`${i.title}${i.done ? ', tamam' : ''}`}>
          <View style={[styles.dot, i.done && styles.dotOn]}>
            {i.done && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
          <View style={{ flex: 1, gap: 1 }}>
            <Text style={[styles.title, i.done && styles.titleDone]}>{i.title}</Text>
            {!i.done && <Text style={styles.sub} numberOfLines={2}>{i.sub}</Text>}
          </View>
          {!i.done && <Ionicons name="chevron-forward" size={16} color={colors.faint} />}
        </Pressable>
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: 16, gap: 8, borderWidth: 1.5, borderColor: '#F3DFA6' },
  h: { fontSize: 17, fontWeight: '800', color: colors.navy },
  toggle: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#FFF6DE', alignItems: 'center', justifyContent: 'center' },
  count: { fontSize: 12, fontWeight: '700', color: '#6B5300', backgroundColor: '#FFF6DE', borderRadius: 10, paddingVertical: 3, paddingHorizontal: 9, overflow: 'hidden' },
  bar: { height: 6, borderRadius: 3, backgroundColor: '#EEF0F5', overflow: 'hidden', marginBottom: 2 },
  barFill: { height: 6, borderRadius: 3, backgroundColor: colors.gold },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  dot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  dotOn: { backgroundColor: '#3FA98D', borderColor: '#3FA98D' },
  title: { fontSize: 15, fontWeight: '600', color: colors.navy },
  titleDone: { color: colors.muted, textDecorationLine: 'line-through' },
  sub: { fontSize: 12, lineHeight: 16, color: colors.muted },
  optional: { fontSize: 11, fontWeight: '700', color: colors.muted, marginTop: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: 8 },
});
