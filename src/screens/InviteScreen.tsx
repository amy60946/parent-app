import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Alert, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { Avatar, Card, IconButton } from '../components/ui';
import DateField from '../components/DateField';
import VerifiedBadge from '../components/VerifiedBadge';
import { CodeBox } from '../components/CodeBox';
import Info from '../components/Info';
import { SCOPE_FULL, SCOPE_SHORT, SHARE_WARNING, SHARE_WARNING_SHORT, historyConsent } from '../data/clinicTexts';
import { useStore, IssuedCode } from '../store';
import { childAvatars } from '../data/avatars';
import { ageBands, AgeBand } from '../data/ageBands';
import { hintOf } from '../lib/errors';
import { requestPremium } from '../lib/billing';
import { track } from '../lib/track';
import { PendingInvite, NewChild, acceptInvite, declineInvite, INVITE_FINAL, inviteErrorTitle } from '../lib/clinic';

// Uzman daveti (ortak/sozlesme/akislar.md 10 adım 6–6d): uzmanın önerdiği çocuğu ebeveyn kontrol eder, düzeltir, onaylar.
// Paylaşım yalnız ebeveynin onayıyla; onay metinlerinin sürümü sunucuda kaydedilir (hukuk_notlari.md 3B, 3F).
export default function InviteScreen({ navigation, route }: any) {
  const invite: PendingInvite = route.params.invite;
  const { children, refresh, createChildCode } = useStore();
  const who = invite.clinician || invite.clinic || 'Uzmanın';
  const suggested = !!invite.childName;

  // Yeni çocuk (önerilen ya da ebeveynin yazdığı) + ailede zaten olan çocuklar
  const [newOn, setNewOn] = useState(suggested || children.length === 0);
  const [name, setName] = useState(invite.childName ?? '');
  const [group, setGroup] = useState<AgeBand | undefined>(invite.childAgeGroup);
  const [more, setMore] = useState(false);
  const [birthday, setBirthday] = useState<string | undefined>();
  const [gender, setGender] = useState<'kız' | 'erkek' | undefined>();
  const [avatar, setAvatar] = useState('kedi');
  const [picked, setPicked] = useState<string[]>([]);
  const [history, setHistory] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ childIds: string[]; newId?: string } | null>(null);

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const pickedNames = children.filter((c) => picked.includes(c.id)).map((c) => c.name);
  const validNew = !newOn || (name.trim().length > 0 && name.trim().length <= 40);
  const canSend = agreed && validNew && (newOn || picked.length > 0) && !busy;

  const child = (allowDuplicate = false): NewChild | null => (newOn ? {
    name: name.trim(), age_group: group, birthday, gender, avatar, ...(allowDuplicate ? { allow_duplicate: true } : {}),
  } : null);

  const send = async (newChild: NewChild | null, ids: string[]) => {
    setBusy(true);
    try {
      const r = await acceptInvite(invite.code, newChild, ids, history && ids.length > 0);
      if (!r.ok) {
        // Aynı adda çocuk ailede var: aynı çocuksa onu seç, değilse yine de ekle
        const d = r.duplicate;
        Alert.alert(`Kayıtlarında ${d.name} adında bir çocuk var`, 'Aynı çocuksa onu seç; değilse yine de yeni ekleyebilirsin.', [
          { text: 'Vazgeç', style: 'cancel' },
          { text: 'Yine de yeni ekle', onPress: () => send(child(true), ids) },
          // Mevcut çocuk seçilir, gönderilmez: önceki uzman kayıtları seçeneği ve rıza metni ekranda görünsün, ebeveyn yeniden onaylasın
          { text: `Bu ${d.name}`, onPress: () => { setNewOn(false); setPicked((p) => [...new Set([...p, d.childId])]); } },
        ]);
        return;
      }
      track('invite.accept', { n: r.childIds.length, new: !!newChild, history: history && ids.length > 0 });
      await refresh();
      setDone({ childIds: r.childIds, newId: r.childIds.find((x) => !ids.includes(x)) });
    } catch (e) {
      const hint = hintOf(e);
      if (hint === 'premium_required') requestPremium((e as Error).message);
      else if (hint && INVITE_FINAL.includes(hint)) {
        Alert.alert(inviteErrorTitle(hint), (e as Error).message, [{ text: 'Tamam', onPress: () => navigation.goBack() }]);
      } else Alert.alert('Paylaşılamadı', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const decline = () => Alert.alert(
    'Bu davet sana ait değil mi?',
    `Davet kapanır ve ${who} bilgilendirilir. Hiçbir bilgin paylaşılmaz.`,
    [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Daveti kapat', style: 'destructive',
        onPress: async () => {
          try { await declineInvite(invite.code); track('invite.decline'); navigation.goBack(); }
          catch (e) { Alert.alert('Kapatılamadı', (e as Error).message); }
        },
      },
    ],
  );

  if (done) return <Done invite={invite} who={who} done={done} onClose={() => navigation.goBack()} createChildCode={createChildCode} />;

  const label = ageBands.find((b) => b.id === invite.childAgeGroup)?.label;
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Uzman daveti</Text>
        <IconButton name="close" label="Kapat" onPress={() => navigation.goBack()} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={styles.medal}><Ionicons name="medkit-outline" size={22} color={colors.navy} /></View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.h}>{who}</Text>
              {!!(invite.title || invite.clinic) && <Text style={styles.cap}>{[invite.title, invite.clinic].filter(Boolean).join(' · ')}</Text>}
              <VerifiedBadge verifiedAs={invite.verifiedAs} />
            </View>
          </Card>

          <Text style={styles.lead}>
            {suggested
              ? `${invite.childName}${label ? ` (${label})` : ''} için davet. Bilgiler doğru mu?`
              : 'Hangi çocuğun için?'}
          </Text>

          {/* Yeni çocuk: önerilen bilgiler dolu ve düzenlenebilir */}
          <Card style={{ gap: 12 }}>
            {children.length > 0 && (
              <Pressable style={styles.checkRow} onPress={() => setNewOn(!newOn)} accessibilityRole="checkbox" accessibilityState={{ checked: newOn }}>
                <Check on={newOn} />
                <Text style={styles.h}>{suggested ? `${invite.childName} yeni çocuk olarak eklensin` : 'Yeni çocuk ekle'}</Text>
              </Pressable>
            )}
            {newOn && (
              <View style={{ gap: 12 }}>
                <View>
                  <Text style={styles.cap}>Çocuğun adı ya da takma adı</Text>
                  <TextInput value={name} onChangeText={setName} maxLength={40} placeholder="Ad" placeholderTextColor={colors.muted} style={styles.input} />
                </View>
                <View style={{ gap: 6 }}>
                  <Text style={styles.cap}>Yaş grubu</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {ageBands.map((b) => (
                      <Pressable key={b.id} onPress={() => setGroup(b.id)} style={[styles.chip, group === b.id && styles.chipOn]}
                        accessibilityState={{ selected: group === b.id }}>
                        <Text style={[styles.chipText, group === b.id && { color: '#fff' }]}>{b.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <Pressable onPress={() => setMore(!more)} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.navy }}>Doğum günü, cinsiyet, simge (isteğe bağlı)</Text>
                  <Ionicons name={more ? 'chevron-up' : 'chevron-down'} size={14} color={colors.navy} />
                </Pressable>
                {more && (
                  <View style={{ gap: 12 }}>
                    <View>
                      <Text style={styles.cap}>Doğum günü</Text>
                      <DateField mode="date" value={birthday} onChange={setBirthday} placeholder="Seç" clearable maximumDate={new Date()} />
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {(['kız', 'erkek'] as const).map((g) => (
                        <Pressable key={g} onPress={() => setGender(gender === g ? undefined : g)} style={[styles.chip, gender === g && styles.chipOn]}>
                          <Text style={[styles.chipText, gender === g && { color: '#fff' }]}>{g === 'kız' ? 'Kız' : 'Erkek'}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                      {childAvatars.map((a) => (
                        <Pressable key={a.id} onPress={() => setAvatar(a.id)} accessibilityLabel={a.name} accessibilityState={{ selected: avatar === a.id }}>
                          <Avatar id={a.id} size={46} ring={avatar === a.id} />
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            )}
          </Card>

          {children.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text style={styles.section}>Ailendeki çocuklardan da paylaşmak istediklerin</Text>
              <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
                {children.map((c) => (
                  <Pressable key={c.id} onPress={() => toggle(c.id)} accessibilityState={{ selected: picked.includes(c.id) }}
                    style={{ alignItems: 'center', gap: 4, opacity: picked.includes(c.id) ? 1 : 0.5 }}>
                    <Avatar id={c.avatar} size={48} ring={picked.includes(c.id)} />
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.navy }}>{picked.includes(c.id) ? '✓ ' : ''}{c.name}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Uzman değişimi: önceki uzmanın kayıtları (adı gizlenir), açık rıza metni uzman-gecis-v1 */}
          {picked.length > 0 && (
            <Card style={{ gap: 10 }}>
              <Pressable style={styles.checkRow} onPress={() => setHistory(!history)} accessibilityRole="checkbox" accessibilityState={{ checked: history }}>
                <Check on={history} />
                <Text style={[styles.h, { flex: 1 }]}>Önceki uzmanın kayıtlarını da paylaş (adı gizlenir)</Text>
                <Info title="Önceki uzmanın kayıtları" text={`${historyConsent(pickedNames.join(', '), who)}\n\nDaha önce başka bir uzmanla paylaşmadıysan aktarılacak kayıt yoktur.`} />
              </Pressable>
            </Card>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[styles.cap, { flex: 1 }]}>{SCOPE_SHORT}</Text>
            <Info title="Uzman ne görür?" text={SCOPE_FULL} />
          </View>

          {/* Zorunlu uyarı + veli beyanı (uzman-paylasim-v1); rozet olsa da kalır */}
          <View style={styles.warn}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="alert-circle-outline" size={20} color="#6B5300" />
              <Text style={[styles.h, { flex: 1, color: '#4A3B00' }]}>{SHARE_WARNING_SHORT}</Text>
              <Info title="Paylaşmadan önce" text={SHARE_WARNING} color="#6B5300" />
            </View>
            <Pressable style={styles.checkRow} onPress={() => setAgreed(!agreed)} accessibilityRole="checkbox" accessibilityState={{ checked: agreed }}>
              <Check on={agreed} />
              <Text style={[styles.h, { flex: 1 }]}>Bu uzmanı tanıyorum ve çocuğun velisiyim (yasal temsilcisiyim).</Text>
            </Pressable>
          </View>

          <Pressable style={[styles.cta, !canSend && { opacity: 0.45 }]} disabled={!canSend} onPress={() => send(child(), picked)}
            accessibilityState={{ disabled: !canSend }}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Onayla ve paylaş</Text>}
          </Pressable>
          <Pressable onPress={decline} hitSlop={8} style={{ alignSelf: 'center', paddingVertical: 6 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.danger }}>Bu davet bana ait değil</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ---------- Paylaşım başladı + çocuğun tabletini bağla (QR + yazılı kod) ---------- */

function Done({ invite, who, done, onClose, createChildCode }: {
  invite: PendingInvite; who: string; done: { childIds: string[]; newId?: string }; onClose: () => void;
  createChildCode: (id: string) => Promise<IssuedCode>;
}) {
  const { children } = useStore();
  const shared = children.filter((c) => done.childIds.includes(c.id));
  // Tablet bağlama: yeni eklenen çocuk, yoksa oyuna henüz bağlanmamış ilk paylaşılan çocuk
  const target = useMemo(() => shared.find((c) => c.id === done.newId) ?? shared.find((c) => !c.linked), [shared, done.newId]);
  const [code, setCode] = useState<IssuedCode | undefined>();
  const [busy, setBusy] = useState(false);
  const issue = async () => {
    if (!target) return;
    setBusy(true);
    try { setCode(await createChildCode(target.id)); }
    catch (e) { Alert.alert('Kod üretilemedi', (e as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Uzman daveti</Text>
        <IconButton name="close" label="Kapat" onPress={onClose} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 48 }}>
        <View style={{ alignItems: 'center', gap: 8, paddingVertical: 8 }}>
          <Ionicons name="checkmark-circle" size={48} color={colors.easy.fg} />
          <Text style={[styles.lead, { textAlign: 'center' }]}>Paylaşım başladı</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.small, { textAlign: 'center' }]}>İstediğin an Uzmanım'dan durdurabilirsin.</Text>
            <Info title="Paylaşım" text={`${who}, ${shared.map((c) => c.name).join(', ') || 'çocuğun'} için görevleri ve gözlem notlarını görebilir.${invite.hasPlan ? ' Takip planı Uzmanım bölümünde.' : ''} Paylaşımı istediğin an Aile › Hesap › Uzmanım bölümünden durdurabilirsin.`} />
          </View>
        </View>
        {target && !target.linked && (
          <Card style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.h}>{target.name} için tableti bağla</Text>
              <Info title="Tableti bağla" text={'Çocuğunun tabletinde Pofi Adası oyununu aç, "QR okut"a dokun ve kareyi göster. Bilgisayarda kodu yazması yeterli. Kod 15 dakika geçerli ve tek kullanımlık.'} />
            </View>
            {code ? (
              <CodeBox code={code} busy={busy} onRenew={issue} qr={`pofiadasi://baglan?kod=${code.code}`}
                shareText={`${target.name} için Pofi Adası giriş kodu: ${code.code} (15 dakika geçerli)`} />
            ) : (
              <Pressable style={[styles.cta, busy && { opacity: 0.6 }]} disabled={busy} onPress={issue}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Giriş kodu üret</Text>}
              </Pressable>
            )}
          </Card>
        )}
        <Pressable style={styles.ghost} onPress={onClose}>
          <Text style={{ color: colors.navy, fontWeight: '700' }}>{target && !target.linked && !code ? 'Sonra bağlarım' : 'Bitti'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Check({ on }: { on: boolean }) {
  return (
    <View style={[styles.box, on && { backgroundColor: colors.navy, borderColor: colors.navy }]}>
      {on && <Ionicons name="checkmark" size={15} color="#fff" />}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.navy },
  medal: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.today, alignItems: 'center', justifyContent: 'center' },
  lead: { fontSize: 18, fontWeight: '700', color: colors.navy, lineHeight: 25 },
  h: { fontSize: 15, fontWeight: '600', color: colors.navy },
  cap: { fontSize: 12, color: colors.muted },
  small: { fontSize: 13, color: colors.navy, lineHeight: 19 },
  section: { fontSize: 13, fontWeight: '600', color: colors.muted },
  input: { backgroundColor: '#F3F4F8', borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.navy, marginTop: 4 },
  chip: { paddingHorizontal: 14, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.navy },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: colors.faint, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  warn: { gap: 12, backgroundColor: '#FFF6DE', borderRadius: radius.md, padding: 14, borderWidth: 1, borderColor: '#F3DFA2' },
  cta: { height: 52, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  ghost: { height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
});
