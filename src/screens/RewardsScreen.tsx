import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Modal, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ReanimatedSwipeable, { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius } from '../theme';
import { Avatar, IconButton, Card } from '../components/ui';
import Sheet from '../components/Sheet';
import Info, { InfoTitle } from '../components/Info';
import { useFirstTip } from '../components/FirstTip';
import { rewardTips } from '../data/rewardTips';
import { useStore, Child } from '../store';
import { useBilling } from '../billing';
import { supabase } from '../lib/supabase';
import { hintOf } from '../lib/errors';
import { requestPremium } from '../lib/billing';
import {
  Reward, RewardInput, RewardRequest, StoneMove, listRewards, saveReward, deleteReward, balances, history, requests,
  giveReward, deductStones, decideRequest, moveLabel, weeklyEarned, rewardAvailableFor,
} from '../lib/rewards';
import {
  RewardTemplate, RewardKind, RewardUnit, RewardGroup, rewardTemplates, rewardIcons, iconKey, iconOf, unitLabel, unitShort, groupLabel,
} from '../data/rewardTemplates';
import { formatTR, toISO } from '../dates';

const INTRO_KEY = 'intro-rewards';
const reasons = ['Söz tutmadı', 'Kurala uymadı', 'Kardeşiyle kavga', 'Saygısız davrandı'];
const amounts = [1, 2, 3, 5];
// Değiş tokuşta "kaç kez" seçenekleri (taşı yetenler gösterilir)
const exchangeSteps = [1, 2, 3, 6];
// Çocuk harfleri için renkler (sırayla)
const tints: [string, string][] = [['#FDE7EA', '#B3263E'], ['#E6F4EA', '#2F7D4A'], ['#E6EAF5', '#2C4A9A'], ['#FFF1DB', '#8A5A00'], ['#F1E6F7', '#6B3A8A']];
const initial = (name: string) => name.trim().charAt(0).toLocaleUpperCase('tr-TR') || '?';
// Ayrılma eki: Nazlı'dan, Arven'den, Ahmet'ten
const fromName = (name: string) => {
  const n = name.trim().toLocaleLowerCase('tr-TR');
  const v = [...n].reverse().find((ch) => 'aıoueiöü'.includes(ch)) ?? 'e';
  const hard = 'fstkçşhp'.includes(n.slice(-1));
  return `${name.trim()}'${hard ? 't' : 'd'}${'aıou'.includes(v) ? 'a' : 'e'}n`;
};
const sameTitle = (a: string, b: string) => a.trim().toLocaleLowerCase('tr-TR') === b.trim().toLocaleLowerCase('tr-TR');

// "1 taş = 10 dk" / "12 taş"
const priceText = (r: Pick<Reward, 'kind' | 'cost' | 'unit' | 'unitAmount'>) =>
  r.kind === 'exchange' && r.unit ? `${r.cost} taş = ${r.unitAmount} ${unitShort[r.unit]}` : `${r.cost} taş`;

// Son onay: ödül verme ya da isteğe karar. Onay düğmesine basılmadan hiçbir şey değişmez.
type Confirm =
  | { type: 'give'; reward: Reward; childId: string; quantity: number }
  | { type: 'request'; req: RewardRequest; approve: boolean };

