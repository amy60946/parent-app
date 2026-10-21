import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Modal, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius } from '../theme';
import { Avatar, IconButton, Card } from '../components/ui';
import Sheet from '../components/Sheet';
import { useStore, Child } from '../store';
import { useBilling } from '../billing';
import { supabase } from '../lib/supabase';
import { hintOf } from '../lib/errors';
import { requestPremium } from '../lib/billing';
import {
  Reward, RewardInput, RewardRequest, StoneMove, listRewards, saveReward, deleteReward, balances, history, requests,
  giveReward, deductStones, decideRequest, moveLabel, weeklyAverage, rewardAvailableFor,
} from '../lib/rewards';
import { RewardTemplate, RewardKind, RewardUnit, rewardTemplates, rewardIcons, iconKey, iconOf, unitLabel } from '../data/rewardTemplates';
import { formatTR, toISO } from '../dates';

const INTRO_KEY = 'intro-rewards';
const reasons = ['Kurala uymadı', 'Kardeşiyle kavga', 'Ekran süresini aştı', 'Saygısız davrandı'];
type Sel = 'all' | string;

// "1 taş = 10 dakika" / "12 taş"
const priceText = (r: Pick<Reward, 'kind' | 'cost' | 'unit' | 'unitAmount'>) =>
  r.kind === 'exchange' && r.unit ? `${r.cost} taş = ${r.unitAmount} ${unitLabel[r.unit]}` : `${r.cost} taş`;

