import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Share, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { colors, radius } from '../theme';
import { Avatar, IconButton, Segmented, Card } from '../components/ui';
import DateField from '../components/DateField';
import Sheet from '../components/Sheet';
import ClinicShareSheet from '../components/ClinicShare';
import { messagePreview } from './ChatScreen';
import { childAvatars, parentAvatars } from '../data/avatars';
import { AgeBand, ageBands, suggestAgeBand } from '../data/ageBands';
import { useStore } from '../store';
import { useAuth } from '../lib/auth';
import { formatTR, toISO, todayISO } from '../dates';

type Tab = 'general' | 'mail' | 'account';
const soon = () => Alert.alert('Yakında', 'Bu özellik sonraki sürümde.');

export default function FamilyScreen({ onLogout }: { onLogout?: () => void }) {
  const { parent, children } = useStore();
  const [who, setWho] = useState<string>('me');
  const [tab, setTab] = useState<Tab>('general');
  const [sheet, setSheet] = useState(false);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={{ alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 4 }}>
        <Pressable onPress={soon} accessibilityLabel="Bildirimler" hitSlop={10}>
          <Ionicons name="notifications-outline" size={22} color={colors.navy} />
          <View style={styles.dot} />
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 14, gap: 16, alignItems: 'flex-start' }}>
        <Person label={parent.nickname || 'Ben'} avatar={parent.avatar} active={who === 'me'} onPress={() => setWho('me')} />
        {children.map((c) => (
          <Person key={c.id} label={c.name} avatar={c.avatar} active={who === c.id} onPress={() => setWho(c.id)} />
        ))}
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Pressable onPress={() => setSheet(true)} accessibilityLabel="Ekle" style={styles.plus}>
            <Ionicons name="add" size={26} color="#fff" />
          </Pressable>
          <Text style={{ fontSize: 11, color: 'transparent' }}>.</Text>
        </View>
      </ScrollView>

      <View style={styles.tabs}>
        {([['general', 'Genel'], ['mail', 'Posta'], ['account', 'Hesap']] as [Tab, string][]).map(([id, label]) => (
          <Pressable key={id} onPress={() => setTab(id)} style={{ alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 14, fontWeight: tab === id ? '700' : '500', color: tab === id ? colors.navy : colors.muted }}>{label}</Text>
            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: tab === id ? colors.navy : 'transparent' }} />
          </Pressable>
        ))}
      </View>

      {tab === 'general' && (who === 'me' ? <MyProfile /> : <ChildInfo id={who} />)}
      {tab === 'mail' && <Mail />}
      {tab === 'account' && <Account onLogout={onLogout} />}

      <AddSheet visible={sheet} onClose={() => setSheet(false)} />
    </SafeAreaView>
  );
}

function Person({ label, avatar, active, onPress }: { label: string; avatar: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ alignItems: 'center', gap: 4, opacity: active ? 1 : 0.55 }}>
      <Avatar id={avatar} size={52} ring={active} />
      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.navy }}>{label}</Text>
    </Pressable>
  );
}

/* ---------- Genel ---------- */

function MyProfile() {
  const { parent, updateParent } = useStore();
  return (
    <ScrollView
      contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
    >
      <Text style={styles.h}>Profilim</Text>
      <Card style={{ gap: 14 }}>
        <Text style={styles.cap}>Avatar</Text>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          {parentAvatars.map((a) => (
            <Pressable key={a.id} onPress={() => updateParent({ avatar: a.id })} style={{ alignItems: 'center', gap: 4 }}>
              <Avatar id={a.id} size={60} ring={parent.avatar === a.id} />
              <Text style={styles.cap}>{a.name}</Text>
            </Pressable>
          ))}
        </View>
        <Field label="Takma ad" value={parent.nickname} onChange={(v) => updateParent({ nickname: v })} />
        <Field label="İsim" value={parent.name} onChange={(v) => updateParent({ name: v })} />
      </Card>
    </ScrollView>
  );
}

