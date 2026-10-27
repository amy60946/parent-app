import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { Avatar, IconButton, Segmented } from '../components/ui';
import Info from '../components/Info';
import Dialog from '../components/Dialog';
import { useStore } from '../store';
import { useParentTasks } from '../parentTasks';
import { supabase } from '../lib/supabase';
import { giftItems, giftKinds, giftName, GiftKind } from '../data/giftItems';
import { track } from '../lib/track';

// Hediye dükkânı (kullanıcı isteği 27 Ekim 2026; ortak akislar.md 18): ebeveyn görevlerinden kazanılan taşla çocuğa oyunda eşya.
// Liste ve fiyat sunucudan (gift_items), ad ve simge uygulamada (data/giftItems). Gönderilen hediye oyunda posta kutusuna düşer.
type Item = { id: string; stones: number };
const NOTE_MAX = 140;

export default function GiftShopScreen({ navigation }: any) {
  const { children } = useStore();
  const pt = useParentTasks();
  const [items, setItems] = useState<Item[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [kid, setKid] = useState(children[0]?.id);
  const [kind, setKind] = useState<GiftKind | 'all'>('all');
  const [pick, setPick] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const bal = pt.me ? pt.balance(pt.me) : 0;

  useEffect(() => {
    supabase.from('gift_items').select('item_id, stones, sort').order('sort').then(({ data, error }) => {
      if (error) { setFailed(true); setItems([]); return; }
      setItems((data as any[]).map((r) => ({ id: r.item_id, stones: r.stones })));
    });
  }, []);

  const list = useMemo(() => (items ?? []).filter((i) => kind === 'all' || giftItems[i.id]?.kind === kind), [items, kind]);
  const chosen = items?.find((i) => i.id === pick);
  const child = children.find((c) => c.id === kid);

  const send = async () => {
    if (!chosen || !child) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('send_gift', { p_child_id: child.id, p_item_id: chosen.id, p_note: note.trim() || null });
    setBusy(false);
    if (error) return Alert.alert('Gönderilemedi', error.message);
    const r = data as { ok: boolean; error?: string };
    if (!r.ok) return Alert.alert(r.error === 'not_enough_stones' ? 'Taş yetmiyor' : 'Gönderilemedi',
      r.error === 'not_enough_stones' ? 'Sana atanan görevlerde "Yaptım" diyerek taş kazanabilirsin.' : 'Bu eşya artık dükkânda yok.');
    track('gift.send', { item: chosen.id, stones: chosen.stones });
    pt.reload();
    setSent(`${child.name} Pofi Adası'nı açınca ${giftName(chosen.id)} posta kutusunda olacak.`);
    setPick(null); setNote('');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <IconButton name="chevron-back" label="Geri" onPress={() => navigation.goBack()} />
        <Text style={styles.topTitle}>Hediye dükkânı</Text>
        <View style={styles.bal} accessibilityLabel={`Bakiye ${bal} taş`}>
          <View style={styles.stone} />
          <Text style={{ fontSize: 15, fontWeight: '800', color: colors.navy }}>{bal}</Text>
        </View>
      </View>
      <FlatList
        data={list}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 220, gap: 10 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.cap, { flex: 1, fontSize: 13 }]}>Görevlerinden kazandığın taşla çocuğuna oyunda hediye gönder.</Text>
              <Info title="Hediye dükkânı" text="Kendine ya da ailece görev ata (Görev ayrıntıları › Ebeveynler), 'Yaptım' de: Kolay 1, Orta 2, Zor 3 taş. Seçtiğin eşya çocuğunun Pofi Adası posta kutusuna düşer; notun da yanında görünür." />
            </View>
            {children.length > 1 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {children.map((c) => (
                  <Pressable key={c.id} onPress={() => setKid(c.id)} style={[styles.kid, kid === c.id && styles.kidOn]} accessibilityRole="radio" accessibilityState={{ selected: kid === c.id }}>
                    <Avatar id={c.avatar} size={24} />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: kid === c.id ? '#fff' : colors.navy }}>{c.name}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <Segmented options={giftKinds} value={kind} onChange={setKind} />
            {items === null && <ActivityIndicator color={colors.navy} />}
            {failed && <Text style={styles.cap}>Dükkân, ortak SQL dosyası Supabase'de çalıştırılınca açılır.</Text>}
          </View>
        }
        renderItem={({ item }) => {
          const meta = giftItems[item.id];
          const on = pick === item.id;
          const short = item.stones > bal;
          return (
            <Pressable onPress={() => setPick(on ? null : item.id)} style={[styles.item, on && { borderColor: colors.navy }]}
              accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${giftName(item.id)}, ${item.stones} taş`}>
              <View style={styles.icon}><Ionicons name={meta?.icon ?? 'gift-outline'} size={22} color={colors.navy} /></View>
              <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: colors.navy }}>{giftName(item.id)}</Text>
              <View style={[styles.price, short && { opacity: 0.5 }]}>
                <View style={styles.stoneSm} />
                <Text style={{ fontSize: 13, fontWeight: '800', color: colors.navy }}>{item.stones}</Text>
              </View>
            </Pressable>
          );
        }}
      />
      {chosen && child && (
        <View style={styles.bottom}>
          <TextInput value={note} onChangeText={(v) => setNote(v.slice(0, NOTE_MAX))} placeholder={`${child.name} için kısa bir not (isteğe bağlı)`}
            placeholderTextColor={colors.muted} style={styles.input} />
          <Pressable onPress={send} disabled={busy || chosen.stones > bal} style={[styles.cta, (busy || chosen.stones > bal) && { opacity: 0.5 }]} accessibilityRole="button">
            <Ionicons name="gift-outline" size={18} color="#fff" />
            <Text style={styles.ctaText}>{chosen.stones > bal ? `Taş yetmiyor · ${chosen.stones - bal} eksik` : `Hediye gönder · ${chosen.stones} taş`}</Text>
          </Pressable>
        </View>
      )}
      <Dialog visible={!!sent} icon="gift-outline" badge="sparkles" title="Hediye yolda!" text={sent ?? ''} primary="Tamam" onPrimary={() => setSent(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  topTitle: { fontSize: 16, fontWeight: '700', color: colors.navy },
  cap: { fontSize: 12, color: colors.muted },
  bal: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: radius.pill, paddingHorizontal: 12, height: 36 },
  stone: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.gold, borderWidth: 2, borderColor: '#F6D77A' },
  stoneSm: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gold, borderWidth: 2, borderColor: '#F6D77A' },
  kid: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 4, paddingRight: 12, height: 34, borderRadius: radius.pill, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line },
  kidOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: radius.md, padding: 12, borderWidth: 1.5, borderColor: 'transparent' },
  icon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.today, alignItems: 'center', justifyContent: 'center' },
  price: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFF6DF', borderRadius: radius.pill, paddingHorizontal: 10, height: 28 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 28, gap: 10 },
  input: { letterSpacing: 0, backgroundColor: '#F3F4F8', borderRadius: radius.sm, paddingHorizontal: 14, height: 46, fontSize: 15, color: colors.navy },
  cta: { flexDirection: 'row', gap: 8, height: 52, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