// Ödüller ve Güneş Taşı: ebeveyn ödül koyar (önerilerden ya da kendisi), çocuğun harfine dokunup onaylayarak verir,
// "−" ile taş düşürür. Çocuğun oyundaki istekleri üstte bant olarak görünür.
export default function RewardsScreen({ navigation }: any) {
  const { familyId, children } = useStore();
  const { allow } = useBilling();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [bal, setBal] = useState<Record<string, number>>({});
  const [moves, setMoves] = useState<StoneMove[]>([]);
  const [reqs, setReqs] = useState<RewardRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false); // sunucu güncellemesi henüz uygulanmadı
  const [editor, setEditor] = useState<{ reward?: Reward; template?: RewardTemplate } | null>(null);
  const [suggest, setSuggest] = useState(false);
  const [past, setPast] = useState(false);
  const [deduct, setDeduct] = useState<string | null>(null); // taş düşürülecek çocuk
  const [pick, setPick] = useState<{ rewardId: string; childId: string } | null>(null); // değiş tokuşta süre seçimi
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [toast, setToast] = useState<{ text: string; edit?: string; warn?: boolean } | null>(null); // edit: eklenen ödülün adı; warn: uyarı
  const [intro, setIntro] = useState(false);
  const tips = useFirstTip();

  useEffect(() => { AsyncStorage.getItem(INTRO_KEY).then((v) => { if (!v) setIntro(true); }).catch(() => {}); }, []);
  const closeIntro = () => { setIntro(false); AsyncStorage.setItem(INTRO_KEY, '1').catch(() => {}); };
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const load = useCallback(async () => {
    if (!familyId) return;
    // Her parça ayrı yüklenir: sunucu güncellemesi eksikse ekran yine açılır, eksik kısım boş kalır
    const [r, b, h, q] = await Promise.allSettled([listRewards(familyId), balances(children.map((c) => c.id)), history(familyId), requests(familyId)]);
    if (r.status === 'fulfilled') setRewards(r.value);
    if (b.status === 'fulfilled') setBal(b.value);
    if (h.status === 'fulfilled') setMoves(h.value);
    if (q.status === 'fulfilled') setReqs(q.value);
    setMissing([r, b, h, q].some((x) => x.status === 'rejected'));
    setLoading(false);
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

  // Sunucu güncellemesi uygulanmadan işlem yapılamaz; ekran yine görünür
  const ready = () => {
    if (!missing) return true;
    Alert.alert('Sunucu güncellemesi bekleniyor', 'Ödül vermek, eklemek ve taş düşürmek, ortak SQL dosyaları Supabase\'de çalıştırılınca açılır.');
    return false;
  };
  const act = async (op: () => Promise<void>, title: string) => {
    try { await op(); await load(); return true; }
    catch (e) {
      if (hintOf(e) === 'premium_required') requestPremium((e as Error).message);
      else Alert.alert(title, (e as Error).message);
      await load();
      return false;
    }
  };

  const kid = (id: string) => children.find((c) => c.id === id);
  const nameOf = (id: string) => kid(id)?.name ?? '';
  const tintOf = (id: string) => tints[Math.max(0, children.findIndex((c) => c.id === id)) % tints.length];
  const pending = reqs.filter((r) => r.status === 'pending');
  const fresh = useMemo(() => rewardTemplates.filter((t) => !rewards.some((r) => sameTitle(r.title, t.title))), [rewards]);

  const openEditor = (x: { reward?: Reward; template?: RewardTemplate }) => {
    if (!ready() || !allow('reward')) return;
    const open = () => setEditor(x);
    if (x.reward) return open();
    // iOS: Öneriler sayfası açıkken başka pencere açılamaz; önce kapanmasını bekle
    if (suggest) { setSuggest(false); setTimeout(() => tips.gate('create', rewardTips.create, open), 450); }
    else tips.gate('create', rewardTips.create, open);
  };
  // Öneriye dokun: önerilen fiyatla, bütün çocuklar için eklenir (taş düşmez; satırdan düzenlenir/silinir)
  const addTemplate = (t: RewardTemplate) => {
    if (!familyId || !ready() || !allow('reward')) return;
    tips.gate('create', rewardTips.create, async () => {
      const ok = await act(() => saveReward(familyId, {
        title: t.title, kind: t.kind, cost: t.cost, unit: t.unit, unitAmount: t.unitAmount, childIds: [], icon: iconKey(t.icon),
      }), 'Eklenemedi');
      if (ok) setToast({ text: `${t.title} eklendi · ${priceText(t)}`, edit: t.title });
    });
  };
  // Çocuğun harfine dokun: eşyada onay kartı, değiş tokuşta önce kaç kez
  const tapKid = (r: Reward, childId: string) => {
    if (!ready() || !allow('reward')) return;
    tips.gate('give', rewardTips.give, () => {
      if (r.kind === 'exchange' && r.unit) { setConfirm(null); setPick({ rewardId: r.id, childId }); }
      else { setPick(null); setConfirm({ type: 'give', reward: r, childId, quantity: 1 }); }
    });
  };
  // Sola kaydırıp Sil: önce sorar
  const removeReward = (r: Reward) => {
    if (!ready()) return;
    Alert.alert('Ödül silinsin mi?', `${r.title}\nBekleyen istekler etkilenmez; çocuklar bu ödülü artık göremez.`, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: async () => { if (await act(() => deleteReward(r.id), 'Silinemedi')) setToast({ text: `${r.title} silindi` }); } },
    ]);
  };
  const openDeduct = (id: string) => { if (ready() && allow('stones')) tips.gate('deduct', rewardTips.deduct, () => setDeduct(id)); };
  const decide = (req: RewardRequest, approve: boolean) =>
    tips.gate('request', rewardTips.request, () => { setPick(null); setConfirm({ type: 'request', req, approve }); });

  const runConfirm = async () => {
    const c = confirm;
    if (!c) return;
    setConfirm(null); setPick(null);
    if (c.type === 'give') {
      const total = c.reward.cost * c.quantity;
      const ok = await act(() => giveReward(c.childId, c.reward.id, c.quantity), 'Ödül verilemedi');
      if (ok) setToast({ text: `${nameOf(c.childId)}: ${giveTitle(c.reward, c.quantity)} · −${total} taş` });
    } else {
      const ok = await act(() => decideRequest(c.req.id, c.approve), c.approve ? 'Onaylanamadı' : 'Kaydedilemedi');
      if (ok) setToast({ text: c.approve ? `Onaylandı: ${c.req.title}` : `${nameOf(c.req.childId)}: şimdi olmaz dendi` });
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <IconButton name="chevron-back" label="Geri" onPress={() => navigation.goBack()} style={{ backgroundColor: 'transparent' }} />
        <Text style={styles.title}>Ödüller</Text>
        <IconButton name="information-circle-outline" label="Ödüller nasıl çalışır" onPress={() => setIntro(true)} style={{ backgroundColor: 'transparent' }} />
        <IconButton name="time-outline" label="Geçmiş" onPress={() => setPast(true)} style={{ backgroundColor: 'transparent' }} />
      </View>

      {!children.length ? (
        <Text style={styles.empty}>Ödül vermek için önce Aile sekmesinden bir çocuk ekle.</Text>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 14, paddingBottom: 140 }}>
          {missing && !loading && (
            <View style={styles.warn}>
              <Ionicons name="cloud-offline-outline" size={18} color="#6B5300" />
              <Text style={{ flex: 1, fontSize: 13, lineHeight: 18, color: '#6B5300' }}>Sunucu güncellemesi bekleniyor.</Text>
              <Info title="Sunucu güncellemesi" color="#6B5300" text="Ekranı görebilirsin; ödül verme, ekleme ve taş düşürme sunucu güncellendikten sonra çalışır." />
            </View>
          )}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, flexGrow: 1 }}>
            {children.map((c) => {
              const [bg, fg] = tintOf(c.id);
              return (
                <View key={c.id} style={[styles.balance, children.length <= 2 && { flex: 1 }]}>
                  <View style={[styles.letter, { width: 32, height: 32, borderRadius: 16, backgroundColor: bg }]}>
                    <Text style={{ fontWeight: '800', color: fg }}>{initial(c.name)}</Text>
                  </View>
                  <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, fontWeight: '600', color: colors.navy }}>{c.name}</Text>
                  <Ionicons name="sunny" size={14} color={colors.gold} />
                  {loading ? <ActivityIndicator color={colors.navy} /> : (
                    <Text style={{ fontSize: 16, fontWeight: '800', color: colors.navy }} accessibilityLabel={`${bal[c.id] ?? 0} taş`}>{bal[c.id] ?? 0}</Text>
                  )}
                  <Pressable onPress={() => openDeduct(c.id)} hitSlop={6} style={styles.minus} accessibilityLabel={`${c.name}: taş düşür`}>
                    <Ionicons name="remove" size={18} color={colors.danger} />
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>

          {pending.map((q) => {
            const b = bal[q.childId] ?? 0;
            return (
              <View key={q.id} style={styles.request}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B5300' }}>{nameOf(q.childId)} istiyor</Text>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.navy }}>
                    {q.title}{q.unit && q.amount ? ` · ${q.amount} ${unitShort[q.unit]}` : ''} · {q.cost} taş
                  </Text>
                  {b < q.cost && <Text style={{ fontSize: 12, color: colors.danger }}>{q.cost - b} taş eksik</Text>}
                </View>
                <Pressable onPress={() => decide(q, false)} style={[styles.round, { backgroundColor: '#fff' }]} accessibilityLabel="Şimdi olmaz">
                  <Ionicons name="close" size={20} color={colors.navy} />
                </Pressable>
                <Pressable onPress={() => decide(q, true)} disabled={b < q.cost} style={[styles.round, { backgroundColor: b < q.cost ? '#E8EAEF' : colors.navy }]}
                  accessibilityLabel={b < q.cost ? `${q.cost - b} taş eksik` : 'Onayla'}>
                  <Ionicons name="checkmark" size={20} color={b < q.cost ? colors.muted : '#fff'} />
                </Pressable>
              </View>
            );
          })}

          {fresh.length > 0 && (
            <View style={{ gap: 6, marginTop: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.cap, { flex: 1, fontWeight: '700', color: '#3D4559', fontSize: 13 }]}>Öneriler · dokun, eklensin</Text>
                <Pressable onPress={() => { if (allow('reward')) setSuggest(true); }} hitSlop={10} style={styles.allBtn} accessibilityLabel="Bütün öneriler">
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.navy }}>Tümü ›</Text>
                </Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {fresh.slice(0, 6).map((t) => (
                  <Pressable key={t.title} onPress={() => addTemplate(t)} style={styles.suggest} accessibilityLabel={`${t.title} ekle, ${priceText(t)}`}>
                    <Ionicons name="add" size={16} color={colors.navy} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.navy }}>{t.title}</Text>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.muted }}>{t.kind === 'exchange' && t.unit ? `${t.cost} = ${t.unitAmount} ${unitShort[t.unit]}` : t.cost}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          <InfoTitle title="Ödüller" style={styles.h} info="Vermek için ödülün yanındaki çocuk harfine dokun, sonra onayla. Soluk harf: o çocuğun taşı yetmiyor (dokununca eksik taşı gösterir). Silmek için ödülü sola kaydır." />
          {!loading && rewards.length === 0 ? (
            <Card><Text style={{ fontSize: 14, lineHeight: 20, color: colors.muted }}>Henüz ödül yok. Önerilerden ekle ya da "Yeni ödül"e dokun.</Text></Card>
          ) : (
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {rewards.map((r, i) => {
                const kids = children.filter((c) => rewardAvailableFor(r, c.id));
                const open = pick?.rewardId === r.id;
                const sel = (id: string) => (open && pick?.childId === id) || (confirm?.type === 'give' && confirm.reward.id === r.id && confirm.childId === id);
                const picked = open ? pick!.childId : undefined;
                const pb = picked ? bal[picked] ?? 0 : 0;
                return (
                  <SwipeRow key={r.id} label={r.title} onDelete={() => removeReward(r)}>
                  <View style={[i > 0 && styles.sep, { backgroundColor: '#fff' }, (open || (confirm?.type === 'give' && confirm.reward.id === r.id)) && { backgroundColor: '#FFFBEF' }]}>
                    <View style={styles.row}>
                      <Pressable onPress={() => openEditor({ reward: r })} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}
                        accessibilityLabel={`${r.title}, ${priceText(r)}. Düzenle`}>
                        <View style={styles.icon}><Ionicons name={iconOf(r.icon)} size={20} color={colors.navy} /></View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.navy }}>{r.title}</Text>
                          <Text style={{ fontSize: 12, color: colors.muted }}>{priceText(r)}</Text>
                        </View>
                      </Pressable>
                      {kids.map((c) => {
                        const short = (bal[c.id] ?? 0) < r.cost;
                        const [bg, fg] = tintOf(c.id);
                        return (
                          <Pressable key={c.id} disabled={loading}
                            onPress={() => (short ? setToast({ warn: true, text: `${c.name}: taşı yetmiyor. ${r.cost} taş gerekli, ${bal[c.id] ?? 0} taşı var (${r.cost - (bal[c.id] ?? 0)} eksik).` }) : tapKid(r, c.id))}
                            style={[styles.letter, short ? styles.letterShort : { backgroundColor: bg }, sel(c.id) && styles.letterOn]}
                            accessibilityLabel={short ? `${c.name}: ${r.cost - (bal[c.id] ?? 0)} taş eksik` : `${r.title}: ${c.name} için ver`}>
                            <Text style={{ fontSize: 15, fontWeight: '800', color: short ? '#B4B9C6' : fg }}>{initial(c.name)}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    {open && r.unit && (
                      <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 8 }}>
                        <Text style={styles.cap}>{nameOf(picked!)} için {r.unit === 'minute' ? 'süre' : 'tutar'}</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                          {exchangeSteps.filter((q) => q * r.cost <= pb).map((q) => {
                            const on = confirm?.type === 'give' && confirm.reward.id === r.id && confirm.quantity === q;
                            return (
                              <Pressable key={q} onPress={() => setConfirm({ type: 'give', reward: r, childId: picked!, quantity: q })}
                                style={[styles.chip, styles.chipLine, on && styles.chipOn]} accessibilityLabel={`${q * r.unitAmount!} ${unitLabel[r.unit!]}, ${q * r.cost} taş`}>
                                <Text style={{ fontSize: 13, fontWeight: '700', color: on ? '#fff' : colors.navy }}>{q * r.unitAmount!} {unitShort[r.unit!]} · {q * r.cost}</Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    )}
                  </View>
                  </SwipeRow>
                );
              })}
            </Card>
          )}
        </ScrollView>
      )}

      {children.length > 0 && !confirm && (
        <Pressable onPress={() => openEditor({})} style={styles.fab} accessibilityLabel="Yeni ödül">
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Yeni ödül</Text>
        </Pressable>
      )}
      {toast && !confirm && (
        <View style={[styles.toast, toast.warn && styles.toastWarn]} accessibilityRole="alert">
          {toast.warn && <Ionicons name="alert-circle" size={20} color="#B07A00" />}
          <Text style={{ flex: 1, color: toast.warn ? '#4A3500' : '#fff', fontSize: 14, fontWeight: '600', paddingVertical: 8 }}>{toast.text}</Text>
          {toast.edit && (
            <Pressable onPress={() => { const r = rewards.find((x) => sameTitle(x.title, toast.edit!)); setToast(null); if (r) openEditor({ reward: r }); }}
              hitSlop={8} style={{ paddingHorizontal: 10, paddingVertical: 8 }}>
              <Text style={{ color: '#FFD66B', fontSize: 14, fontWeight: '700' }}>Düzenle</Text>
            </Pressable>
          )}
        </View>
      )}
      {confirm && (
        <ConfirmCard
          {...confirmText(confirm, nameOf, bal)}
          tint={tintOf(confirm.type === 'give' ? confirm.childId : confirm.req.childId)}
          letter={initial(nameOf(confirm.type === 'give' ? confirm.childId : confirm.req.childId))}
          onCancel={() => { setConfirm(null); setPick(null); }} onOk={runConfirm}
        />
      )}

      <SuggestionsModal visible={suggest} rewards={rewards} onClose={() => setSuggest(false)} onAdd={addTemplate}
        onCustom={() => openEditor({})} tip={suggest ? tips.element : null} />
      {familyId && (
        <RewardEditor
          value={editor} kids={children} moves={moves} balances={bal} onClose={() => setEditor(null)}
          onSave={(r) => act(() => saveReward(familyId, r), 'Kaydedilemedi')}
          onDelete={(id) => act(() => deleteReward(id), 'Silinemedi')}
        />
      )}
      <DeductSheet childId={deduct} kids={children} balances={bal} moves={moves} onClose={() => setDeduct(null)}
        onDeduct={async (id, n, note) => {
          if (await act(() => deductStones(id, n, note), `${nameOf(id)}: taş düşürülemedi`)) setToast({ text: `${nameOf(id)}: −${n} taş${note ? ` · ${note}` : ''}` });
        }} />
      <HistorySheet visible={past} moves={moves} nameOf={nameOf} onClose={() => setPast(false)} />
      <Intro visible={intro} onClose={closeIntro} />
      {!suggest && tips.element}
    </SafeAreaView>
  );
}

