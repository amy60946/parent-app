import React, { useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Alert, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { Avatar, Card, IconButton, Segmented } from '../components/ui';
import DateField from '../components/DateField';
import VerifiedBadge from '../components/VerifiedBadge';
import { CodeBox } from '../components/CodeBox';
import Info from '../components/Info';
import PhoneStep from '../components/PhoneStep';
import { ClinicianAvatar } from './CareScreen';
import { SCOPE_FULL, SHARE_WARNING, SHARE_WARNING_SHORT, TELL_CLINICIAN, historyConsent } from '../data/clinicTexts';
import { useChildConsent } from '../legal';
import { useStore, IssuedCode } from '../store';
import { useAuth } from '../lib/auth';
import { useFlag } from '../clientConfig';
import { childAvatars, defaultChildAvatar } from '../data/avatars';
import { ageBands, AgeBand } from '../data/ageBands';
import { hintOf } from '../lib/errors';
import { requestPremium } from '../lib/billing';
import { track } from '../lib/track';
import { joinNames } from '../lib/tr';
import { PendingInvite, NewChild, acceptInvite, declineInvite, openInvite, INVITE_FINAL, inviteErrorTitle } from '../lib/clinic';

// Uzman bağla (kullanıcı isteği 28 Ekim 2026, Joon "Link a therapist" örneğinden; ortak/sozlesme/akislar.md 10 adım 6–6d, 19):
// "Uzmanından kod aldın mı?" Evet → kod → aynı ekranda "Bu kimin uzmanı?" (ailedeki çocuklar + uzmanın önerdiği yeni çocuk),
// paylaşılanlar, uyarı + veli beyanı → bağlan → (bayrak açıksa) telefon numarası → "Hesaplar başarıyla bağlandı".
// Hayır → uzmanına ParentApp'i anlatan paylaşım metni. Davet bağlantısıyla gelindiyse kod hazır gelir.
// Paylaşım yalnız ebeveynin onayıyla; onay metinlerinin sürümü sunucuda kaydedilir (hukuk_notlari.md 3B, 3F).
type Stage = 'form' | 'phone' | 'done';

export default function InviteScreen({ navigation, route }: any) {
  const fromSetup = !!route.params?.fromSetup;
  const { children, refresh, createChildCode } = useStore();
  const { session } = useAuth();
  const smsOn = useFlag('parent_sms_verify');
  const [invite, setInvite] = useState<PendingInvite | undefined>(route.params?.invite);
  const [stage, setStage] = useState<Stage>('form');
  const [done, setDone] = useState<{ childIds: string[]; newId?: string } | null>(null);

  // Kod adımı (davet yoksa)
  const [has, setHas] = useState<'yes' | 'no'>('yes');
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [codeError, setCodeError] = useState<string | undefined>();

  // Kimin uzmanı: yeni çocuk (uzmanın önerdiği ya da ebeveynin yazdığı) + ailede zaten olan çocuklar
  const [newOn, setNewOn] = useState(!!invite?.childName || children.length === 0);
  const [name, setName] = useState(invite?.childName ?? '');
  const [group, setGroup] = useState<AgeBand | undefined>(invite?.childAgeGroup);
  const [more, setMore] = useState(false);
  const [birthday, setBirthday] = useState<string | undefined>();
  const [gender, setGender] = useState<'kız' | 'erkek' | undefined>();
  const [avatar, setAvatarState] = useState(defaultChildAvatar());
  const touched = useRef(false); // avatar elle seçilmediyse cinsiyet seçilince o cinsiyetin ilk Okti'si
  const setAvatar = (a: string) => { touched.current = true; setAvatarState(a); };
  const [picked, setPicked] = useState<string[]>([]);
  const [history, setHistory] = useState(false); // açık rıza önceden işaretli olamaz (ortak hukuk/README.md sorun 1)
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);

  const who = invite?.clinician || invite?.clinic || 'Uzmanın';
  const suggested = !!invite?.childName;
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const pickedNames = children.filter((c) => picked.includes(c.id)).map((c) => c.name);
  const validNew = !newOn || (name.trim().length > 0 && name.trim().length <= 40);
  const canSend = !!invite && agreed && validNew && (newOn || picked.length > 0) && !busy;
  const close = () => navigation.goBack();

  // Kod: daveti bu aileye bağla; hâlâ bekliyorsa aynı ekranda "Bu kimin uzmanı?" açılır
  const check = async (value = code) => {
    if (value.length !== 6) return setCodeError('Kod 6 karakter olmalı.');
    setChecking(true);
    setCodeError(undefined);
    try {
      const r = await openInvite(value);
      if (r.kind === 'old') return setCodeError('Bu sürüm sunucuyla eşleşmiyor. Uygulamayı güncelle.');
      if (r.kind === 'done') {
        Alert.alert('Bu daveti zaten kabul ettin', `${r.invite.clinician || r.invite.clinic} ile paylaşım Uzmanım sekmesinde.`, [{ text: 'Tamam', onPress: close }]);
        return;
      }
      track('invite.code', { suggested: !!r.invite.childName });
      setInvite(r.invite);
      setNewOn(!!r.invite.childName || children.length === 0);
      setName(r.invite.childName ?? '');
      setGroup(r.invite.childAgeGroup);
    } catch (e) {
      const hint = hintOf(e);
      setCodeError(hint === 'accepted' ? `${inviteErrorTitle(hint)}.` : (e as Error).message);
    } finally {
      setChecking(false);
    }
  };

  const child = (allowDuplicate = false): NewChild | null => (newOn ? {
    name: name.trim(), age_group: group, birthday, gender, avatar, ...(allowDuplicate ? { allow_duplicate: true } : {}),
  } : null);

  const send = async (newChild: NewChild | null, ids: string[]) => {
    if (!invite) return;
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
      setStage(smsOn && !session?.user.phone ? 'phone' : 'done');
    } catch (e) {
      const hint = hintOf(e);
      if (hint === 'premium_required') requestPremium((e as Error).message);
      else if (hint && INVITE_FINAL.includes(hint)) {
        Alert.alert(inviteErrorTitle(hint), (e as Error).message, [{ text: 'Tamam', onPress: close }]);
      } else Alert.alert('Bağlanamadı', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const decline = () => invite && Alert.alert(
    'Bu davet sana ait değil mi?',
    `Davet kapanır ve ${who} bilgilendirilir. Hiçbir bilgin paylaşılmaz.`,
    [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Daveti kapat', style: 'destructive',
        onPress: async () => {
          try { await declineInvite(invite.code); track('invite.decline'); close(); }
          catch (e) { Alert.alert('Kapatılamadı', (e as Error).message); }
        },
      },
    ],
  );

  // Kurulumdan gelindiyse: kurulum kaldığı yerden sürer (tanışma soruları davetle gelen ailede sonra; Ben'de hatırlatılır)
  const finish = () => (fromSetup && done ? navigation.navigate('Setup', { linked: true }) : close());

  if (stage === 'phone') {
    return (
      <Screen title="Uzman bağla" onClose={() => setStage('done')}>
        <PhoneStep onDone={() => setStage('done')} />
      </Screen>
    );
  }
  if (stage === 'done' && done && invite) {
    return <Done invite={invite} who={who} done={done} fromSetup={fromSetup} onClose={finish} createChildCode={createChildCode} />;
  }

  const label = ageBands.find((b) => b.id === group)?.label;
  return (
    <Screen title="Uzman bağla" onClose={close}>
      {!invite ? (
        <View style={{ gap: 14 }}>
          <Text style={styles.lead}>Uzmanından davet kodu aldın mı?</Text>
          <Segmented<'yes' | 'no'> value={has} onChange={setHas} options={[{ id: 'yes', label: 'Evet' }, { id: 'no', label: 'Hayır' }]} />
          {has === 'yes' ? (
            <View style={{ gap: 8 }}>
              <Text style={styles.label}>Uzman kodu</Text>
              <View style={[styles.codeWrap, !!codeError && { borderColor: colors.danger }]}>
                <Ionicons name="keypad-outline" size={18} color={colors.muted} />
                <TextInput value={code} autoFocus autoCapitalize="characters" autoCorrect={false} placeholder="KOD" placeholderTextColor={colors.faint}
                  onChangeText={(v) => {
                    const c = v.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
                    setCode(c);
                    setCodeError(undefined);
                    if (c.length === 6) check(c);
                  }}
                  onSubmitEditing={() => check()} style={styles.codeInput} accessibilityLabel="Uzman kodu" />
                {checking && <ActivityIndicator color={colors.navy} />}
              </View>
              {!!codeError && <Text style={{ fontSize: 13, color: colors.danger }}>{codeError}</Text>}
              <Text style={styles.cap}>Kod, uzmanının gönderdiği e-postada ya da mesajdadır. Kodu yazınca kimin davet ettiğini görürsün.</Text>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              <Card style={{ gap: 8 }}>
                <Text style={styles.h}>Sorun değil</Text>
                <Text style={styles.small}>ParentApp'i uzmanın olmadan da kullanabilirsin. Çocuğunla çalışan bir uzman varsa ClinicApp'te hesap açıp sana bir davet kodu gönderebilir.</Text>
                <Pressable onPress={() => { track('invite.tell'); Share.share({ message: TELL_CLINICIAN }).catch(() => {}); }} style={styles.share} accessibilityRole="button">
                  <Ionicons name="share-outline" size={16} color={colors.navy} />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.navy }}>Uzmanına anlat</Text>
                </Pressable>
              </Card>
              <Pressable style={styles.cta} onPress={close} accessibilityRole="button"><Text style={styles.ctaText}>Şimdilik geç</Text></Pressable>
            </View>
          )}
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <ClinicianAvatar name={who} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.h}>{who}</Text>
              {!!(invite.title || invite.clinic) && <Text style={styles.cap}>{[invite.title, invite.clinic !== who ? invite.clinic : ''].filter(Boolean).join(' · ')}</Text>}
              <Text style={styles.cap}>Kod {invite.code}</Text>
              <VerifiedBadge verifiedAs={invite.verifiedAs} />
            </View>
          </Card>

          <View style={{ gap: 8 }}>
            <Text style={styles.lead}>Bu kimin uzmanı?</Text>
            <Card style={{ paddingVertical: 4 }}>
              {children.map((c, i) => (
                <Pressable key={c.id} onPress={() => toggle(c.id)} style={[styles.pickRow, i > 0 && styles.sep]} accessibilityRole="checkbox"
                  accessibilityState={{ checked: picked.includes(c.id) }} accessibilityLabel={c.name}>
                  <Avatar id={c.avatar} size={34} />
                  <Text style={[styles.h, { flex: 1 }]}>{c.name}</Text>
                  <Check on={picked.includes(c.id)} />
                </Pressable>
              ))}
              {(children.length > 0 || suggested) && (
                <Pressable onPress={() => setNewOn(!newOn)} style={[styles.pickRow, children.length > 0 && styles.sep]} accessibilityRole="checkbox"
                  accessibilityState={{ checked: newOn }}>
                  <View style={styles.newIcon}><Ionicons name={suggested ? 'person-add-outline' : 'add'} size={18} color={colors.navy} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.h}>{suggested ? `${invite.childName} (yeni)` : 'Yeni çocuk ekle'}</Text>
                    {suggested && <Text style={styles.cap}>Uzmanının yazdığı bilgiler{label ? ` · ${label}` : ''}; kontrol edip düzeltebilirsin</Text>}
                  </View>
                  <Check on={newOn} />
                </Pressable>
              )}
              {newOn && (
                <View style={[{ gap: 12, paddingVertical: 12 }, (children.length > 0 || suggested) && styles.sep]}>
                  <View>
                    <Text style={styles.cap}>Çocuğun adı ya da takma adı</Text>
                    <TextInput value={name} onChangeText={setName} maxLength={40} placeholder="Ad" placeholderTextColor={colors.muted} style={styles.input} />
                  </View>
                  <View style={{ gap: 6 }}>
                    <Text style={styles.cap}>Yaş grubu</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {ageBands.map((b) => (
                        <Pressable key={b.id} onPress={() => setGroup(b.id)} style={[styles.chip, group === b.id && styles.chipOn]} accessibilityState={{ selected: group === b.id }}>
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
                          <Pressable key={g} onPress={() => { const v = gender === g ? undefined : g; setGender(v); if (!touched.current) setAvatarState(defaultChildAvatar(v)); }}
                            style={[styles.chip, gender === g && styles.chipOn]}>
                            <Text style={[styles.chipText, gender === g && { color: '#fff' }]}>{g === 'kız' ? 'Kız' : 'Erkek'}</Text>
                          </Pressable>
                        ))}
                      </View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ gap: 10 }}>
                        {(gender === 'erkek' ? [...childAvatars.slice(6), ...childAvatars.slice(0, 6)] : childAvatars).map((a) => (
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
          </View>

          {/* Uzman değişimi: önceki uzmanın kayıtları (adı gizlenir), açık rıza metni uzman-gecis-v1 */}
          {picked.length > 0 && (
            <Card style={{ gap: 10 }}>
              <Pressable style={styles.checkRow} onPress={() => setHistory(!history)} accessibilityRole="checkbox" accessibilityState={{ checked: history }}>
                <Check on={history} />
                <Text style={[styles.h, { flex: 1 }]}>Önceki uzmanın kayıtlarını da paylaş (adı gizlenir)</Text>
                <Info title="Önceki uzmanın kayıtları" text={`${historyConsent(joinNames(pickedNames), who)}\n\nDaha önce başka bir uzmanla paylaşmadıysan aktarılacak kayıt yoktur.`} />
              </Pressable>
            </Card>
          )}

          <View style={styles.note}>
            <Text style={[styles.cap, { flex: 1 }]}>Uzmanının seninle çalışabilmesi için seçtiğin çocukların görevleri ve davranış kayıtları paylaşılır; mesajlar ve coin paylaşılmaz.</Text>
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
            accessibilityRole="button" accessibilityState={{ disabled: !canSend }}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Uzmanla bağlan</Text>}
          </Pressable>
          <Pressable onPress={decline} hitSlop={8} style={{ alignSelf: 'center', paddingVertical: 6 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.danger }}>Bu davet bana ait değil</Text>
          </Pressable>
        </View>
      )}
    </Screen>
  );
}

