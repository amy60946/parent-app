import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, radius, difficultyMeta } from '../theme';
import { Avatar, Card } from './ui';
import Sheet from './Sheet';
import { useStore } from '../store';
import { formatTR, todayISO } from '../dates';
import VerifiedBadge from './VerifiedBadge';
import { Toggle } from './ui';
import {
  ClinicLink, InvitePreview, Suggestion, PendingInvite, listLinks, previewInvite, shareWithClinic, stopSharing, addChildToClinic,
  pendingSuggestions, decideSuggestion, linkSuggestionTask, pendingInvites, claimInvite, setHistoryShared,
} from '../lib/clinic';

type View_ = 'home' | 'code';

// Uzmanla paylaş: kodla bağlan (açık rıza), paylaşımları yönet, uzman önerilerini kabul et, gözlem notu ekle
export default function ClinicShareSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [view, setView] = useState<View_>('home');
  const navigation = useNavigation<any>();
  const close = () => { setView('home'); onClose(); };
  const title = view === 'code' ? 'Uzmanla paylaş' : 'Uzmanım';
  // Gözlem notu artık kendi ekranında (Gelişim'den de açılır)
  const openAbc = () => { close(); navigation.navigate('Abc', { new: true }); };
  return (
    <Sheet visible={visible} title={title} onClose={close}>
      {view === 'home' && <Home onCode={() => setView('code')} onAbc={openAbc} visible={visible} onOpen={(to, params) => { close(); navigation.navigate(to, params); }} />}
      {view === 'code' && <CodeFlow onDone={() => setView('home')} onInvite={(invite) => { close(); navigation.navigate('Invite', { invite }); }} />}
    </Sheet>
  );
}

/* ---------- Ana görünüm ---------- */