function ChildInfo({ id }: { id: string }) {
  const { children, completions, createChildCode, setChildAgeBand, childBalance, unlinkChildDevice } = useStore();
  const [code, setCode] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [balance, setBalance] = useState<number | undefined>();
  const c = children.find((x) => x.id === id);
  React.useEffect(() => setCode(undefined), [id]);
  // Bakiye onay/harcama ile değişir: tamamlamalar değişince yeniden oku.
  React.useEffect(() => {
    let live = true;
    childBalance(id).then((b) => { if (live) setBalance(b); }).catch(() => { if (live) setBalance(undefined); });
    return () => { live = false; };
  }, [id, completions, childBalance]);
  if (!c) return null;

  const unlink = () => Alert.alert(
    'Cihaz bağlantısı kaldırılsın mı?',
    `${c.name} oyundan çıkarılır. Tekrar girmek için yeni bir giriş kodu gerekir. Oyundaki ilerlemesi silinmez.`,
    [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Kaldır', style: 'destructive',
        onPress: async () => {
          try { await unlinkChildDevice(c.id); }
          catch (e) { Alert.alert('Kaldırılamadı', (e as Error).message); }
        },
      },
    ],
  );

  const issue = async () => {
    setBusy(true);
    try { setCode((await createChildCode(c.id)).code); }
    catch (e) { Alert.alert('Kod üretilemedi', (e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar id={c.avatar} size={56} />
          <View>
            <Text style={styles.h}>{c.name}</Text>
            <Text style={styles.cap}>{c.gender === 'kız' ? 'Kız' : c.gender === 'erkek' ? 'Erkek' : ''}{c.birthday ? ` · ${formatTR(c.birthday)}` : ''}</Text>
          </View>
          <View style={{ flex: 1 }} />
          <View style={styles.coins} accessibilityLabel={`Coin bakiyesi ${balance ?? 'bilinmiyor'}`}>
            <View style={styles.coinDot} />
            <Text style={{ fontSize: 15, fontWeight: '800', color: colors.navy }}>{balance ?? '–'}</Text>
          </View>
        </View>
      </Card>
      <Card style={{ gap: 10 }}>
        <Text style={styles.h}>Oyundaki yaş grubu</Text>
        <Text style={{ fontSize: 13, color: colors.muted }}>
          Pofi Adası oyununun dili ve zorluğu buna göre ayarlanır.
        </Text>
        <Segmented<AgeBand>
          options={ageBands}
          value={c.ageBand ?? suggestAgeBand(c.birthday)}
          onChange={(b) => setChildAgeBand(c.id, b)}
        />
      </Card>
      <Card style={{ gap: 12 }}>
        <Text style={styles.h}>Giriş kodu</Text>
        <Text style={{ fontSize: 13, color: colors.muted }}>
          {c.name}, Pofi Adası oyununa bu kodla giriş yapar. Yeni kod üretince eskisi geçersiz olur.
        </Text>
        {code ? (
          <CodeBox code={code} shareText={`${c.name} için Pofi Adası giriş kodu: ${code}`} />
        ) : (
          <Pressable style={[styles.cta, busy && { opacity: 0.6 }]} disabled={busy} onPress={issue}>
            <Text style={styles.ctaText}>Giriş kodu üret</Text>
          </Pressable>
        )}
        {c.linked && (
          <Pressable onPress={unlink} style={styles.logout} accessibilityLabel="Cihaz bağlantısını kaldır">
            <Text style={{ color: colors.danger, fontWeight: '700' }}>Cihaz bağlantısını kaldır</Text>
          </Pressable>
        )}
      </Card>
    </ScrollView>
  );
}

// Kod + kopyala/paylaş simgeleri (tek kullanımlık, süreli kodlar için)
function CodeBox({ code, shareText }: { code: string; shareText: string }) {
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.codeBox}>
        <Text style={{ flex: 1, fontSize: 28, fontWeight: '800', letterSpacing: 6, color: colors.navy }}>{code}</Text>
        <IconButton name="copy-outline" label="Kopyala" style={{ backgroundColor: '#fff' }}
          onPress={async () => { await Clipboard.setStringAsync(code); Alert.alert('Kod kopyalandı'); }} />
        <IconButton name="share-outline" label="Paylaş" style={{ backgroundColor: '#fff' }}
          onPress={() => Share.share({ message: shareText })} />
      </View>
      <Text style={styles.cap}>Tek kullanımlık · 24 saat geçerli</Text>
    </View>
  );
}

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <View>
      <Text style={styles.cap}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} style={styles.input} placeholderTextColor={colors.muted} />
    </View>
  );
}