// Ödül satırı: sola kaydırınca "Sil"
function SwipeRow({ label, onDelete, children }: { label: string; onDelete: () => void; children: React.ReactNode }) {
  const ref = useRef<SwipeableMethods>(null);
  return (
    <ReanimatedSwipeable ref={ref} friction={1.5} rightThreshold={40} overshootRight={false}
      renderRightActions={() => (
        <Pressable onPress={() => { ref.current?.close(); onDelete(); }} style={styles.deleteAction} accessibilityLabel={`${label} ödülünü sil`}>
          <Ionicons name="trash-outline" size={22} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700', marginTop: 2 }}>Sil</Text>
        </Pressable>
      )}>
      {children}
    </ReanimatedSwipeable>
  );
}

const giveTitle = (r: Reward, q: number) => (r.kind === 'exchange' && r.unit ? `${r.title} · ${q * r.unitAmount!} ${unitShort[r.unit]}` : r.title);

function confirmText(c: Confirm, nameOf: (id: string) => string, bal: Record<string, number>) {
  if (c.type === 'give') {
    const b = bal[c.childId] ?? 0;
    const total = c.reward.cost * c.quantity;
    return { title: giveTitle(c.reward, c.quantity), sub: `${nameOf(c.childId)} · ${total} taş düşer · ${b} → ${b - total}`, ok: 'Ödül ver', danger: false };
  }
  const b = bal[c.req.childId] ?? 0;
  return c.approve
    ? { title: `${c.req.title} isteğini onayla`, sub: `${nameOf(c.req.childId)} · ${c.req.cost} taş düşer · ${b} → ${b - c.req.cost}`, ok: 'Onayla', danger: false }
    : { title: `${c.req.title}: şimdi olmaz`, sub: `Taş düşmez. ${nameOf(c.req.childId)} oyunda görür; ne zaman olacağını ona söyle.`, ok: 'Şimdi olmaz', danger: false };
}