// Ödüller ve Güneş Taşı: ebeveyn ödül koyar (önerilenlerden ya da kendisi), taşla verir, gerektiğinde taş düşer.
// Çocuğun oyundaki istekleri burada onaylanır.
export default function RewardsScreen({ navigation, route }: any) {
  const { familyId, children } = useStore();
  const { allow } = useBilling();
  const [sel, setSel] = useState<Sel>(route.params?.childId ?? 'all');
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [bal, setBal] = useState<Record<string, number>>({});
  const [moves, setMoves] = useState<StoneMove[]>([]);
  const [reqs, setReqs] = useState<RewardRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false); // sunucu güncellemesi henüz uygulanmadı
  const [editor, setEditor] = useState<{ reward?: Reward; template?: RewardTemplate } | null>(null);
  const [templates, setTemplates] = useState(false);
  const [give, setGive] = useState<Reward | null>(null);
  const [deduct, setDeduct] = useState(false);
  const [intro, setIntro] = useState(false);
  const child = sel === 'all' ? undefined : children.find((c) => c.id === sel);

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
    try { await op(); await load(); return true; }
    catch (e) {
      if (hintOf(e) === 'premium_required') requestPremium((e as Error).message);
      else Alert.alert(title, (e as Error).message);
      await load();
      return false;
    }
  };

  const shown = useMemo(() => (child ? rewards.filter((r) => rewardAvailableFor(r, child.id)) : rewards), [rewards, child]);
  const pending = reqs.filter((r) => r.status === 'pending' && (!child || r.childId === child.id));
  const shownMoves = moves.filter((m) => !child || m.childId === child.id).slice(0, 30);
  const avg = weeklyAverage(moves, children.length);
  const nameOf = (id: string) => children.find((c) => c.id === id)?.name ?? '';

  const openEditor = (x: { reward?: Reward; template?: RewardTemplate }) => { if (allow('reward')) { setTemplates(false); setEditor(x); } };
  const openGive = (r: Reward) => {
    if (!allow('reward')) return;
    const eligible = children.filter((c) => rewardAvailableFor(r, c.id));
    if (r.kind === 'item' && child) {
      Alert.alert('Ödül verilsin mi?', `${r.title}\n${r.cost} Güneş Taşı ${child.name} adlı çocuğun bakiyesinden düşer.`, [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Ver', onPress: () => act(() => giveReward(child.id, r.id), 'Ödül verilemedi') },
      ]);
    } else if (eligible.length) {
      setGive(r);
    }
  };

  const decide = (q: RewardRequest, approve: boolean) => {
    if (!approve) return act(() => decideRequest(q.id, false), 'Kaydedilemedi');
    Alert.alert('İstek onaylansın mı?', `${q.title}\n${q.cost} Güneş Taşı düşülür.`, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Onayla', onPress: () => act(() => decideRequest(q.id, true), 'Onaylanamadı') },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <IconButton name="chevron-back" label="Geri" onPress={() => navigation.goBack()} style={{ backgroundColor: 'transparent' }} />
        <Text style={styles.title}>Ödüller</Text>
        <IconButton name="information-circle-outline" label="Ödüller nasıl çalışır" onPress={() => setIntro(true)} style={{ backgroundColor: 'transparent' }} />
        {!missing && children.length > 0 && (
          <IconButton name="add" label="Ödül oluştur" onPress={() => openEditor({})} style={{ backgroundColor: 'transparent' }} />
        )}
      </View>

      {!children.length ? (
        <Text style={styles.empty}>Ödül vermek için önce Aile sekmesinden bir çocuk ekle.</Text>
      ) : missing && !loading ? (
        <Text style={styles.empty}>Ödüller sunucu güncellemesinden sonra açılacak.</Text>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 16, paddingBottom: 48 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
            <Pressable onPress={() => setSel('all')} style={{ alignItems: 'center', gap: 4, opacity: sel === 'all' ? 1 : 0.5 }}
              accessibilityState={{ selected: sel === 'all' }} accessibilityLabel="Tüm çocuklar">
              <View style={[styles.allKids, sel === 'all' && { borderColor: colors.navy }]}><Ionicons name="people" size={22} color={colors.navy} /></View>
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.navy }}>Tüm çocuklar</Text>
            </Pressable>
            {children.map((c) => (
              <Pressable key={c.id} onPress={() => setSel(c.id)} style={{ alignItems: 'center', gap: 4, opacity: c.id === sel ? 1 : 0.5 }}
                accessibilityState={{ selected: c.id === sel }} accessibilityLabel={c.name}>
                <Avatar id={c.avatar} size={48} ring={c.id === sel} />
                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.navy }}>{c.name}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Card style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={styles.sun}><Ionicons name="sunny" size={24} color={colors.gold} /></View>
              <View style={{ flex: 1 }}>
                {loading ? <ActivityIndicator color={colors.navy} style={{ alignSelf: 'flex-start' }} /> : child ? (
                  <Text style={{ fontSize: 26, fontWeight: '800', color: colors.navy }}>{bal[child.id] ?? 0}</Text>
                ) : (
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.navy }}>Güneş Taşı</Text>
                )}
                <Text style={{ fontSize: 12, color: colors.muted }}>Görev onaylandıkça artar</Text>
              </View>
              <Pressable onPress={() => { if (allow('stones')) setDeduct(true); }} style={styles.outline} accessibilityLabel="Güneş Taşı düş">
                <Ionicons name="remove-circle-outline" size={16} color={colors.danger} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.danger }}>Taş düş</Text>
              </Pressable>
            </View>
            {!child && !loading && children.map((c) => (
              <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Avatar id={c.avatar} size={28} />
                <Text style={{ flex: 1, fontSize: 14, color: colors.navy }}>{c.name}</Text>
                <Cost n={bal[c.id] ?? 0} />
              </View>
            ))}
          </Card>

          {pending.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text style={styles.h}>Bekleyen istekler</Text>
              {pending.map((q) => {
                const b = bal[q.childId] ?? 0;
                return (
                  <Card key={q.id} style={{ gap: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.navy }}>
                          {q.title}{q.unit && q.amount ? ` · ${q.amount} ${unitLabel[q.unit]}` : ''}
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.muted }}>{nameOf(q.childId)} istiyor</Text>
                      </View>
                      <Cost n={q.cost} />
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Pressable onPress={() => decide(q, false)} style={[styles.smallBtn, { backgroundColor: '#F1F2F6' }]}>
                        <Text style={{ fontWeight: '700', color: colors.navy }}>Şimdi olmaz</Text>
                      </Pressable>
                      <Pressable onPress={() => decide(q, true)} disabled={b < q.cost}
                        style={[styles.smallBtn, { backgroundColor: b < q.cost ? '#F1F2F6' : colors.navy }]}>
                        <Text style={{ fontWeight: '700', color: b < q.cost ? colors.muted : '#fff' }}>{b < q.cost ? `${q.cost - b} taş eksik` : 'Onayla'}</Text>
                      </Pressable>
                    </View>
                  </Card>
                );
              })}
            </View>
          )}

          {!loading && rewards.length === 0 ? (
            <View style={{ gap: 12, alignItems: 'stretch' }}>
              <Text style={[styles.h, { textAlign: 'center' }]}>Ödül oluşturarak başla</Text>
              <Pressable style={styles.cta} onPress={() => { if (allow('reward')) setTemplates(true); }}>
                <Text style={styles.ctaText}>Önerilen ödülleri gör</Text>
              </Pressable>
              <Pressable style={styles.secondary} onPress={() => openEditor({})}>
                <Text style={styles.secondaryText}>Kendi ödülümü oluştur</Text>
              </Pressable>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 8 }}>
                {rewardTemplates.slice(2, 9).map((t) => (
                  <Pressable key={t.title} onPress={() => openEditor({ template: t })} style={styles.example} accessibilityLabel={`${t.title} ödülünü kullan`}>
                    <Ionicons name={t.icon} size={34} color={colors.navy} />
                    <Text numberOfLines={2} style={{ fontSize: 13, fontWeight: '700', color: colors.navy, textAlign: 'center' }}>{t.title}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : rewards.length > 0 && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.h, { flex: 1 }]}>Ödüller</Text>
                <Pressable onPress={() => { if (allow('reward')) setTemplates(true); }} hitSlop={8}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.navy }}>Önerilenler</Text>
                </Pressable>
              </View>
              {shown.length === 0 ? (
                <Card><Text style={{ fontSize: 13, color: colors.muted }}>{child?.name} için ödül yok.</Text></Card>
              ) : (
                <Card style={{ padding: 0 }}>
                  {shown.map((r, i) => {
                    const short = child ? r.cost - (bal[child.id] ?? 0) : 0;
                    const forWhom = r.childIds.length ? r.childIds.map(nameOf).filter(Boolean).join(', ') : 'Tüm çocuklar';
                    return (
                      <Pressable key={r.id} onPress={() => openEditor({ reward: r })} style={[styles.row, i > 0 && styles.sep]} accessibilityLabel={`${r.title}, ${priceText(r)}. Düzenle`}>
                        <View style={styles.icon}><Ionicons name={iconOf(r.icon)} size={22} color={colors.navy} /></View>
                        <View style={{ flex: 1, gap: 4 }}>
                          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.navy }}>{r.title}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <Cost n={r.cost} suffix={r.kind === 'exchange' && r.unit ? ` = ${r.unitAmount} ${unitLabel[r.unit]}` : ''} />
                            {!child && <Text style={{ fontSize: 11, color: colors.muted }}>{forWhom}</Text>}
                          </View>
                        </View>
                        <Pressable onPress={() => openGive(r)} disabled={short > 0} style={[styles.give, short > 0 && { backgroundColor: '#F1F2F6' }]}
                          accessibilityLabel={short > 0 ? `${short} taş eksik` : `${r.title} ödülünü ver`}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: short > 0 ? colors.muted : '#fff' }}>{short > 0 ? `${short} eksik` : 'Ver'}</Text>
                        </Pressable>
                      </Pressable>
                    );
                  })}
                </Card>
              )}
            </>
          )}

          {shownMoves.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text style={styles.h}>Son hareketler</Text>
              <Card style={{ padding: 0 }}>
                {shownMoves.map((m, i) => (
                  <View key={m.id} style={[styles.row, i > 0 && styles.sep]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, color: colors.navy }}>{moveLabel[m.reason]}{m.note ? `: ${m.note}` : ''}</Text>
                      <Text style={{ fontSize: 11, color: colors.muted }}>{!child ? `${nameOf(m.childId)} · ` : ''}{formatTR(toISO(new Date(m.at)))}</Text>
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

      <TemplatesModal visible={templates} onClose={() => setTemplates(false)} onUse={(t) => openEditor({ template: t })} />
      {familyId && (
        <RewardEditor
          value={editor} kids={children} avg={avg} onClose={() => setEditor(null)}
          onSave={(r) => act(() => saveReward(familyId, r), 'Kaydedilemedi')}
          onDelete={(id) => act(() => deleteReward(id), 'Silinemedi')}
        />
      )}
      <GiveSheet reward={give} kids={children} balances={bal} preferred={child?.id} onClose={() => setGive(null)}
        onGive={(cid, q) => act(() => giveReward(cid, give!.id, q), 'Ödül verilemedi')} />
      <DeductSheet visible={deduct} kids={children} balances={bal} preferred={child?.id} onClose={() => setDeduct(false)}
        onDeduct={async (ids, n, note) => {
          for (const id of ids) if (!(await act(() => deductStones(id, n, note), `${nameOf(id)}: taş düşülemedi`))) return;
        }} />
      <Intro visible={intro} onClose={closeIntro} />
    </SafeAreaView>
  );
}

function Cost({ n, suffix = '' }: { n: number; suffix?: string }) {
  return (
    <View style={styles.cost}>
      <Ionicons name="sunny" size={12} color={colors.gold} />
      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.navy }}>{n}{suffix}</Text>
    </View>
  );
}