/* ---------- Posta: sohbet listesi ---------- */

const listTime = (iso: string) => {
  const d = new Date(iso);
  return toISO(d) === todayISO()
    ? d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
};

function Mail() {
  const { children, messages } = useStore();
  const navigation = useNavigation<any>();
  if (!children.length) {
    return (
      <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 40, paddingHorizontal: 32 }}>
        Mesajlaşmak için önce sağ üstteki + ile bir çocuk ekle.
      </Text>
    );
  }
  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Card style={{ padding: 0 }}>
        {children.map((c, i) => {
          const thread = messages.filter((m) => m.childId === c.id);
          const last = thread[thread.length - 1];
          return (
            <Pressable
              key={c.id}
              onPress={() => navigation.navigate('Chat', { childId: c.id })}
              style={[styles.convRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line }]}
              accessibilityLabel={`${c.name} ile sohbet`}
            >
              <Avatar id={c.avatar} size={48} />
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: colors.navy }}>{c.name}</Text>
                  {last && <Text style={styles.cap}>{listTime(last.at)}</Text>}
                </View>
                <Text numberOfLines={1} style={{ fontSize: 13, color: colors.muted }}>
                  {last ? `${last.sender === 'parent' ? 'Sen: ' : ''}${messagePreview(last)}` : 'Sohbeti başlatmak için dokun'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.faint} />
            </Pressable>
          );
        })}
      </Card>
    </ScrollView>
  );
}

/* ---------- Hesap ---------- */

type AccountRow = 'manage' | 'join' | 'clinic' | 'other';

const accountRows: { icon: keyof typeof Ionicons.glyphMap; label: string; id?: AccountRow }[] = [
  { icon: 'person-outline', label: 'Hesabı yönet', id: 'manage' },
  { icon: 'person-add-outline', label: 'Aileye katıl', id: 'join' },
  { icon: 'notifications-outline', label: 'Bildirim ayarları' },
  { icon: 'medkit-outline', label: 'Uzmanım', id: 'clinic' },
  { icon: 'create-outline', label: 'Geri bildirim gönder' },
  { icon: 'star-outline', label: 'Uygulamayı puanla' },
  { icon: 'book-outline', label: 'Ebeveyn kaynakları' },
  { icon: 'happy-outline', label: 'Ebeveyn topluluğu' },
  { icon: 'help-circle-outline', label: 'Yardım merkezi' },
];