// Alttaki son onay kartı: Vazgeç hiçbir şeyi değiştirmez
function ConfirmCard({ title, sub, ok, tint, letter, onCancel, onOk }: {
  title: string; sub: string; ok: string; danger: boolean; tint: [string, string]; letter: string; onCancel: () => void; onOk: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.confirm, { bottom: Math.max(insets.bottom, 12) + 8 }]} accessibilityViewIsModal>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={[styles.letter, { backgroundColor: tint[0] }]}><Text style={{ fontSize: 17, fontWeight: '800', color: tint[1] }}>{letter}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.navy }}>{title}</Text>
          <Text style={{ fontSize: 13, color: '#4A5165' }}>{sub}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable onPress={onCancel} style={[styles.btn, { flex: 1, backgroundColor: '#F1F2F6' }]}><Text style={[styles.btnText, { color: colors.navy }]}>Vazgeç</Text></Pressable>
        <Pressable onPress={onOk} style={[styles.btn, { flex: 2, backgroundColor: colors.navy }]}><Text style={styles.btnText}>{ok}</Text></Pressable>
      </View>
    </View>
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

// Öneriler › Tümü: arama, bölüm süzgeci, Ekle (eklenince "Eklendi")
function SuggestionsModal({ visible, rewards, onClose, onAdd, onCustom, tip }: {
  visible: boolean; rewards: Reward[]; onClose: () => void; onAdd: (t: RewardTemplate) => void; onCustom: () => void; tip: React.ReactNode;
}) {
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<RewardGroup | 'all'>('all');
  useEffect(() => { if (visible) { setQ(''); setGroup('all'); } }, [visible]);
  const needle = q.trim().toLocaleLowerCase('tr-TR');
  const list = rewardTemplates.filter((t) => (group === 'all' || t.group === group) && (!needle || t.title.toLocaleLowerCase('tr-TR').includes(needle)));
  const groups = (Object.keys(groupLabel) as RewardGroup[]).filter((g) => list.some((t) => t.group === g));
  const added = (t: RewardTemplate) => rewards.some((r) => sameTitle(r.title, t.title));
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
        <View style={styles.modalHead}>
          <IconButton name="chevron-back" label="Geri" onPress={onClose} style={{ backgroundColor: 'transparent' }} />
          <Text style={[styles.modalTitle, { textAlign: 'left', marginLeft: 4 }]}>Öneriler</Text>
        </View>
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          <View style={styles.search}>
            <Ionicons name="search" size={18} color={colors.muted} />
            <TextInput value={q} onChangeText={setQ} placeholder="Ara: dondurma, harçlık…" placeholderTextColor={colors.faint}
              style={{ flex: 1, fontSize: 15, color: colors.navy, paddingVertical: 10 }} accessibilityLabel="Önerilerde ara" />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {(['all', ...Object.keys(groupLabel)] as (RewardGroup | 'all')[]).map((g) => (
              <Pressable key={g} onPress={() => setGroup(g)} style={[styles.chip, styles.chipLine, group === g && styles.chipOn]}
                accessibilityRole="tab" accessibilityState={{ selected: group === g }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: group === g ? '#fff' : colors.navy }}>{g === 'all' ? 'Tümü' : groupLabel[g]}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 6, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
          {groups.map((g) => (
            <View key={g} style={{ gap: 6 }}>
              <Text style={styles.groupTitle}>{groupLabel[g]}{g === 'exchange' ? ' · taş karşılığı süre ya da harçlık' : ''}</Text>
              <Card style={{ padding: 0, overflow: 'hidden', marginBottom: 8 }}>
                {list.filter((t) => t.group === g).map((t, i) => (
                  <View key={t.title} style={[styles.row, i > 0 && styles.sep]}>
                    <View style={styles.icon}><Ionicons name={t.icon} size={20} color={colors.navy} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: colors.navy }}>{t.title}</Text>
                      <Text style={{ fontSize: 12, color: colors.muted }}>{priceText(t)}</Text>
                    </View>
                    {added(t) ? (
                      <View style={styles.added}><Ionicons name="checkmark" size={14} color={colors.easy.fg} /><Text style={{ fontSize: 13, fontWeight: '700', color: colors.easy.fg }}>Eklendi</Text></View>
                    ) : (
                      <Pressable onPress={() => onAdd(t)} style={styles.addBtn} accessibilityLabel={`${t.title} ekle`}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.navy }}>Ekle</Text>
                      </Pressable>
                    )}
                  </View>
                ))}
              </Card>
            </View>
          ))}
          {!list.length && <Text style={styles.empty}>Bu adla bir öneri yok.</Text>}
          <Pressable onPress={onCustom} style={[styles.secondary, { marginTop: 8 }]}>
            <Text style={styles.secondaryText}>Kendi ödülümü oluştur</Text>
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Text style={[styles.cap, { flex: 1 }]}>Önerilen fiyatla bütün çocuklara eklenir.</Text>
            <Info title="Öneri ekleme" text="Fiyatı ya da çocukları sonra ödülün satırına dokunarak değiştirirsin." />
          </View>
        </ScrollView>
        {tip}
      </SafeAreaView>
    </Modal>
  );
}