function Home({ onCode, onAbc, visible, onOpen }: {
  onCode: () => void; onAbc: () => void; visible: boolean; onOpen: (to: string, params: object) => void;
}) {
  const { children, familyId, addTasks } = useStore();
  const [links, setLinks] = useState<ClinicLink[] | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);

  const load = useCallback(async () => {
    try {
      setLinks(await listLinks());
      setInvites(await pendingInvites().catch(() => []));
      if (familyId) setSuggestions(await pendingSuggestions(familyId));
    } catch (e) {
      setLinks([]);
      Alert.alert('Yüklenemedi', (e as Error).message);
    }
  }, [familyId]);
  useEffect(() => { if (visible) load(); }, [visible, load]);

  const childName = (id: string) => children.find((c) => c.id === id)?.name ?? '';

  // Uzman (klinik) başına grupla: her uzmanın altında ailenin bütün çocukları, paylaşılan/paylaşılmayan
  const clinics = Object.values((links ?? []).reduce<Record<string, ClinicLink[]>>((acc, l) => {
    (acc[l.clinicId] ??= []).push(l);
    return acc;
  }, {}));

  const add = (first: ClinicLink, childId: string) => Alert.alert(
    `${childName(childId)} da paylaşılsın mı?`,
    `${first.clinician || first.clinic}, ${childName(childId)} için görevleri, tamamlanma durumunu ve gözlem notlarını görebilecek. Mesajlar ve coin paylaşılmaz. İstediğin an durdurabilirsin.`,
    [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Onaylıyorum, paylaş',
        onPress: async () => {
          try { await addChildToClinic(first.clinicId, childId); load(); } catch (e) { Alert.alert('Paylaşılamadı', (e as Error).message); }
        },
      },
    ],
  );

  const stop = (l: ClinicLink) => Alert.alert(
    `${childName(l.childId)} paylaşımdan çıkarılsın mı?`,
    `${l.clinician || l.clinic}, ${childName(l.childId)} için yeni verileri artık göremez. Daha önce aldığı notlar uzmanda kalır.`,
    [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Çıkar', style: 'destructive',
        onPress: async () => {
          try { await stopSharing(l.linkId); load(); } catch (e) { Alert.alert('Durdurulamadı', (e as Error).message); }
        },
      },
    ],
  );

  // Önceki uzman kayıtlarının bu uzmana aktarımı: açarken açık rıza metni (uzman-gecis-v1), kapatınca erişim hemen biter
  const history = (l: ClinicLink, on: boolean) => {
    const name = childName(l.childId);
    const who = l.clinician || l.clinic;
    const apply = async () => {
      try { await setHistoryShared(l.linkId, on); load(); } catch (e) { Alert.alert('Kaydedilemedi', (e as Error).message); }
    };
    if (!on) {
      return Alert.alert('Önceki kayıtların paylaşımı durdurulsun mu?', `${who}, ${name} için önceki uzmanların kayıtlarını artık göremez.`,
        [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Durdur', style: 'destructive', onPress: apply }]);
    }
    Alert.alert('Önceki uzmanın kayıtlarını da paylaş (adı gizlenir)',
      `Çocuğum ${name} için daha önce çalıştığım uzman(lar)ın ClinicApp'e girdiği notların, hedeflerin, haftalık değerlendirmelerin, görev önerilerinin, aile programının ve benim uygulama kayıtlarımın, takibin kesintisiz sürmesi amacıyla yeni uzmanım ${who} ile yalnız okunur olarak paylaşılmasına açık rıza veriyorum. Önceki uzmanın adı ve bilgileri yeni uzmana gösterilmez. Bu izni Uzmanım bölümünden istediğim an geri alabilirim; geri aldığımda erişim hemen sona erer.`,
      [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Onaylıyorum', onPress: apply }]);
  };

  const decide = async (s: Suggestion, accept: boolean) => {
    try {
      await decideSuggestion(s.id, accept);
      // Kabul: öneri alanları göreve birebir taşınır; başlangıç yoksa ya da geçmişse bugün (akislar.md 5.4, 3a)
      const start = s.startDate && s.startDate > todayISO() ? s.startDate : todayISO();
      if (accept) {
        addTasks([{
          title: s.title, emoji: s.emoji, skill: s.skill, description: s.description,
          assignments: [{ childId: s.childId, difficulty: s.difficulty, coins: s.coins ?? difficultyMeta[s.difficulty].coins }],
          startDate: start, recurring: s.recurring, repeatKind: s.repeatKind, repeatDays: s.repeatDays,
          endDate: s.endDate && s.endDate >= start ? s.endDate : undefined, reminder: s.reminder, requiresReview: s.requiresReview,
        }], ([taskId]) => { if (taskId) linkSuggestionTask(s.id, taskId).catch(() => {}); });
      }
      setSuggestions((p) => p.filter((x) => x.id !== s.id));
      if (accept) Alert.alert('Görev eklendi', `"${s.title}" ${start === todayISO() ? 'bugünden' : formatTR(start) + ' tarihinden'} itibaren ${childName(s.childId)} için görevlerde.`);
    } catch (e) {
      Alert.alert('Kaydedilemedi', (e as Error).message);
    }
  };

  if (!links) return <ActivityIndicator color={colors.navy} style={{ marginVertical: 30 }} />;

  return (
    <View style={{ gap: 14 }}>
      {/* Uzmanın daveti bağlandı ama çocuk henüz paylaşılmadı (akislar.md 10 adım 6) */}
      {invites.map((inv) => (
        <Pressable key={inv.code} onPress={() => onOpen('Invite', { invite: inv })} style={styles.invite}
          accessibilityLabel={`${inv.clinician || inv.clinic} seni bekliyor, çocuğunu paylaş`}>
          <Ionicons name="mail-unread-outline" size={20} color={colors.navy} />
          <View style={{ flex: 1 }}>
            <Text style={styles.h}>{inv.clinician || inv.clinic} seni bekliyor</Text>
            <Text style={styles.cap}>{inv.childName ? `${inv.childName} için bilgileri kontrol et ve paylaş` : 'Çocuğunu seç ve paylaş'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.navy} />
        </Pressable>
      ))}
      {links.length === 0 ? (
        <Text style={styles.body}>
          Çocuğunla çalışan bir uzman (psikolog, ergoterapist, öğretmen) varsa, görev ilerlemesini onunla paylaşabilirsin.
          Uzman sana 6 haneli bir kod verir.
        </Text>
      ) : (
        <View style={{ gap: 8 }}>
          {clinics.map((group) => {
            const first = group[0];
            return (
              <Card key={first.clinicId} style={{ gap: 10, backgroundColor: '#F7F8FB' }}>
                <View style={{ gap: 3 }}>
                  <Text style={styles.h}>{first.clinician || first.clinic}</Text>
                  <Text style={styles.cap}>{[first.title, first.clinic].filter(Boolean).join(' · ')}</Text>
                  <VerifiedBadge verifiedAs={first.verifiedAs} />
                </View>
                {children.map((c) => {
                  const l = group.find((x) => x.childId === c.id);
                  return (
                    <View key={c.id} style={[styles.childRow, { flexDirection: 'column', alignItems: 'stretch' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Avatar id={c.avatar} size={36} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.navy }}>{c.name}</Text>
                        <Text style={styles.cap}>{l ? `Paylaşılıyor · ${formatTR(l.consentAt.slice(0, 10))}` : 'Paylaşılmıyor'}</Text>
                      </View>
                      {l ? (
                        <Pressable onPress={() => stop(l)} hitSlop={8} accessibilityLabel={`${c.name} paylaşımını durdur`}>
                          <Text style={{ color: colors.danger, fontSize: 13, fontWeight: '600' }}>Çıkar</Text>
                        </Pressable>
                      ) : (
                        <Pressable onPress={() => add(first, c.id)} hitSlop={8} accessibilityLabel={`${c.name} çocuğunu da paylaş`}>
                          <Text style={{ color: colors.navy, fontSize: 13, fontWeight: '700' }}>Ekle</Text>
                        </Pressable>
                      )}
                    </View>
                    {l?.planReady && (
                      <Pressable style={styles.sub} onPress={() => onOpen('CarePlan', { linkId: l.linkId, childName: c.name, clinician: first.clinician || first.clinic })}
                        accessibilityLabel={`${c.name} takip planı`}>
                        <Ionicons name="clipboard-outline" size={16} color={colors.navy} />
                        <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: colors.navy }}>Takip planı</Text>
                        <Ionicons name="chevron-forward" size={14} color={colors.faint} />
                      </Pressable>
                    )}
                    {l?.historyAvailable && (
                      <View style={styles.sub}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.navy }}>Önceki uzmanın kayıtları</Text>
                          <Text style={styles.cap}>{l.historyShared ? 'Paylaşılıyor · önceki uzmanın adı gizli' : 'Paylaşılmıyor'}</Text>
                        </View>
                        <Toggle value={l.historyShared} onChange={(on) => history(l, on)} />
                      </View>
                    )}
                    </View>
                  );
                })}
              </Card>
            );
          })}
        </View>
      )}

      {suggestions.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={styles.section}>Uzman önerileri</Text>
          {suggestions.map((s) => (
            <Card key={s.id} style={{ gap: 10, backgroundColor: '#F7F8FB' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ fontSize: 24 }}>{s.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.h}>{s.title}</Text>
                  <Text style={styles.cap}>{childName(s.childId)} · {difficultyMeta[s.difficulty].label} · {s.coins ?? difficultyMeta[s.difficulty].coins} coin · {s.clinic}</Text>
                </View>
              </View>
              <Text style={styles.cap}>{scheduleText(s)}</Text>
              {!!s.description && <Text style={styles.body}>{s.description}</Text>}
              {!!s.note && <Text style={[styles.body, { fontStyle: 'italic' }]}>Uzmanın notu: {s.note}</Text>}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable style={[styles.ghost, { flex: 1 }]} onPress={() => decide(s, false)}>
                  <Text style={{ color: colors.navy, fontWeight: '600' }}>Şimdilik değil</Text>
                </Pressable>
                <Pressable style={[styles.cta, { flex: 1, height: 44 }]} onPress={() => decide(s, true)}>
                  <Text style={styles.ctaText}>Görevlere ekle</Text>
                </Pressable>
              </View>
            </Card>
          ))}
        </View>
      )}

      {links.length > 0 && (
        <Pressable style={styles.row} onPress={onAbc}>
          <Ionicons name="pulse-outline" size={20} color={colors.navy} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, color: colors.navy }}>Gözlem notu ekle</Text>
            <Text style={styles.cap}>Ne oldu, öncesinde ve sonrasında. Uzmanın görür.</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.faint} />
        </Pressable>
      )}

      <Pressable style={styles.cta} onPress={onCode}>
        <Text style={styles.ctaText}>{links.length ? 'Başka bir uzman kodu gir' : 'Uzman kodunu gir'}</Text>
      </Pressable>
    </View>
  );
}

