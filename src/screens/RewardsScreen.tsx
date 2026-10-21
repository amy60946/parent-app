import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Modal, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius } from '../theme';
import { Avatar, IconButton, Card } from '../components/ui';
import Sheet from '../components/Sheet';
import { useStore } from '../store';
import { useBilling } from '../billing';
import { supabase } from '../lib/supabase';
import { hintOf } from '../lib/errors';
import { requestPremium } from '../lib/billing';
import {
  Reward, RewardRequest, StoneMove, listRewards, saveReward, deleteReward, balances, history, requests,
  giveReward, deductStones, decideRequest, moveLabel,
} from '../lib/rewards';
import { formatTR, toISO } from '../dates';

const INTRO_KEY = 'intro-rewards';
const reasons = ['Kurala uymadı', 'Kardeşiyle kavga', 'Ekran süresini aştı', 'Saygısız davrandı'];

// Ödüller ve Güneş Taşı: ebeveyn ödül koyar, taşla verir, gerektiğinde taş düşer. Çocuğun istekleri burada onaylanır.
export default function RewardsScreen({ navigation, route }: any) {
  const { familyId, children } = useStore();
  const { allow } = useBilling();
  const [childId, setChildId] = useState<string | undefined>(route.params?.childId ?? children[0]?.id);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [bal, setBal] = useState<Record<string, number>>({});
  const [moves, setMoves] = useState<StoneMove[]>([]);
  const [reqs, setReqs] = useState<RewardRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false); // sunucu güncellemesi henüz uygulanmadı
  const [edit, setEdit] = useState<Reward | 'new' | null>(null);
  const [deduct, setDeduct] = useState(false);
  const [intro, setIntro] = useState(false);
  const child = children.find((c) => c.id === childId);

  useEffect(() => { if (!childId && children[0]) setChildId(children[0].id); }, [children, childId]);
  useEffect(() => { AsyncStorage.getItem(INTRO_KEY).then((v) => { if (!v) setIntro(true); }).catch(() => {}); }, []);
  const closeIntro = () => { setIntro(false); AsyncStorage.setItem(INTRO_KEY, '1').catch(() => {}); };

  const load = useCallback(async () => {
    if (!familyId) return;
    try {
      const [r, b, h, q] = await Promise.all([listRewards(familyId), balances(children.map((c) => c.id)), history(familyId), requests(familyId)]);
      setRewards(r); setBal(b); setMoves(h); setReqs(q); setMissing(false);
    } catch {
      setMissing(true);
    } finally {
      setLoading(false);
    }
  }, [familyId, children]);

  useEffect(() => { load(); }, [load]);
  // Realtime: diğer ebeveynin işlemleri, çocuğun istekleri, görev onayıyla gelen taşlar
  useEffect(() => {
    if (!familyId) return;
    const filter = `family_id=eq.${familyId}`;
    let t: ReturnType<typeof setTimeout> | undefined;
    const later = () => { clearTimeout(t); t = setTimeout(load, 250); };
    const ch = supabase.channel(`rewards:${familyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sun_stone_ledger', filter }, later)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reward_requests', filter }, later)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rewards', filter }, later)
      .subscribe();
    return () => { clearTimeout(t); supabase.removeChannel(ch); };
  }, [familyId, load]);

  const act = async (op: () => Promise<void>, title: string) => {
    try { await op(); await load(); }
    catch (e) {
      if (hintOf(e) === 'premium_required') requestPremium((e as Error).message);
      else Alert.alert(title, (e as Error).message);
    }
  };

  const balance = childId ? bal[childId] ?? 0 : 0;
  const mine = useMemo(() => rewards.filter((r) => !r.childId || r.childId === childId), [rewards, childId]);
  const pending = reqs.filter((r) => r.childId === childId && r.status === 'pending');
  const myMoves = moves.filter((m) => m.childId === childId).slice(0, 30);

  const give = (r: Reward) => {
    if (!child || !allow('reward')) return;
    Alert.alert('Ödül verilsin mi?', `${r.title}\n${r.cost} Güneş Taşı ${child.name} adlı çocuğun bakiyesinden düşer.`, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Ver', onPress: () => act(() => giveReward(child.id, r.id), 'Ödül verilemedi') },
    ]);
  };

  const decide = (q: RewardRequest, approve: boolean) => {
    if (approve) {
      Alert.alert('İstek onaylansın mı?', `${q.title}\n${q.cost} Güneş Taşı düşülür.`, [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Onayla', onPress: () => act(() => decideRequest(q.id, true), 'Onaylanamadı') },
      ]);
    } else {
      act(() => decideRequest(q.id, false), 'Kaydedilemedi');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <IconButton name="chevron-back" label="Geri" onPress={() => navigation.goBack()} style={{ backgroundColor: 'transparent' }} />
        <Text style={styles.title}>Ödüller</Text>
        <IconButton name="information-circle-outline" label="Ödüller nasıl çalışır" onPress={() => setIntro(true)} style={{ backgroundColor: 'transparent' }} />
      </View>

      {!children.length ? (
        <Text style={styles.empty}>Ödül vermek için önce Aile sekmesinden bir çocuk ekle.</Text>
      ) : missing && !loading ? (
        <Text style={styles.empty}>Ödüller sunucu güncellemesinden sonra açılacak.</Text>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 16, paddingBottom: 48 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
            {children.map((c) => (
              <Pressable key={c.id} onPress={() => setChildId(c.id)} style={{ alignItems: 'center', gap: 4, opacity: c.id === childId ? 1 : 0.5 }}
                accessibilityState={{ selected: c.id === childId }} accessibilityLabel={c.name}>
                <Avatar id={c.avatar} size={48} ring={c.id === childId} />
                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.navy }}>{c.name}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={styles.sun}><Ionicons name="sunny" size={26} color={colors.gold} /></View>
            <View style={{ flex: 1 }}>
              {loading ? <ActivityIndicator color={colors.navy} style={{ alignSelf: 'flex-start' }} />
                : <Text style={{ fontSize: 26, fontWeight: '800', color: colors.navy }}>{balance}</Text>}
              <Text style={{ fontSize: 12, color: colors.muted }}>Güneş Taşı · görev onaylandıkça artar</Text>
            </View>
            <Pressable onPress={() => { if (allow('stones')) setDeduct(true); }} style={styles.outline} accessibilityLabel="Güneş Taşı düş">
              <Ionicons name="remove-circle-outline" size={16} color={colors.danger} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.danger }}>Taş düş</Text>
            </Pressable>
          </Card>

          {pending.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text style={styles.h}>{child?.name} istiyor</Text>
              {pending.map((q) => (
                <Card key={q.id} style={{ gap: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: colors.navy }}>{q.title}</Text>
                    <Cost n={q.cost} />
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable onPress={() => decide(q, false)} style={[styles.smallBtn, { backgroundColor: '#F1F2F6' }]}>
                      <Text style={{ fontWeight: '700', color: colors.navy }}>Şimdi olmaz</Text>
                    </Pressable>
                    <Pressable onPress={() => decide(q, true)} disabled={balance < q.cost}
                      style={[styles.smallBtn, { backgroundColor: balance < q.cost ? '#F1F2F6' : colors.navy }]}>
                      <Text style={{ fontWeight: '700', color: balance < q.cost ? colors.muted : '#fff' }}>{balance < q.cost ? `${q.cost - balance} taş eksik` : 'Onayla'}</Text>
                    </Pressable>
                  </View>
                </Card>
              ))}
            </View>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.h, { flex: 1 }]}>Ödüller</Text>
            <Pressable onPress={() => { if (allow('reward')) setEdit('new'); }} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="add" size={18} color={colors.navy} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.navy }}>Ödül ekle</Text>
            </Pressable>
          </View>
          {mine.length === 0 ? (
            <Card><Text style={{ fontSize: 13, color: colors.muted }}>Henüz ödül yok. Örnek: "Parkta 30 dakika" · 10 taş, "Film gecesi" · 25 taş.</Text></Card>
          ) : (
            <Card style={{ padding: 0 }}>
              {mine.map((r, i) => {
                const short = r.cost - balance;
                return (
                  <Pressable key={r.id} onPress={() => setEdit(r)} style={[styles.row, i > 0 && styles.sep]} accessibilityLabel={`${r.title}, ${r.cost} taş. Düzenle`}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: colors.navy }}>{r.title}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Cost n={r.cost} />
                        {r.childId && <Text style={{ fontSize: 11, color: colors.muted }}>Yalnız {child?.name}</Text>}
                      </View>
                    </View>
                    <Pressable onPress={() => give(r)} disabled={short > 0} style={[styles.give, short > 0 && { backgroundColor: '#F1F2F6' }]}
                      accessibilityLabel={short > 0 ? `${short} taş eksik` : `${r.title} ödülünü ver`}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: short > 0 ? colors.muted : '#fff' }}>{short > 0 ? `${short} eksik` : 'Ver'}</Text>
                    </Pressable>
                  </Pressable>
                );
              })}
            </Card>
          )}

          {myMoves.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text style={styles.h}>Son hareketler</Text>
              <Card style={{ padding: 0 }}>
                {myMoves.map((m, i) => (
                  <View key={m.id} style={[styles.row, i > 0 && styles.sep]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, color: colors.navy }}>{moveLabel[m.reason]}{m.note ? `: ${m.note}` : ''}</Text>
                      <Text style={{ fontSize: 11, color: colors.muted }}>{formatTR(toISO(new Date(m.at)))}</Text>
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: m.amount > 0 ? colors.easy.fg : colors.danger }}>
                      {m.amount > 0 ? `+${m.amount}` : m.amount}
                    </Text>
                  </View>
                ))}
              </Card>
            </View>
          )}
        </ScrollView>
      )}

      {familyId && (
        <RewardSheet
          value={edit} onClose={() => setEdit(null)} kids={children}
          onSave={(r) => act(() => saveReward(familyId, r), 'Kaydedilemedi')}
          onDelete={(id) => act(() => deleteReward(id), 'Silinemedi')}
        />
      )}
      {child && (
        <DeductSheet visible={deduct} name={child.name} balance={balance} onClose={() => setDeduct(false)}
          onDeduct={(n, note) => act(() => deductStones(child.id, n, note), 'Taş düşülemedi')} />
      )}
      <Intro visible={intro} onClose={closeIntro} />
    </SafeAreaView>
  );
}

function Cost({ n }: { n: number }) {
  return (
    <View style={styles.cost}>
      <Ionicons name="sunny" size={12} color={colors.gold} />
      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.navy }}>{n}</Text>
    </View>
  );
}

function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (n: number) => void }) {
  const set = (n: number) => onChange(Math.max(min, Math.min(max, n)));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <IconButton name="remove" label="Azalt" onPress={() => set(value - 1)} style={styles.stepBtn} />
      <TextInput value={String(value)} onChangeText={(t) => set(Number(t.replace(/\D/g, '')) || min)} keyboardType="number-pad"
        style={styles.stepInput} accessibilityLabel="Adet" />
      <IconButton name="add" label="Artır" onPress={() => set(value + 1)} style={styles.stepBtn} />
    </View>
  );
}

function RewardSheet({ value, onClose, kids, onSave, onDelete }: {
  value: Reward | 'new' | null; onClose: () => void; kids: { id: string; name: string }[];
  onSave: (r: { id?: string; title: string; cost: number; childId?: string }) => void; onDelete: (id: string) => void;
}) {
  const editing = value && value !== 'new' ? value : null;
  const [title, setTitle] = useState('');
  const [cost, setCost] = useState(10);
  const [forChild, setForChild] = useState<string | undefined>();
  useEffect(() => {
    setTitle(editing?.title ?? ''); setCost(editing?.cost ?? 10); setForChild(editing?.childId);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => {
    if (!title.trim()) return Alert.alert('Ödülün adını yaz');
    onSave({ id: editing?.id, title, cost, childId: forChild });
    onClose();
  };
  const remove = () => editing && Alert.alert('Ödül silinsin mi?', editing.title, [
    { text: 'Vazgeç', style: 'cancel' },
    { text: 'Sil', style: 'destructive', onPress: () => { onDelete(editing.id); onClose(); } },
  ]);

  return (
    <Sheet visible={!!value} title={editing ? 'Ödülü düzenle' : 'Yeni ödül'} onClose={onClose}>
      <View style={{ gap: 14 }}>
        <View>
          <Text style={styles.cap}>Ödül</Text>
          <TextInput value={title} onChangeText={setTitle} maxLength={60} placeholder="Örn. Parkta 30 dakika" placeholderTextColor={colors.muted} style={styles.input} />
        </View>
        <View style={{ gap: 6 }}>
          <Text style={styles.cap}>Güneş Taşı (1–500)</Text>
          <Stepper value={cost} min={1} max={500} onChange={setCost} />
          <Text style={{ fontSize: 12, color: colors.muted }}>Kolay görev 1, orta 2, zor 3 taş kazandırır.</Text>
        </View>
        <View style={{ gap: 6 }}>
          <Text style={styles.cap}>Kimin için</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[{ id: undefined as string | undefined, name: 'Hepsi' }, ...kids].map((k) => (
              <Pressable key={k.id ?? 'all'} onPress={() => setForChild(k.id)} style={[styles.chip, forChild === k.id && styles.chipOn]}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: forChild === k.id ? '#fff' : colors.navy }}>{k.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <Pressable style={styles.cta} onPress={save}><Text style={styles.ctaText}>Kaydet</Text></Pressable>
        {editing && (
          <Pressable onPress={remove} style={{ alignSelf: 'center' }} hitSlop={8}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.danger }}>Ödülü sil</Text>
          </Pressable>
        )}
      </View>
    </Sheet>
  );
}

function DeductSheet({ visible, name, balance, onClose, onDeduct }: {
  visible: boolean; name: string; balance: number; onClose: () => void; onDeduct: (n: number, note: string) => void;
}) {
  const [n, setN] = useState(1);
  const [note, setNote] = useState('');
  useEffect(() => { if (visible) { setN(1); setNote(''); } }, [visible]);
  const max = Math.min(100, balance);
  const submit = () => {
    if (n > balance) return Alert.alert('Bakiye yetersiz', `${name} adlı çocuğun ${balance} taşı var.`);
    onDeduct(n, note);
    onClose();
  };
  return (
    <Sheet visible={visible} title="Güneş Taşı düş" onClose={onClose}>
      <View style={{ gap: 14 }}>
        <Text style={{ fontSize: 13, color: colors.muted }}>
          {name} adlı çocuğun {balance} taşı var. Taş düşmeyi seyrek ve nedenini anlatarak kullan; {name} bunu oyunda görür.
        </Text>
        {balance === 0 ? (
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.navy }}>Düşülecek taş yok.</Text>
        ) : (
          <>
            <View style={{ gap: 6 }}>
              <Text style={styles.cap}>Kaç taş</Text>
              <Stepper value={Math.min(n, max)} min={1} max={max} onChange={setN} />
            </View>
            <View style={{ gap: 6 }}>
              <Text style={styles.cap}>Neden (isteğe bağlı)</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {reasons.map((r) => (
                  <Pressable key={r} onPress={() => setNote(r)} style={[styles.chip, note === r && styles.chipOn]}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: note === r ? '#fff' : colors.navy }}>{r}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput value={note} onChangeText={setNote} maxLength={200} placeholder="Kendi cümlenle yaz" placeholderTextColor={colors.muted} style={styles.input} />
            </View>
            <Pressable style={[styles.cta, { backgroundColor: colors.danger }]} onPress={submit}>
              <Text style={styles.ctaText}>{Math.min(n, max)} taş düş</Text>
            </Pressable>
          </>
        )}
      </View>
    </Sheet>
  );
}

// Bilgilendirme: ilk açılışta (ve ⓘ ile) gösterilir
function Intro({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const items: [keyof typeof Ionicons.glyphMap, string, string][] = [
    ['sunny-outline', 'Görevle kazanılır', 'Onayladığın her görev Güneş Taşı kazandırır: kolay 1, orta 2, zor 3.'],
    ['gift-outline', 'Ödülü sen belirlersin', 'Parkta oyun, film gecesi gibi gerçek ödüller ekle; taşla ver. Çocuğun oyunda da isteyebilecek, onayı sen verirsin.'],
    ['remove-circle-outline', 'Gerektiğinde taş düş', 'Bir kural çiğnendiğinde taş düşebilirsin. Seyrek kullan ve nedenini anlat; çocuk bunu görür.'],
  ];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.introCard}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.navy }}>Ödüller ve Güneş Taşı</Text>
          {items.map(([icon, t, d]) => (
            <View key={t} style={{ flexDirection: 'row', gap: 12 }}>
              <View style={styles.introIcon}><Ionicons name={icon} size={20} color={colors.navy} /></View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.navy }}>{t}</Text>
                <Text style={{ fontSize: 13, lineHeight: 18, color: colors.muted }}>{d}</Text>
              </View>
            </View>
          ))}
          <Pressable style={styles.cta} onPress={onClose}><Text style={styles.ctaText}>Anladım</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6 },
  title: { flex: 1, fontSize: 20, fontWeight: '700', color: colors.navy, marginLeft: 4 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 48, paddingHorizontal: 32 },
  h: { fontSize: 16, fontWeight: '700', color: colors.navy },
  cap: { fontSize: 12, color: colors.muted },
  sun: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFF6DE', alignItems: 'center', justifyContent: 'center' },
  outline: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.hard.bg, backgroundColor: '#FFF8F9' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  cost: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF6DE', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  give: { minWidth: 64, height: 34, borderRadius: 17, paddingHorizontal: 12, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  smallBtn: { flex: 1, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  input: { letterSpacing: 0, backgroundColor: '#F3F4F8', borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.navy, marginTop: 4 },
  stepBtn: { backgroundColor: '#F1F2F6', width: 40, height: 40, borderRadius: 20 },
  stepInput: { letterSpacing: 0, minWidth: 64, textAlign: 'center', fontSize: 20, fontWeight: '800', color: colors.navy, backgroundColor: '#F3F4F8', borderRadius: radius.sm, paddingVertical: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: '#F1F2F6' },
  chipOn: { backgroundColor: colors.navy },
  cta: { height: 52, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,27,61,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  introCard: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: radius.lg, padding: 22, gap: 16 },
  introIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F2F6', alignItems: 'center', justifyContent: 'center' },
});