// Ödül oluştur / düzenle (tek sayfa): adı yaz → öneriye dokun (fiyat, simge, tür gelir) → istersen fiyatı değiştir → Kaydet
type Mode = 'item' | 'minute' | 'money';
const prices = [3, 5, 10, 20, 50];
const rateCosts = [1, 2, 3, 5];
const rateAmounts: Record<RewardUnit, number[]> = { minute: [5, 10, 15, 30], money: [5, 10, 20, 50] };
// Addan tür: "ekran süresi", "tablet" → dakika; "harçlık", "TL" → para (değiş tokuş)
const detectUnit = (t: string): RewardUnit | null => {
  const s = t.toLocaleLowerCase('tr-TR');
  if (/ekran|tablet|telefon|televizyon|\btv\b|oyun süresi|bilgisayar/.test(s)) return 'minute';
  if (/harçlık|para\b|\btl\b|lira/.test(s)) return 'money';
  return null;
};
function RewardEditor({ value, kids, moves, balances: bal, onClose, onSave, onDelete }: {
  value: { reward?: Reward; template?: RewardTemplate } | null; kids: Child[]; moves: StoneMove[]; balances: Record<string, number>; onClose: () => void;
  onSave: (r: RewardInput) => void; onDelete: (id: string) => void;
}) {
  const editing = value?.reward;
  const [mode, setMode] = useState<Mode>('item');
  const [cost, setCost] = useState(0);
  const [amount, setAmount] = useState(0);
  const [who, setWho] = useState<string[]>([]); // boş: herkes
  const [icon, setIcon] = useState('gift');
  const [title, setTitle] = useState('');
  const [pickIcon, setPickIcon] = useState(false);
  const [other, setOther] = useState(false); // fiyatı elle yaz
  const [typed, setTyped] = useState(false); // ad elle yazıldı mı (öneriler yalnız o zaman)
  const [suggested, setSuggested] = useState(false); // fiyat öneriden geldi
  useEffect(() => {
    if (!value) return;
    const src = value.reward ?? value.template;
    setMode(src?.kind === 'exchange' ? (src.unit ?? 'minute') : 'item');
    setCost(src?.cost ?? 0);
    setAmount(src?.unitAmount ?? 0);
    setWho(value.reward?.childIds ?? []);
    setIcon(value.reward?.icon ?? (value.template ? iconKey(value.template.icon) : 'gift'));
    setTitle(src?.title ?? '');
    setPickIcon(false);
    setTyped(false);
    setOther(!!src && src.kind !== 'exchange' && !prices.includes(src.cost));
    setSuggested(!!value.template);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const needle = title.trim().toLocaleLowerCase('tr-TR');
  const matches = typed && needle.length >= 2
    ? rewardTemplates.filter((t) => t.title.toLocaleLowerCase('tr-TR').includes(needle) && !sameTitle(t.title, title)).slice(0, 3)
    : [];
  const useTemplate = (t: RewardTemplate) => {
    setTitle(t.title); setIcon(iconKey(t.icon)); setCost(t.cost); setAmount(t.unitAmount ?? 0);
    setMode(t.kind === 'exchange' ? (t.unit ?? 'minute') : 'item'); setOther(t.kind !== 'exchange' && !prices.includes(t.cost)); setTyped(false);
    setSuggested(true);
  };
  // Ad yazılırken tür kendiliğinden: "ekran süresi" / "harçlık" yazınca oran biçimi
  const typeTitle = (t: string) => {
    setTitle(t); setTyped(true);
    const u = detectUnit(t);
    if (u && mode !== u) setRate(u);
    else if (!u && mode !== 'item' && !editing) setMode('item');
  };
  const setRate = (m: RewardUnit) => {
    setMode(m); setSuggested(false); setIcon(m === 'minute' ? 'phone-portrait' : 'wallet');
    if (!rateCosts.includes(cost)) setCost(1);
    if (!amount || !rateAmounts[m].includes(amount)) setAmount(m === 'minute' ? 10 : 20);
  };
  // "Herkes" seçiliyken bir isme dokununca yalnız o çocuk seçilir; sonra isimler ekleyip çıkarılır
  const toggle = (id: string) => setWho((p) => {
    if (!p.length) return kids.length > 1 ? [id] : [];
    const next = p.includes(id) ? p.filter((x) => x !== id) : [...p, id];
    return next.length === kids.length ? [] : next;
  });
  const exchange = mode !== 'item';
  const save = () => {
    if (!title.trim()) return Alert.alert('Ödülün adını yaz');
    if (cost < 1 || cost > 500) return Alert.alert('Fiyat 1–500 taş olmalı');
    if (exchange && amount < 1) return Alert.alert(`Kaç ${unitLabel[mode as RewardUnit]} karşılığı olduğunu seç`);
    if (who.length === 0 && !kids.length) return Alert.alert('Önce bir çocuk ekle');
    onSave({
      id: editing?.id, title, kind: exchange ? 'exchange' : 'item', cost,
      unit: exchange ? (mode as RewardUnit) : undefined, unitAmount: exchange ? amount : undefined, childIds: who, icon,
    });
    onClose();
  };
  const remove = () => editing && Alert.alert('Ödül silinsin mi?', editing.title, [
    { text: 'Vazgeç', style: 'cancel' },
    { text: 'Sil', style: 'destructive', onPress: () => { onDelete(editing.id); onClose(); } },
  ]);
  // Seçili her çocuğun gerçek haftalık kazancı (görev taşları, son 4 hafta) ve bu fiyatın kaç günlük emek olduğu
  const effort = (who.length ? kids.filter((k) => who.includes(k.id)) : kids).map((k) => {
    const w = weeklyEarned(moves, k.id);
    return { name: k.name, w, days: w > 0 && cost > 0 ? Math.max(1, Math.round((cost / w) * 7)) : 0 };
  });
  const Pill = ({ on, label, onPress, a11y }: { on: boolean; label: string; onPress: () => void; a11y?: string }) => (
    <Pressable onPress={onPress} style={[styles.pill, on && styles.pillOn]} accessibilityState={{ selected: on }} accessibilityLabel={a11y}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: on ? '#fff' : colors.navy }}>{label}</Text>
    </Pressable>
  );
  const bold = (t: string) => {
    const i = t.toLocaleLowerCase('tr-TR').indexOf(needle);
    if (i < 0) return <Text>{t}</Text>;
    return <Text>{t.slice(0, i)}<Text style={{ fontWeight: '800' }}>{t.slice(i, i + needle.length)}</Text>{t.slice(i + needle.length)}</Text>;
  };

  return (
    <Modal visible={!!value} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top', 'bottom']}>
        <View style={styles.editorHead}>
          <Pressable onPress={onClose} hitSlop={8} style={{ minWidth: 72, height: 44, justifyContent: 'center' }}>
            <Text style={{ fontSize: 15, color: '#3D4559' }}>Vazgeç</Text>
          </Pressable>
          <Text style={[styles.modalTitle, { fontSize: 17 }]}>{editing ? 'Ödülü düzenle' : 'Yeni ödül'}</Text>
          <Pressable onPress={save} style={styles.saveBtn} accessibilityLabel="Kaydet">
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Kaydet</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 8, gap: 18, paddingBottom: 32 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
          <View style={{ gap: 8 }}>
            <View style={styles.nameBox}>
              <Pressable onPress={() => setPickIcon(!pickIcon)} style={styles.nameIcon} accessibilityLabel="Simge seç">
                <Ionicons name={iconOf(icon)} size={20} color={colors.navy} />
              </Pressable>
              <TextInput value={title} onChangeText={typeTitle} maxLength={60} autoFocus={!value?.reward && !value?.template}
                placeholder="Ödülün adı: dondurma, park…" placeholderTextColor={colors.faint} accessibilityLabel="Ödül adı"
                style={{ flex: 1, minWidth: 0, fontSize: 17, fontWeight: '600', color: colors.navy, paddingVertical: 12 }} />
            </View>
            {matches.length > 0 && (
              <View style={styles.matches}>
                {matches.map((t, i) => (
                  <Pressable key={t.title} onPress={() => useTemplate(t)} style={[styles.match, i > 0 && styles.sep]} accessibilityLabel={`${t.title}, ${priceText(t)}`}>
                    <Ionicons name={t.icon} size={18} color={colors.navy} />
                    <Text style={{ flex: 1, fontSize: 15, color: colors.navy }}>{bold(t.title)}</Text>
                    <Text style={{ fontSize: 13, color: colors.muted }}>{priceText(t)}</Text>
                  </Pressable>
                ))}
              </View>
            )}
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

          {exchange ? (
            <View style={{ gap: 10 }}>
              <View style={styles.rate}>
                <Text style={{ fontSize: 13, color: '#4A5165' }}>Değiş tokuş oranı</Text>
                <Text style={{ fontSize: 30, fontWeight: '800', color: colors.navy }}>{cost} taş = {amount} {unitShort[mode as RewardUnit]}</Text>
                <Text style={{ fontSize: 12, color: '#4A5165' }}>Verirken kaç kez verileceğini seçersin.</Text>
              </View>
              <View style={styles.pills}>
                <Pill on={mode === 'minute'} label="Ekran süresi" onPress={() => setRate('minute')} />
                <Pill on={mode === 'money'} label="Harçlık" onPress={() => setRate('money')} />
              </View>
              <Text style={styles.h}>Kaç taş</Text>
              <View style={styles.pills}>{rateCosts.map((c) => <Pill key={c} on={cost === c} label={String(c)} onPress={() => setCost(c)} a11y={`${c} taş`} />)}</View>
              <Text style={styles.h}>Karşılığı</Text>
              <View style={styles.pills}>
                {rateAmounts[mode as RewardUnit].map((a) => <Pill key={a} on={amount === a} label={`${a} ${unitShort[mode as RewardUnit]}`} onPress={() => setAmount(a)} />)}
              </View>
              <Pressable onPress={() => { setMode('item'); setOther(!prices.includes(cost)); }} hitSlop={8} style={{ alignSelf: 'flex-start', paddingVertical: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.navy, textDecorationLine: 'underline' }}>Tek seferlik ödül olarak kaydet</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <Text style={styles.h}>Fiyat <Text style={{ fontWeight: '500', color: colors.muted }}>{suggested ? '(öneriden geldi)' : '(Güneş Taşı)'}</Text></Text>
              <View style={styles.pills}>
                {prices.map((p) => <Pill key={p} on={!other && cost === p} label={String(p)} onPress={() => { setCost(p); setOther(false); setSuggested(false); }} a11y={`${p} taş`} />)}
                <Pill on={other} label={other ? `${cost || '…'}` : 'Diğer'} onPress={() => { setOther(true); setSuggested(false); }} a11y="Başka fiyat" />
              </View>
              {other && (
                <TextInput value={cost ? String(cost) : ''} onChangeText={(t) => setCost(Math.min(500, Number(t.replace(/\D/g, '')) || 0))} autoFocus
                  keyboardType="number-pad" placeholder="1–500 taş" placeholderTextColor={colors.faint} style={styles.input} accessibilityLabel="Fiyat" />
              )}
            </View>
          )}
          {cost > 0 && effort.length > 0 && (
            <View style={styles.avgNote}>
              {effort.map((e) => (
                <Text key={e.name} style={{ fontSize: 13, lineHeight: 19, color: '#4A5165' }}>
                  {e.w > 0
                    ? `${e.name} haftada ortalama ${e.w} taş kazanıyor: ${exchange ? `${cost} taş` : 'bu ödül'} yaklaşık ${e.days} günlük emek.`
                    : `${e.name} son 4 haftada görevden taş kazanmadı; önce kolay bir ödülle başlamak iyi olabilir.`}
                </Text>
              ))}
            </View>
          )}

          {kids.length > 1 && (
            <View style={{ gap: 10 }}>
              <Text style={styles.h}>Kimler için <Text style={{ fontWeight: '500', color: colors.muted }}>(yanında harcanabilir taşı)</Text></Text>
              <View style={styles.pills}>
                <Pill on={who.length === 0} label="Herkes" onPress={() => setWho([])} />
                {kids.map((k) => <Pill key={k.id} on={who.includes(k.id)} label={`${k.name} · ${bal[k.id] ?? 0} taş`} onPress={() => toggle(k.id)} />)}
              </View>
            </View>
          )}

          {editing && (
            <Pressable onPress={remove} style={{ alignSelf: 'center', padding: 10 }} hitSlop={8}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.danger }}>Ödülü sil</Text>
            </Pressable>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// Taş düşür: miktar, neden (isteğe bağlı, çocuk görür), son onay. Miktar ya da neden seçmek işlem yapmaz.
function DeductSheet({ childId, kids, balances: bal, moves, onClose, onDeduct }: {
  childId: string | null; kids: Child[]; balances: Record<string, number>; moves: StoneMove[];
  onClose: () => void; onDeduct: (id: string, n: number, note: string) => void;
}) {
  const [id, setId] = useState('');
  const [n, setN] = useState(1);
  const [other, setOther] = useState(false);
  const [note, setNote] = useState('');
  useEffect(() => { if (childId !== null) { setId(childId || kids[0]?.id || ''); setN(1); setOther(false); setNote(''); } }, [childId]); // eslint-disable-line react-hooks/exhaustive-deps
  const b = bal[id] ?? 0;
  const name = kids.find((k) => k.id === id)?.name ?? '';
  // Son 7 günde düşürülen taş (bu dahil) × 4 > kazanılan görev taşı ise uyar (ekonomi.md: seyrek kullanım)
  const heavy = useMemo(() => {
    const since = new Date(Date.now() - 7 * 864e5).toISOString();
    const week = moves.filter((m) => m.childId === id && m.at >= since);
    const earned = week.filter((m) => m.reason === 'task').reduce((a, m) => a + m.amount, 0);
    const lost = -week.filter((m) => m.reason === 'penalty').reduce((a, m) => a + m.amount, 0);
    return (lost + n) * 4 > earned;
  }, [id, moves, n]);
  const submit = () => { onDeduct(id, n, note); onClose(); };
  return (
    <Sheet visible={childId !== null} title={name ? `${fromName(name)} taş düşür` : 'Taş düşür'} onClose={onClose}>
      <View style={{ gap: 14 }}>
        {kids.length > 1 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {kids.map((k) => (
              <Pressable key={k.id} onPress={() => setId(k.id)} style={[styles.chip, styles.chipLine, id === k.id && styles.chipOn]} accessibilityState={{ selected: id === k.id }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: id === k.id ? '#fff' : colors.navy }}>{k.name} · {bal[k.id] ?? 0}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <Text style={styles.boxTitle}>Kaç taş?</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {amounts.map((a) => (
            <Pressable key={a} onPress={() => { setN(a); setOther(false); }} style={[styles.chip, styles.chipLine, styles.amount, !other && n === a && styles.chipOn]}
              accessibilityLabel={`${a} taş`} accessibilityState={{ selected: !other && n === a }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: !other && n === a ? '#fff' : colors.navy }}>{a}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setOther(true)} style={[styles.chip, styles.chipLine, other && styles.chipOn]}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: other ? '#fff' : colors.navy }}>Başka…</Text>
          </Pressable>
        </View>
        {other && <Stepper value={n} min={1} max={100} onChange={setN} />}
        <Text style={styles.boxTitle}>Neden? <Text style={{ fontWeight: '500', color: colors.muted }}>(isteğe bağlı · çocuk görür)</Text></Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {reasons.map((r) => (
            <Pressable key={r} onPress={() => setNote(note === r ? '' : r)} style={[styles.chip, styles.chipLine, note === r && styles.chipOn]}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: note === r ? '#fff' : colors.navy }}>{r}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput value={note} onChangeText={setNote} maxLength={100} placeholderTextColor={colors.faint}
          placeholder="Ya da kendi cümlen" style={styles.input} accessibilityLabel="Neden" />
        <View style={styles.info}>
          <Text style={{ fontSize: 13, lineHeight: 18, color: '#3D4559' }}>
            {b} → <Text style={{ fontWeight: '800' }}>{Math.max(0, b - n)}</Text> · Adada kazandığı taşlar ve adası etkilenmez; yalnız harcanabilir taş azalır.
          </Text>
        </View>
        {heavy && (
          <View style={styles.warn}>
            <Ionicons name="alert-circle-outline" size={18} color="#6B5300" />
            <Text style={{ flex: 1, fontSize: 13, lineHeight: 18, color: '#6B5300' }}>
              {name}: bu hafta düşürülen taş, kazanılanın dörtte birini geçti.
            </Text>
            <Info title="Taş düşürme" color="#6B5300" text="Önce kazandırmaya ve övmeye ağırlık vermek daha iyi sonuç verir. Taş düşürmeyi yalnız önceden konuşulan kurallar için ve seyrek kullan; çocuk nedenini görür." />
          </View>
        )}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable onPress={onClose} style={[styles.btn, { flex: 1, backgroundColor: '#F1F2F6' }]}><Text style={[styles.btnText, { color: colors.navy }]}>Vazgeç</Text></Pressable>
          <Pressable onPress={submit} disabled={!id || b < n} style={[styles.btn, { flex: 2, backgroundColor: colors.danger }, (!id || b < n) && { opacity: 0.45 }]}>
            <Text style={styles.btnText}>{b < n ? 'Bakiye yetersiz' : `${n} taş düşür`}</Text>
          </Pressable>
        </View>
      </View>
    </Sheet>
  );
}

// Geçmiş: son taş hareketleri (sağ üstteki saat simgesi)
function HistorySheet({ visible, moves, nameOf, onClose }: { visible: boolean; moves: StoneMove[]; nameOf: (id: string) => string; onClose: () => void }) {
  return (
    <Sheet visible={visible} title="Geçmiş" onClose={onClose}>
      {!moves.length ? <Text style={{ fontSize: 14, color: colors.muted }}>Henüz taş hareketi yok.</Text> : (
        <View style={styles.box}>
          {moves.slice(0, 60).map((m, i) => (
            <View key={m.id} style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }, i > 0 && styles.sep]}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, color: colors.navy }}>{moveLabel[m.reason]}{m.note ? `: ${m.note}` : ''}</Text>
                <Text style={{ fontSize: 11, color: colors.muted }}>{nameOf(m.childId)} · {formatTR(toISO(new Date(m.at)))}</Text>
              </View>
              <Text style={{ fontSize: 15, fontWeight: '700', color: m.amount > 0 ? colors.easy.fg : colors.danger }}>{m.amount > 0 ? `+${m.amount}` : m.amount}</Text>
            </View>
          ))}
        </View>
      )}
    </Sheet>
  );
}