function Account({ onLogout }: { onLogout?: () => void }) {
  const [open, setOpen] = useState<AccountRow | null>(null);
  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
      <Card style={{ padding: 0 }}>
        {accountRows.map((r, i) => (
          <Pressable key={r.label} onPress={r.id ? () => setOpen(r.id!) : soon} style={[styles.accRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line }]}>
            <Ionicons name={r.icon} size={20} color={colors.navy} />
            <Text style={{ flex: 1, fontSize: 15, color: colors.navy }}>{r.label}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.faint} />
          </Pressable>
        ))}
      </Card>
      <Text style={{ fontSize: 11, color: colors.muted, textAlign: 'center' }}>
        Gizlilik politikamızı ve kullanım koşullarımızı okuyabilirsiniz.
      </Text>
      <Pressable
        onPress={() => Alert.alert('Çıkış yapılsın mı?', '', [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Çıkış yap', style: 'destructive', onPress: onLogout }])}
        style={styles.logout}
      >
        <Text style={{ color: colors.danger, fontWeight: '700' }}>Çıkış Yap</Text>
      </Pressable>
      <ManageSheet visible={open === 'manage'} onClose={() => setOpen(null)} />
      <JoinSheet visible={open === 'join'} onClose={() => setOpen(null)} />
      <ClinicShareSheet visible={open === 'clinic'} onClose={() => setOpen(null)} />
    </ScrollView>
  );
}

/* ---------- Aileye katıl (ikinci ebeveyn) ---------- */

function JoinSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { joinFamily, isOnlyParent, children, tasks } = useStore();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const close = () => { setCode(''); onClose(); };

  const join = async () => {
    setBusy(true);
    try {
      await joinFamily(code);
      close();
      Alert.alert('Aileye katıldın');
    } catch (e) {
      Alert.alert('Katılınamadı', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (code.trim().length !== 6) return Alert.alert('Kod 6 karakter olmalı');
    let loses = false;
    try { loses = (children.length > 0 || tasks.length > 0) && (await isOnlyParent()); } catch { /* sunucu yine kontrol eder */ }
    if (!loses) return join();
    Alert.alert(
      'Mevcut aileden ayrılınsın mı?',
      'Yeni aileye katılınca şu anki ailendeki çocuklar, görevler ve mesajlar silinir.',
      [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Katıl', style: 'destructive', onPress: join }],
    );
  };

  return (
    <Sheet visible={visible} title="Aileye katıl" onClose={close}>
      <View style={{ gap: 14 }}>
        <Text style={{ fontSize: 13, color: colors.muted }}>
          Diğer ebeveynin Aile {'>'} + {'>'} Ebeveyn bölümünden ürettiği 6 haneli kodu yaz.
        </Text>
        <TextInput
          value={code}
          onChangeText={(v) => setCode(v.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6))}
          placeholder="KOD"
          placeholderTextColor={colors.faint}
          autoCapitalize="characters"
          autoCorrect={false}
          style={[styles.input, { fontSize: 24, fontWeight: '800', letterSpacing: 6, textAlign: 'center' }]}
        />
        <Pressable style={[styles.cta, busy && { opacity: 0.6 }]} disabled={busy} onPress={submit}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Katıl</Text>}
        </Pressable>
      </View>
    </Sheet>
  );
}

/* ---------- Hesabı yönet ---------- */

function ManageSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { session, signOutLocal } = useAuth();
  const { isOnlyParent, deleteAccount } = useStore();
  const [busy, setBusy] = useState(false);

  const doDelete = async () => {
    setBusy(true);
    try {
      await deleteAccount();
      onClose();
      await signOutLocal();
      Alert.alert('Hesabın silindi');
    } catch (e) {
      Alert.alert('Hesap silinemedi', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    let only = true;
    try { only = await isOnlyParent(); } catch { /* emin değilsek en kapsamlı uyarıyı göster */ }
    Alert.alert(
      'Hesap kalıcı olarak silinsin mi?',
      only
        ? 'Hesabınla birlikte ailenin tüm verisi (çocuklar, görevler, tamamlananlar, mesajlar, fotoğraf ve sesler) kalıcı olarak silinir. Bu işlem geri alınamaz.'
        : 'Hesabın ve profilin kalıcı olarak silinir. Aile verisi diğer ebeveynde kalmaya devam eder. Bu işlem geri alınamaz.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Hesabı sil', style: 'destructive', onPress: doDelete },
      ],
    );
  };

  return (
    <Sheet visible={visible} title="Hesabı yönet" onClose={onClose}>
      <View style={{ gap: 14 }}>
        <View>
          <Text style={styles.cap}>E-posta</Text>
          <Text style={{ fontSize: 15, color: colors.navy, marginTop: 4 }}>{session?.user.email}</Text>
        </View>
        <Pressable onPress={confirm} disabled={busy} style={[styles.logout, busy && { opacity: 0.6 }]} accessibilityLabel="Hesabı sil">
          {busy ? <ActivityIndicator color={colors.danger} /> : <Text style={{ color: colors.danger, fontWeight: '700' }}>Hesabı sil</Text>}
        </Pressable>
        <Text style={{ fontSize: 11, color: colors.muted, textAlign: 'center' }}>
          Hesabı silmek tüm kişisel verini kalıcı olarak kaldırır.
        </Text>
      </View>
    </Sheet>
  );
}