function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (n: number) => void }) {
  const set = (n: number) => onChange(Math.max(min, Math.min(max, n)));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <IconButton name="remove" label="Azalt" onPress={() => set(value - 1)} style={styles.stepBtn} color="#fff" />
      <TextInput value={String(value)} onChangeText={(t) => set(Number(t.replace(/\D/g, '')) || min)} keyboardType="number-pad"
        style={[styles.stepInput, { flex: 1, minWidth: 0, width: 0 }]} accessibilityLabel="Adet" />
      <IconButton name="add" label="Artır" onPress={() => set(value + 1)} style={styles.stepBtn} color="#fff" />
    </View>
  );
}

const NumBox = ({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) => (
  <TextInput value={value ? String(value) : ''} placeholder="0" placeholderTextColor={colors.faint} keyboardType="number-pad" accessibilityLabel={label}
    onChangeText={(t) => onChange(Math.min(1000, Number(t.replace(/\D/g, '')) || 0))} style={styles.numBox} />
);

// Önerilen ödüller
function TemplatesModal({ visible, onClose, onUse }: { visible: boolean; onClose: () => void; onUse: (t: RewardTemplate) => void }) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
        <View style={styles.modalHead}>
          <IconButton name="close" label="Kapat" onPress={onClose} style={{ backgroundColor: 'transparent' }} />
          <Text style={styles.modalTitle}>Önerilen ödüller</Text>
          <View style={{ width: 36 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 10 }}>
          {rewardTemplates.map((t) => (
            <View key={t.title} style={styles.tpl}>
              <View style={styles.icon}><Ionicons name={t.icon} size={22} color={colors.navy} /></View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.navy }}>{t.title}</Text>
                <Cost n={t.cost} suffix={t.kind === 'exchange' && t.unit ? ` = ${t.unitAmount} ${unitLabel[t.unit]}` : ''} />
              </View>
              <Pressable onPress={() => onUse(t)} style={styles.use} accessibilityLabel={`${t.title} ödülünü kullan`}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.navy }}>Kullan</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// Ödül oluştur / düzenle