/* ---------- Kod + açık rıza ---------- */

function CodeFlow({ onDone, onInvite }: { onDone: () => void; onInvite: (invite: PendingInvite) => void }) {
  const { children } = useStore();
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [childIds, setChildIds] = useState<string[]>(children.length === 1 ? [children[0].id] : []);
  const toggle = (id: string) => setChildIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const [busy, setBusy] = useState(false);

  const check = async () => {
    if (code.length !== 6) return Alert.alert('Kod 6 karakter olmalı');
    setBusy(true);
    try {
      // Yeni sunucu: kod daveti bu aileye bağlar, davet ekranı açılır (uyarı + veli beyanı). Eski sunucu: eski önizleme + onay.
      const invite = await claimInvite(code);
      if (invite) return onInvite(invite);
      setPreview(await previewInvite(code));
    } catch (e) {
      Alert.alert('Kod kullanılamadı', (e as Error).message);
    } finally { setBusy(false); }
  };

  const consent = async () => {
    if (!childIds.length) return Alert.alert('Hangi çocuklar için paylaşılacağını seç');
    setBusy(true);
    try {
      await shareWithClinic(code, childIds);
      Alert.alert('Paylaşım başladı', 'İstediğin zaman Uzmanım bölümünden durdurabilirsin.');
      onDone();
    } catch (e) {
      Alert.alert('Paylaşılamadı', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!preview) {
    return (
      <View style={{ gap: 14 }}>
        <Text style={styles.body}>Uzmanının sana verdiği 6 haneli kodu yaz. Onaylamadan önce kimin istediğini göreceksin.</Text>
        <TextInput
          value={code}
          onChangeText={(v) => setCode(v.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6))}
          placeholder="KOD"
          placeholderTextColor={colors.faint}
          autoCapitalize="characters"
          autoCorrect={false}
          style={[styles.input, { fontSize: 24, fontWeight: '800', letterSpacing: 6, textAlign: 'center' }]}
        />
        <Pressable style={[styles.cta, busy && { opacity: 0.6 }]} disabled={busy} onPress={check}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Devam</Text>}
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ gap: 14 }}>
      <Card style={{ backgroundColor: '#F7F8FB', gap: 2 }}>
        <Text style={styles.h}>{preview.clinician || preview.clinic}</Text>
        <Text style={styles.cap}>{[preview.title, preview.clinic].filter(Boolean).join(' · ')}</Text>
      </Card>

      <Text style={styles.section}>Hangi çocuklar için? (birden çok seçebilirsin)</Text>
      <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
        {children.map((c) => (
          <Pressable key={c.id} onPress={() => toggle(c.id)} accessibilityState={{ selected: childIds.includes(c.id) }}
            style={{ alignItems: 'center', gap: 4, opacity: childIds.includes(c.id) ? 1 : 0.5 }}>
            <Avatar id={c.avatar} size={48} ring={childIds.includes(c.id)} />
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.navy }}>
              {childIds.includes(c.id) ? '✓ ' : ''}{c.name}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.section}>Uzmanın görecekleri</Text>
      <View style={{ gap: 8 }}>
        <Bullet ok text="Görevler ve tamamlanma durumu (saatiyle)" />
        <Bullet ok text='"Yapamam" yanıtları ve nedenleri' />
        <Bullet ok text="Bu uygulamada eklediğin gözlem notları" />
        <Bullet text="Mesajlar, fotoğraf ve sesler" />
        <Bullet text="Coin bakiyesi ve oyun içi bilgiler" />
      </View>
      <Text style={styles.cap}>
        Uzman verileri yalnızca okur ve sana görev önerebilir; görev eklemek senin kararındır.
        Paylaşımı istediğin an durdurabilirsin.
      </Text>

      <Pressable style={[styles.cta, (busy || !childIds.length) && { opacity: 0.6 }]} disabled={busy} onPress={consent}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Onaylıyorum, paylaş</Text>}
      </Pressable>
      <Pressable style={styles.ghost} onPress={onDone}><Text style={{ color: colors.navy, fontWeight: '600' }}>Vazgeç</Text></Pressable>
    </View>
  );
}