/* ---------- Ekle (alttan açılan tek sayfa) ---------- */

function AddSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { addChild, createInviteCode } = useStore();
  const [kind, setKind] = useState<'child' | 'parent'>('child');
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'kız' | 'erkek'>('kız');
  const [birthday, setBirthday] = useState<string | undefined>();
  const [band, setBand] = useState<AgeBand>('A');
  const [avatar, setAvatar] = useState(childAvatars[1].id);
  const [code, setCode] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const close = () => { setName(''); setBirthday(undefined); setBand('A'); setCode(undefined); setKind('child'); onClose(); };

  const save = () => {
    if (!name.trim()) return Alert.alert('İsim gerekli');
    addChild({ name: name.trim(), avatar, gender, birthday, ageBand: band });
    close();
  };

  return (
    <Sheet
      visible={visible}
      title="Ekle"
      onClose={close}
      header={
        <Segmented
          options={[{ id: 'child', label: 'Çocuk' }, { id: 'parent', label: 'Ebeveyn' }]}
          value={kind}
          onChange={(k) => { setKind(k); setCode(undefined); }}
        />
      }
    >
      {kind === 'child' ? (
        <>
          <Text style={styles.cap}>Avatar</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {childAvatars.map((a) => (
              <Pressable key={a.id} onPress={() => setAvatar(a.id)} accessibilityLabel={a.name}>
                <Avatar id={a.id} size={48} ring={avatar === a.id} />
              </Pressable>
            ))}
          </View>
          <Field label="İsim" value={name} onChange={setName} placeholder="Çocuğunun adı" />
          <View>
            <Text style={[styles.cap, { marginBottom: 6 }]}>Cinsiyet</Text>
            <Segmented options={[{ id: 'kız', label: 'Kız' }, { id: 'erkek', label: 'Erkek' }]} value={gender} onChange={setGender} />
          </View>
          <View>
            <Text style={[styles.cap, { marginBottom: 6 }]}>Doğum günü (isteğe bağlı)</Text>
            <DateField
              mode="date"
              value={birthday}
              onChange={(d) => { setBirthday(d); if (d) setBand(suggestAgeBand(d)); }}
              placeholder="Tarih seç"
              clearable
              maximumDate={new Date()}
            />
          </View>
          <View>
            <Text style={[styles.cap, { marginBottom: 6 }]}>Oyundaki yaş grubu</Text>
            <Segmented<AgeBand> options={ageBands} value={band} onChange={setBand} />
          </View>
          <Pressable style={styles.cta} onPress={save}><Text style={styles.ctaText}>Çocuğu ekle</Text></Pressable>
        </>
      ) : (
        <>
          <Text style={{ fontSize: 13, color: colors.muted }}>
            Her yeni ebeveyn için size özel bir kod üretilir. Diğer ebeveyn bu kodla aileye katılır.
          </Text>
          {code ? (
            <CodeBox code={code} shareText={`ParentApp'e katılmak için davet kodun: ${code}\nUygulamada Aile > Hesap > Aileye katıl bölümüne yaz.`} />
          ) : (
            <Pressable
              style={[styles.cta, busy && { opacity: 0.6 }]}
              disabled={busy}
              onPress={async () => {
                setBusy(true);
                try { setCode(await createInviteCode()); }
                catch (e) { Alert.alert('Kod üretilemedi', (e as Error).message); }
                finally { setBusy(false); }
              }}
            >
              <Text style={styles.ctaText}>Davet kodu üret</Text>
            </Pressable>
          )}
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  dot: { position: 'absolute', right: 1, top: 0, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold },
  plus: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', justifyContent: 'center', gap: 36, paddingVertical: 4 },
  h: { fontSize: 16, fontWeight: '700', color: colors.navy },
  cap: { fontSize: 12, color: colors.muted },
  input: { backgroundColor: '#F3F4F8', borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.navy, marginTop: 4 },
  convRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  accRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 16 },
  logout: { height: 50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  cta: { height: 52, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  coins: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF6DE', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  coinDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.gold },
  codeBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F3F4F8', borderRadius: radius.md, padding: 14 },
});