function RewardEditor({ value, kids, avg, onClose, onSave, onDelete }: {
  value: { reward?: Reward; template?: RewardTemplate } | null; kids: Child[]; avg: number; onClose: () => void;
  onSave: (r: RewardInput) => void; onDelete: (id: string) => void;
}) {
  const editing = value?.reward;
  const [kind, setKind] = useState<RewardKind>('item');
  const [unit, setUnit] = useState<RewardUnit>('minute');
  const [cost, setCost] = useState(0);
  const [amount, setAmount] = useState(0);
  const [who, setWho] = useState<string[]>([]);
  const [icon, setIcon] = useState('gift');
  const [title, setTitle] = useState('');
  const [pickIcon, setPickIcon] = useState(false);
  useEffect(() => {
    if (!value) return;
    const src = value.reward ?? value.template;
    setKind(src?.kind ?? 'item');
    setUnit(src?.unit ?? 'minute');
    setCost(src?.cost ?? 0);
    setAmount(src?.unitAmount ?? 0);
    setWho(value.reward?.childIds.length ? value.reward.childIds : kids.map((k) => k.id));
    setIcon(value.reward?.icon ?? (value.template ? iconKey(value.template.icon) : 'gift'));
    setTitle(src?.title ?? '');
    setPickIcon(false);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: string) => setWho((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const save = () => {
    if (!title.trim()) return Alert.alert('Ödülün adını yaz');
    if (cost < 1 || cost > 500) return Alert.alert('Fiyat 1–500 taş olmalı');
    if (kind === 'exchange' && amount < 1) return Alert.alert(`Kaç ${unitLabel[unit]} karşılığı olduğunu yaz`);
    if (!who.length) return Alert.alert('En az bir çocuk seç');
    onSave({
      id: editing?.id, title, kind, cost, unit: kind === 'exchange' ? unit : undefined, unitAmount: kind === 'exchange' ? amount : undefined,
      childIds: who.length === kids.length ? [] : who, icon,
    });
    onClose();
  };
  const remove = () => editing && Alert.alert('Ödül silinsin mi?', editing.title, [
    { text: 'Vazgeç', style: 'cancel' },
    { text: 'Sil', style: 'destructive', onPress: () => { onDelete(editing.id); onClose(); } },
  ]);

  const typeCard = (k: RewardKind, label: string, desc: string, icons: (keyof typeof Ionicons.glyphMap)[]) => (
    <Pressable onPress={() => setKind(k)} style={[styles.typeCard, kind === k && styles.typeOn]} accessibilityRole="radio" accessibilityState={{ selected: kind === k }}>
      <Ionicons name={kind === k ? 'radio-button-on' : 'radio-button-off'} size={22} color={colors.navy} />
      <View style={{ flexDirection: 'row', gap: 6, marginVertical: 6 }}>
        {icons.map((i) => <Ionicons key={i} name={i} size={22} color={colors.navy} />)}
      </View>
      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.navy, textAlign: 'center' }}>{label}</Text>
      <Text style={{ fontSize: 12, color: colors.muted, textAlign: 'center' }}>{desc}</Text>
    </Pressable>
  );

  return (
    <Modal visible={!!value} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
        <View style={styles.modalHead}>
          <View style={{ width: 36 }} />
          <Text style={styles.modalTitle}>{editing ? 'Ödülü düzenle' : 'Ödül oluştur'}</Text>
          <IconButton name="close" label="Kapat" onPress={onClose} style={{ backgroundColor: 'transparent' }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 32 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
          <View style={{ gap: 10 }}>
            <Text style={styles.h}>Ödül türü</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {typeCard('item', 'Eşya ya da etkinlik', 'Diğer bütün ödüller için', ['gift-outline', 'film-outline', 'ice-cream-outline'])}
              {typeCard('exchange', 'Değişim', 'Ekran süresi ya da harçlık için', ['sunny-outline', 'arrow-forward', 'phone-portrait-outline'])}
            </View>
          </View>

          {kind === 'exchange' && (
            <View style={{ gap: 10 }}>
              <Text style={styles.h}>Neye çevrilsin?</Text>
              {([['minute', 'Dakika', 'Taşı ekran süresine çevirir', 'phone-portrait-outline'], ['money', 'TL', 'Taşı harçlığa çevirir', 'wallet-outline']] as const).map(([u, l, d, ic]) => (
                <Pressable key={u} onPress={() => setUnit(u)} style={[styles.unitRow, unit === u && styles.typeOn]} accessibilityRole="radio" accessibilityState={{ selected: unit === u }}>
                  <Ionicons name={unit === u ? 'radio-button-on' : 'radio-button-off'} size={22} color={colors.navy} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.navy }}>{l}</Text>
                    <Text style={{ fontSize: 12, color: colors.muted }}>{d}</Text>
                  </View>
                  <Ionicons name={ic} size={22} color={colors.navy} />
                </Pressable>
              ))}
            </View>
          )}

          <View style={{ gap: 8 }}>
            <Text style={styles.h}>{kind === 'exchange' ? 'Değişim oranı' : 'Fiyat'}</Text>
            <Text style={styles.reminder}>
              Hatırlatma: kolay görev 1, orta 2, zor 3 Güneş Taşı kazandırır. Son 7 günde çocuk başına ortalama {avg} taş kazanıldı.
              {kind === 'exchange' ? ' Değişim ödülü adet adet alınır.' : ''}
            </Text>
            {kind === 'exchange' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <NumBox value={cost} onChange={setCost} label="Taş" />
                <Text style={styles.unitText}>taş =</Text>
                <NumBox value={amount} onChange={setAmount} label={unitLabel[unit]} />
                <Text style={styles.unitText}>{unitLabel[unit]}</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <NumBox value={cost} onChange={setCost} label="Fiyat" />
                <Text style={styles.unitText}>taş</Text>
              </View>
            )}
          </View>

          <View style={{ gap: 8 }}>
            <Text style={styles.h}>Kimler için</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {kids.map((k) => {
                const on = who.includes(k.id);
                return (
                  <Pressable key={k.id} onPress={() => toggle(k.id)} style={[styles.check, on && { borderColor: colors.navy }]}
                    accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                    <Ionicons name={on ? 'checkbox' : 'square-outline'} size={20} color={colors.navy} />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.navy }}>{k.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <Text style={styles.h}>Ödül simgesi</Text>
            <Pressable onPress={() => setPickIcon(!pickIcon)} style={styles.iconPick} accessibilityLabel="Simge seç">
              <Ionicons name={iconOf(icon)} size={28} color={colors.navy} />
            </Pressable>
            {pickIcon && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {rewardIcons.map((i) => (
                  <Pressable key={i} onPress={() => { setIcon(iconKey(i)); setPickIcon(false); }}
                    style={[styles.iconCell, iconKey(i) === icon && { borderColor: colors.navy }]} accessibilityLabel={String(i)}>
                    <Ionicons name={i} size={22} color={colors.navy} />
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <View style={{ gap: 6 }}>
            <Text style={styles.h}>Ödül adı</Text>
            {kind === 'exchange' && unit === 'minute' && (
              <Text style={{ fontSize: 12, color: colors.muted }}>Hangi uygulama ya da oyun için olduğunu ada yazabilirsin.</Text>
            )}
            <TextInput value={title} onChangeText={setTitle} maxLength={60} style={styles.input} placeholderTextColor={colors.faint}
              placeholder={kind === 'exchange' ? (unit === 'minute' ? 'Ekran süresi' : 'Harçlık') : 'Parkta 30 dakika'} />
            <Text style={{ fontSize: 12, color: colors.muted, alignSelf: 'flex-end' }}>{title.length}/60</Text>
          </View>

          {editing && (
            <Pressable onPress={remove} style={{ alignSelf: 'center' }} hitSlop={8}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.danger }}>Ödülü sil</Text>
            </Pressable>
          )}
        </ScrollView>
        <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
          <Pressable style={styles.cta} onPress={save}><Text style={styles.ctaText}>Kaydet</Text></Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// Ödül ver: çocuk seç (gerekirse) + değişimde kaç kez
function GiveSheet({ reward, kids, balances: bal, preferred, onClose, onGive }: {
  reward: Reward | null; kids: Child[]; balances: Record<string, number>; preferred?: string;
  onClose: () => void; onGive: (childId: string, quantity: number) => void;
}) {
  const eligible = reward ? kids.filter((k) => rewardAvailableFor(reward, k.id)) : [];
  const [cid, setCid] = useState<string | undefined>();
  const [q, setQ] = useState(1);
  useEffect(() => {
    if (!reward) return;
    setCid(eligible.find((k) => k.id === preferred)?.id ?? eligible[0]?.id);
    setQ(1);
  }, [reward]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!reward) return null;
  const b = cid ? bal[cid] ?? 0 : 0;
  const exchange = reward.kind === 'exchange' && reward.unit;
  const maxQ = exchange ? Math.max(1, Math.min(20, Math.floor(b / reward.cost))) : 1;
  const total = reward.cost * q;
  const name = kids.find((k) => k.id === cid)?.name ?? '';
  return (
    <Sheet visible={!!reward} title={reward.title} onClose={onClose}>
      <View style={{ gap: 14 }}>
        {eligible.length > 1 && (
          <View style={{ gap: 6 }}>
            <Text style={styles.cap}>Kime</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {eligible.map((k) => (
                <Pressable key={k.id} onPress={() => { setCid(k.id); setQ(1); }} style={[styles.chip, cid === k.id && styles.chipOn]}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: cid === k.id ? '#fff' : colors.navy }}>{k.name} · {bal[k.id] ?? 0} taş</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
        {exchange && (
          <View style={{ gap: 6 }}>
            <Text style={styles.cap}>Kaç kez ({reward.cost} taş = {reward.unitAmount} {unitLabel[reward.unit!]})</Text>
            <Stepper value={Math.min(q, maxQ)} min={1} max={maxQ} onChange={setQ} />
          </View>
        )}
        <Text style={{ fontSize: 14, color: colors.navy }}>
          {name} adlı çocuğun bakiyesinden {total} taş düşer{exchange ? `; karşılığı ${reward.unitAmount! * q} ${unitLabel[reward.unit!]}` : ''}.
        </Text>
        <Pressable style={[styles.cta, b < total && { opacity: 0.5 }]} disabled={!cid || b < total}
          onPress={() => { onGive(cid!, exchange ? q : 1); onClose(); }}>
          <Text style={styles.ctaText}>{b < total ? `${total - b} taş eksik` : 'Ödülü ver'}</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

// Taş düş: bir ya da birkaç çocuk, adet, neden (çocuk görür)
function DeductSheet({ visible, kids, balances: bal, preferred, onClose, onDeduct }: {
  visible: boolean; kids: Child[]; balances: Record<string, number>; preferred?: string;
  onClose: () => void; onDeduct: (ids: string[], n: number, note: string) => void;
}) {
  const [ids, setIds] = useState<string[]>([]);
  const [n, setN] = useState(1);
  const [note, setNote] = useState('');
  useEffect(() => { if (visible) { setIds(preferred ? [preferred] : []); setN(1); setNote(''); } }, [visible, preferred]);
  const toggle = (id: string) => setIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const short = ids.filter((id) => (bal[id] ?? 0) < n);
  const submit = () => {
    if (!ids.length) return Alert.alert('Kimden düşüleceğini seç');
    if (short.length) return Alert.alert('Bakiye yetersiz', short.map((id) => `${kids.find((k) => k.id === id)?.name}: ${bal[id] ?? 0} taş`).join('\n'));
    onDeduct(ids, n, note);
    onClose();
  };
  return (
    <Sheet visible={visible} title="Güneş Taşı düş" onClose={onClose}>
      <View style={{ gap: 16 }}>
        <Text style={{ fontSize: 14, lineHeight: 20, color: colors.navy }}>
          Taş düşmeyi bir alışkanlığı pekiştirmek ya da çiğnenen bir kuralı göstermek için kullanabilirsin. Seyrek kullan ve nedenini yaz; çocuğun bunu oyunda görür.
        </Text>
        <View style={styles.box}>
          <Text style={styles.boxTitle}>Kimden düşülsün?</Text>
          {kids.map((k) => {
            const on = ids.includes(k.id);
            return (
              <Pressable key={k.id} onPress={() => toggle(k.id)} style={styles.who} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.navy }}>{k.name}</Text>
                  <Text style={{ fontSize: 13, color: colors.muted }}>Bakiye: {bal[k.id] ?? 0} taş</Text>
                </View>
                <Ionicons name={on ? 'checkbox' : 'square-outline'} size={26} color={colors.navy} />
              </Pressable>
            );
          })}
        </View>
        <View style={styles.box}>
          <Text style={styles.boxTitle}>Kaç taş düşülsün?</Text>
          <Stepper value={n} min={1} max={100} onChange={setN} />
        </View>
        <View style={{ gap: 6 }}>
          <Text style={styles.boxTitle}>Nedenini çocuğunla paylaş</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {reasons.map((r) => (
              <Pressable key={r} onPress={() => setNote(r)} style={[styles.chip, note === r && styles.chipOn]}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: note === r ? '#fff' : colors.navy }}>{r}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput value={note} onChangeText={setNote} maxLength={100} multiline placeholderTextColor={colors.faint}
            placeholder="Bugün görevlerini aksattın ve eve geç geldin." style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]} />
          <Text style={{ fontSize: 12, color: colors.muted, alignSelf: 'flex-end' }}>{note.length}/100</Text>
        </View>
        <Pressable style={[styles.cta, { backgroundColor: colors.danger }]} onPress={submit}>
          <Text style={styles.ctaText}>{n} taş düş</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

// Bilgilendirme: ilk açılışta (ve ⓘ ile) gösterilir
function Intro({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const items: [keyof typeof Ionicons.glyphMap, string, string][] = [
    ['sunny-outline', 'Görevle kazanılır', 'Onayladığın her görev Güneş Taşı kazandırır: kolay 1, orta 2, zor 3.'],
    ['gift-outline', 'Ödülü sen belirlersin', 'Önerilenlerden seç ya da kendin oluştur: film gecesi gibi etkinlikler ya da taşı ekran süresine, harçlığa çeviren değişim ödülleri. Çocuğun oyunda da isteyebilecek, onayı sen verirsin.'],
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
  allKids: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#EEF0F5', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  sun: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF6DE', alignItems: 'center', justifyContent: 'center' },
  outline: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.hard.bg, backgroundColor: '#FFF8F9' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F2F6', alignItems: 'center', justifyContent: 'center' },
  cost: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF6DE', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  give: { minWidth: 64, height: 34, borderRadius: 17, paddingHorizontal: 12, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  smallBtn: { flex: 1, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  example: { width: 140, height: 130, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 10 },
  modalHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  modalTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: colors.navy },
  tpl: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, backgroundColor: '#fff' },
  use: { paddingHorizontal: 16, height: 34, borderRadius: 17, backgroundColor: '#FFE7B3', alignItems: 'center', justifyContent: 'center' },
  typeCard: { flex: 1, alignItems: 'center', padding: 14, borderRadius: radius.md, backgroundColor: '#fff', borderWidth: 1.5, borderColor: 'transparent', gap: 2 },
  typeOn: { borderColor: colors.navy },
  unitRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, backgroundColor: '#fff', borderWidth: 1.5, borderColor: 'transparent' },
  reminder: { fontSize: 13, lineHeight: 19, color: colors.muted, fontStyle: 'italic' },
  numBox: { letterSpacing: 0, width: 96, height: 52, borderRadius: radius.sm, backgroundColor: '#fff', fontSize: 20, fontWeight: '700', color: colors.navy, textAlign: 'center' },
  unitText: { fontSize: 16, fontWeight: '700', color: colors.navy },
  check: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.sm, backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.line },
  iconPick: { width: 64, height: 64, borderRadius: 32, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.navy, backgroundColor: '#E6EAF5', alignItems: 'center', justifyContent: 'center' },
  iconCell: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  box: { gap: 10, padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line },
  boxTitle: { fontSize: 15, fontWeight: '700', color: colors.navy },
  who: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff' },
  input: { letterSpacing: 0, backgroundColor: '#fff', borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.navy },
  stepBtn: { backgroundColor: colors.navy, width: 44, height: 44, borderRadius: 22 },
  stepInput: { letterSpacing: 0, textAlign: 'center', fontSize: 20, fontWeight: '800', color: colors.navy, backgroundColor: '#F3F4F8', borderRadius: radius.sm, paddingVertical: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: '#F1F2F6' },
  chipOn: { backgroundColor: colors.navy },
  cta: { height: 52, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  secondary: { height: 52, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.navy, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  secondaryText: { color: colors.navy, fontSize: 15, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,27,61,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  introCard: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: radius.lg, padding: 22, gap: 16 },
  introIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F2F6', alignItems: 'center', justifyContent: 'center' },
});