function Bullet({ ok, text }: { ok?: boolean; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Ionicons name={ok ? 'checkmark-circle' : 'close-circle-outline'} size={18} color={ok ? colors.easy.fg : colors.faint} />
      <Text style={[styles.body, !ok && { color: colors.muted }]}>{text}{ok ? '' : ' paylaşılmaz'}</Text>
    </View>
  );
}

// "Pzt, Çar, Cum · 18:00'de hatırlat · 30 Kasım'a kadar · İnceleme gerekli"
const weekDays = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
function scheduleText(s: Suggestion) {
  const when = !s.recurring ? 'Bir kez'
    : s.repeatKind === 'weekly' && s.repeatDays.length ? [...s.repeatDays].sort((a, b) => a - b).map((d) => weekDays[d - 1]).filter(Boolean).join(', ')
    : s.repeatKind === 'monthly' && s.repeatDays.length ? `Her ay ${[...s.repeatDays].sort((a, b) => a - b).join(', ')}. gün`
    : 'Her gün';
  return [
    when,
    s.startDate && s.startDate > todayISO() ? `${formatTR(s.startDate)} başlar` : '',
    s.endDate ? `${formatTR(s.endDate)} tarihine kadar` : '',
    s.reminder ? `${s.reminder} hatırlatma` : '',
    s.requiresReview ? 'Onayınla tamamlanır' : 'Onaysız tamamlanır',
  ].filter(Boolean).join(' · ');
}

const styles = StyleSheet.create({
  h: { fontSize: 15, fontWeight: '600', color: colors.navy },
  cap: { fontSize: 12, color: colors.muted },
  body: { fontSize: 13, color: colors.navy, lineHeight: 19 },
  section: { fontSize: 13, fontWeight: '600', color: colors.muted },
  childRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  input: { letterSpacing: 0, backgroundColor: '#F3F4F8', borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.navy, marginTop: 4 },
  cta: { height: 52, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  ghost: { height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  invite: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF6DE', borderRadius: radius.md, padding: 14, borderWidth: 1, borderColor: '#F3DFA2' },
  sub: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 46, paddingVertical: 6 },
  dot: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3F4F8', alignItems: 'center', justifyContent: 'center' },
});