function Screen({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle} accessibilityRole="header">{title}</Text>
        <IconButton name="close" label="Kapat" onPress={onClose} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ---------- Hesaplar bağlandı + çocuğun tabletini bağla (QR + yazılı kod) ---------- */

function Done({ invite, who, done, fromSetup, onClose, createChildCode }: {
  invite: PendingInvite; who: string; done: { childIds: string[]; newId?: string }; fromSetup: boolean; onClose: () => void;
  createChildCode: (id: string) => Promise<IssuedCode>;
}) {
  const { children } = useStore();
  const shared = children.filter((c) => done.childIds.includes(c.id));
  // Tablet bağlama: yeni eklenen çocuk, yoksa oyuna henüz bağlanmamış ilk paylaşılan çocuk. Kurulumda tablet sonra (cihaz kurulumu).
  const target = useMemo(() => (fromSetup ? undefined : shared.find((c) => c.id === done.newId) ?? shared.find((c) => !c.linked)), [shared, done.newId, fromSetup]);
  const [code, setCode] = useState<IssuedCode | undefined>();
  const [busy, setBusy] = useState(false);
  const { ensureChildConsent, consentUi } = useChildConsent();
  const issue = async () => {
    if (!target) return;
    if (!(await ensureChildConsent(target.name))) return; // veli onayı: kod/QR'dan önce (hukuk/50 §1.3)
    setBusy(true);
    try { setCode(await createChildCode(target.id)); }
    catch (e) { Alert.alert('Kod üretilemedi', (e as Error).message); }
    finally { setBusy(false); }
  };
  const names = joinNames(shared.map((c) => c.name)) || 'çocuğun';
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Uzman bağla</Text>
        <IconButton name="close" label="Kapat" onPress={onClose} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 48 }}>
        <View style={styles.doneCard}>
          <View style={styles.doneIcon}><Ionicons name="checkmark" size={34} color="#fff" /></View>
          <Text style={[styles.lead, { textAlign: 'center' }]} accessibilityRole="header">Hesaplar başarıyla bağlandı</Text>
          <Text style={[styles.small, { textAlign: 'center' }]}>
            {who} artık {names} için görevleri ve davranış kayıtlarını görebilir{invite.hasPlan ? '; programı Uzmanım sekmesinde' : ''}. Paylaşımı istediğin an Uzmanım sekmesinden durdurabilirsin.
          </Text>
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
        <Pressable style={fromSetup ? styles.cta : styles.ghost} onPress={onClose} accessibilityRole="button">
          <Text style={fromSetup ? styles.ctaText : { color: colors.navy, fontWeight: '700' }}>
            {fromSetup ? 'Devam' : target && !target.linked && !code ? 'Sonra bağlarım' : 'Tamam'}
          </Text>
        </Pressable>
      </ScrollView>
      {consentUi}
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
  lead: { fontSize: 18, fontWeight: '700', color: colors.navy, lineHeight: 25 },
  label: { fontSize: 13, fontWeight: '700', color: colors.navy },
  h: { fontSize: 15, fontWeight: '600', color: colors.navy },
  cap: { fontSize: 12, lineHeight: 17, color: colors.muted },
  small: { fontSize: 14, color: '#4A5165', lineHeight: 20 },
  input: { backgroundColor: '#F3F4F8', borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.navy, marginTop: 4 },
  codeWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.line, paddingHorizontal: 14, height: 54 },
  codeInput: { flex: 1, fontSize: 20, fontWeight: '800', letterSpacing: 4, color: colors.navy },
  share: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 2, paddingHorizontal: 14, height: 40, borderRadius: radius.pill, backgroundColor: colors.today },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  newIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.today, alignItems: 'center', justifyContent: 'center' },
  chip: { paddingHorizontal: 14, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.navy },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: colors.faint, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F1F3F8', borderRadius: radius.sm, padding: 12 },
  warn: { gap: 12, backgroundColor: '#FFF6DE', borderRadius: radius.md, padding: 14, borderWidth: 1, borderColor: '#F3DFA2' },
  cta: { height: 52, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  ghost: { height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  doneCard: { alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: radius.lg, padding: 24 },
  doneIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.easy.fg, alignItems: 'center', justifyContent: 'center' },
});