// Bilgilendirme: ilk açılışta (ve ⓘ ile) gösterilir
function Intro({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const items: [keyof typeof Ionicons.glyphMap, string, string][] = [
    ['sunny-outline', 'Görevle kazanılır', 'Onayladığın her görev Güneş Taşı kazandırır: kolay 1, orta 2, zor 3.'],
    ['gift-outline', 'Ödülü sen belirlersin', 'Önerilere dokunarak ekle ya da kendin oluştur. Vermek için ödülün yanındaki çocuk harfine dokun, sonra onayla.'],
    ['hand-left-outline', 'Çocuğun da isteyebilir', 'Taşı yetince oyundan ister; istek en üstte çıkar, onayı sen verirsin.'],
    ['remove-circle-outline', 'Gerektiğinde taş düşür', 'Çocuğun bakiyesindeki − ile. Yalnız önceden konuşulan kurallar için ve seyrek; çocuk nedenini görür.'],
    // hukuk/50 §8: sanal değer para değildir; ödül ebeveyn–çocuk arasında
    ['information-circle-outline', 'Parasal değeri yok', 'Coin yalnız Pofi Adası eşyalarına harcanır; satın alınamaz, paraya çevrilemez. Güneş Taşı senin verdiğin ödüllerin sayacıdır; ödülün sözünü sen verirsin, biz bu ödüllerin tarafı değiliz.'],
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
  minus: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.hard.bg, backgroundColor: '#FFF8F9', alignItems: 'center', justifyContent: 'center' },
  warn: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: radius.sm, backgroundColor: '#FFF6DE' },
  balance: { minWidth: 150, height: 52, borderRadius: radius.md, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 10, paddingRight: 8 },
  letter: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  letterShort: { backgroundColor: '#F3F4F7' },
  letterOn: { borderWidth: 3, borderColor: colors.navy },
  request: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF6DE', borderRadius: radius.md, paddingVertical: 8, paddingLeft: 12, paddingRight: 8 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  suggest: { height: 40, paddingLeft: 10, paddingRight: 14, borderRadius: 20, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 6 },
  toastWarn: { backgroundColor: '#FFF6DE', borderWidth: 1.5, borderColor: colors.gold, paddingLeft: 12, gap: 10 },
  deleteAction: { width: 84, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  allBtn: { minHeight: 44, paddingHorizontal: 10, justifyContent: 'center', marginRight: -10 },
  editorHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  saveBtn: { minWidth: 72, height: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  nameBox: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 12, borderRadius: 16, borderWidth: 2, borderColor: colors.navy },
  nameIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F2F6', alignItems: 'center', justifyContent: 'center' },
  matches: { borderRadius: 14, backgroundColor: '#F5F6F8', overflow: 'hidden' },
  match: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 14 },
  rate: { backgroundColor: '#F5F6F8', borderRadius: 18, padding: 16, alignItems: 'center', gap: 4 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { minWidth: 52, height: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: '#E1E4EB', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  pillOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  avgNote: { gap: 4, backgroundColor: '#FFF6DE', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  chipLine: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#D5D9E2', minHeight: 40, justifyContent: 'center' },
  amount: { minWidth: 44, alignItems: 'center' },
  fab: { position: 'absolute', right: 20, bottom: 34, height: 56, paddingHorizontal: 22, borderRadius: 28, backgroundColor: colors.navy, flexDirection: 'row', alignItems: 'center', gap: 8, shadowColor: '#0F1B3D', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  toast: { position: 'absolute', left: 16, right: 16, bottom: 100, backgroundColor: colors.navy, borderRadius: 14, paddingVertical: 6, paddingLeft: 16, paddingRight: 6, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 8 },
  confirm: { position: 'absolute', left: 12, right: 12, backgroundColor: '#fff', borderRadius: 22, padding: 16, gap: 14, shadowColor: '#0F1B3D', shadowOpacity: 0.22, shadowRadius: 30, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  btn: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E1E4EA', paddingHorizontal: 12 },
  groupTitle: { fontSize: 12, fontWeight: '700', color: '#5B6274', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 6 },
  added: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: '#E6F4EA' },
  addBtn: { height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.navy, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  info: { backgroundColor: '#F5F6F8', borderRadius: radius.sm, padding: 12 },
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
