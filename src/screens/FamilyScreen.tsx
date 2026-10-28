import React, { useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import NotificationBell from '../components/NotificationBell';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { uploadChildPhoto } from '../lib/avatarPhoto';
import ChildAvatarPicker, { LocalPhoto } from '../components/ChildAvatarPicker';
import { colors, radius } from '../theme';
import { Avatar, Segmented, Card } from '../components/ui';
import DateField from '../components/DateField';
import Sheet from '../components/Sheet';
import { CodeBox } from '../components/CodeBox';
import Onboarding from '../components/Onboarding';
import Info, { InfoTitle } from '../components/Info';
import CodeEntry, { CodeResult } from '../components/CodeEntry';
import { messagePreview } from './ChatScreen';
import { defaultChildAvatar, parentAvatarId } from '../data/avatars';
import ParentAvatarPicker from '../components/ParentAvatarPicker';
import { AgeBand, ageBands, ageBandLabel, suggestAgeBand } from '../data/ageBands';
import { useStore } from '../store';
import { useAuth } from '../lib/auth';
import { formatTR, toISO, todayISO } from '../dates';
import { useBilling } from '../billing';
import { IssuedCode } from '../store';
import { PendingInvite, pendingInvites } from '../lib/clinic';
import { guestRedeemedText } from '../lib/guestPass';
import { useParentTasks } from '../parentTasks';
import { useChildConsent } from '../legal';
import { balances } from '../lib/rewards';
import { startOfWeek } from '../dates';
import { afterModal } from '../lib/modal';

type Tab = 'general' | 'mail' | 'account';
const soon = () => Alert.alert('Yakında', 'Bu özellik sonraki sürümde.');

export default function FamilyScreen({ onLogout }: { onLogout?: () => void }) {
  const { parent, children, messages } = useStore();
  const unread = messages.filter((m) => m.sender === 'child' && !m.readAt).length;
  const [who, setWho] = useState<string>('me');
  const [tab, setTab] = useState<Tab>('general');
  const [sheet, setSheet] = useState(false);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={{ alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 4 }}>
        <NotificationBell />
      </View>

      {/* Avatar satırı ve sekmeler ezilmez (flexShrink 0): Hesap'taki uzun liste iOS'ta satırı küçültüp üstüne çıkıyordu (geri bildirim 28 Ekim) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 14, gap: 16, alignItems: 'flex-start' }}>
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
        {([['general', 'Genel'], ['mail', 'Mesajlar'], ['account', 'Hesap']] as [Tab, string][]).map(([id, label]) => (
          <Pressable key={id} onPress={() => setTab(id)} style={{ alignItems: 'center', gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={{ fontSize: 14, fontWeight: tab === id ? '700' : '500', color: tab === id ? colors.navy : colors.muted }}>{label}</Text>
              {id === 'mail' && unread > 0 && <View style={styles.count}><Text style={styles.countText}>{unread}</Text></View>}
            </View>
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
  // Profil önce görünür; değiştirmek için sağ üstteki kalem (kullanıcı geri bildirimi 27 Ekim 2026)
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState({ avatar: parent.avatar, nickname: parent.nickname, name: parent.name });
  const startEdit = () => { setDraft({ avatar: parentAvatarId(parent.avatar), nickname: parent.nickname, name: parent.name }); setEdit(true); };
  const save = () => {
    updateParent({ avatar: draft.avatar, nickname: draft.nickname.trim(), name: draft.name.trim() });
    setEdit(false);
  };
  const pt = useParentTasks();
  const navigation = useNavigation<any>();
  const week = toISO(startOfWeek(new Date()));
  const mine = pt.ledger.filter((r) => r.userId === pt.me && r.createdAt.slice(0, 10) >= week);
  const earned = mine.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0);
  const spent = -mine.filter((r) => r.amount < 0).reduce((s, r) => s + r.amount, 0);
  return (
    <ScrollView
      contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
    >
      <Text style={styles.h}>Profilim</Text>
      {edit ? (
        <Card style={{ gap: 14 }}>
          <Text style={styles.cap}>Oyundaki yüzün: Okti</Text>
          <ParentAvatarPicker value={draft.avatar} onChange={(a) => setDraft((d) => ({ ...d, avatar: a }))} size={60} />
          <Field label="Takma ad" value={draft.nickname} onChange={(v) => setDraft((d) => ({ ...d, nickname: v }))} placeholder="Çocuğunun sana seslendiği ad" />
          <Field label="İsim" value={draft.name} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} />
          <EditButtons onCancel={() => setEdit(false)} onSave={save} />
        </Card>
      ) : (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Avatar id={parent.avatar} size={64} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.h}>{parent.nickname || parent.name || 'Ben'}</Text>
            {!!parent.nickname && !!parent.name && <Text style={styles.cap}>{parent.name}</Text>}
          </View>
          <EditPencil label="Profili düzenle" onPress={startEdit} />
        </Card>
      )}
      {pt.ready && pt.me && (
        // Ebeveynin Güneş Taşı (akislar.md 18): kendine atanan görevlerden; hediye dükkânında harcanır
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}><InfoTitle title="Güneş Taşım" style={styles.h} info={'Sana atanan görevlerde "Yaptım" dedikçe taş kazanırsın (Kolay 1, Orta 2, Zor 3). Taşlarla Hediye dükkânından çocuğuna oyunda hediye gönderirsin.'} /></View>
            <Pressable onPress={() => navigation.navigate('Stones')} hitSlop={8}><Text style={styles.link}>Geçmiş ›</Text></Pressable>
          </View>
          <Card style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.stoneDot} />
              <Text style={{ fontSize: 24, fontWeight: '800', color: colors.navy }}>{pt.balance(pt.me)}</Text>
              <Text style={[styles.cap, { flex: 1 }]}>kullanılabilir</Text>
              <Pressable onPress={() => navigation.navigate('GiftShop')} style={styles.shopBtn} accessibilityRole="button">
                <Ionicons name="gift-outline" size={16} color={colors.navy} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.navy }}>Hediye dükkânı</Text>
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={[styles.miniBox, { backgroundColor: colors.easy.bg }]}><Text style={[styles.mini, { color: colors.easy.fg }]}>+{earned}</Text><Text style={styles.cap}>Bu hafta kazanılan</Text></View>
              <View style={[styles.miniBox, { backgroundColor: colors.hard.bg }]}><Text style={[styles.mini, { color: colors.hard.fg }]}>{spent ? `−${spent}` : '0'}</Text><Text style={styles.cap}>Bu hafta hediye</Text></View>
            </View>
          </Card>
        </>
      )}
    </ScrollView>
  );
}

function ChildInfo({ id }: { id: string }) {
  const { children, completions, createChildCode, setChildAgeBand, childBalance, unlinkChildDevice, renameChild, setChildAvatar, familyId } = useStore();
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState<{ name: string; avatar: string; photo: LocalPhoto | null }>({ name: '', avatar: '', photo: null });
  const [saving, setSaving] = useState(false);
  const { ensureChildConsent, consentUi } = useChildConsent();
  const navigation = useNavigation<any>();
  const [code, setCode] = useState<IssuedCode | undefined>();
  const [busy, setBusy] = useState(false);
  const [balance, setBalance] = useState<number | undefined>();
  const [stones, setStones] = useState<number | undefined>();
  const c = children.find((x) => x.id === id);
  React.useEffect(() => { setCode(undefined); setEdit(false); }, [id]);
  // Bakiye onay/harcama ile değişir: tamamlamalar değişince yeniden oku.
  React.useEffect(() => {
    let live = true;
    childBalance(id).then((b) => { if (live) setBalance(b); }).catch(() => { if (live) setBalance(undefined); });
    balances([id]).then((b) => { if (live) setStones(b[id]); }).catch(() => { if (live) setStones(undefined); });
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

  const startEdit = () => { setDraft({ name: c.name, avatar: c.avatar, photo: null }); setEdit(true); };
  const saveEdit = async () => {
    const nm = draft.name.trim();
    if (!nm) return;
    let av = draft.avatar;
    if (draft.photo && familyId) {
      setSaving(true);
      try { av = await uploadChildPhoto(familyId, draft.photo.uri, draft.photo.mime); }
      catch (e) { setSaving(false); return Alert.alert('Fotoğraf yüklenemedi', (e as Error).message); }
      setSaving(false);
    }
    if (nm !== c.name) renameChild(c.id, nm);
    if (av !== c.avatar) setChildAvatar(c.id, av);
    setEdit(false);
  };

  const issue = async () => {
    if (!(await ensureChildConsent(c.name))) return; // veli onayı: kod/QR'dan önce (hukuk/50 §1.3)
    setBusy(true);
    try { setCode(await createChildCode(c.id)); }
    catch (e) { Alert.alert('Kod üretilemedi', (e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
      <Card style={{ gap: 12 }}>
        {edit ? (
          <View style={{ gap: 14 }}>
            <Text style={styles.cap}>Avatar: fotoğraflarından seç ya da bir simge</Text>
            <ChildAvatarPicker avatar={draft.avatar} photo={draft.photo} gender={c.gender}
              onAvatar={(a) => setDraft((d) => ({ ...d, avatar: a }))} onPhoto={(p) => setDraft((d) => ({ ...d, photo: p }))} />
            <Field label="İsim" value={draft.name} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} />
            <EditButtons onCancel={() => setEdit(false)} onSave={saveEdit} busy={saving} disabled={!draft.name.trim()} />
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Pressable onPress={startEdit} accessibilityRole="button" accessibilityLabel={`${c.name} avatarını değiştir`}>
              <Avatar id={c.avatar} size={56} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.h}>{c.name}</Text>
              <Text style={styles.cap}>{c.gender === 'kız' ? 'Kız' : c.gender === 'erkek' ? 'Erkek' : ''}{c.birthday ? ` · ${formatTR(c.birthday)}` : ''}</Text>
            </View>
            <View style={styles.coins} accessibilityLabel={`Coin bakiyesi ${balance ?? 'bilinmiyor'}`}>
              <View style={styles.coinDot} />
              <Text style={{ fontSize: 15, fontWeight: '800', color: colors.navy }}>{balance ?? '–'}</Text>
            </View>
            <EditPencil label={`${c.name} profilini düzenle`} onPress={startEdit} />
          </View>
        )}
      </Card>
      {/* Çocuğun Güneş Taşı hesabı (kullanıcı isteği 27 Ekim 2026): kazanılan, ödül ve düşülen taşlar */}
      <Pressable onPress={() => navigation.navigate('Stones', { childId: c.id })} style={styles.abcRow} accessibilityRole="button"
        accessibilityLabel={`${c.name} Güneş Taşı hesabı`}>
        <View style={styles.stoneDot} />
        <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: colors.navy }}>Güneş Taşı · {stones ?? '–'}</Text>
        <Text style={{ fontSize: 13, color: colors.muted }}>Hesap ›</Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate('Abc', { new: true, childId: c.id })} style={styles.abcRow}
        accessibilityLabel={`${c.name} için davranış kaydı ekle`}>
        <Ionicons name="pulse-outline" size={20} color={colors.navy} />
        <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: colors.navy }}>Davranış kaydı ekle</Text>
        <Pressable onPress={() => navigation.navigate('Abc', { childId: c.id })} hitSlop={8}>
          <Text style={{ fontSize: 13, color: colors.muted }}>Geçmiş ›</Text>
        </Pressable>
      </Pressable>
      <Card style={{ gap: 10 }}>
        <InfoTitle title="Oyundaki yaş grubu" style={styles.h} info="Pofi Adası oyununun dili ve zorluğu buna göre ayarlanır. Otomatik seçilirse doğum gününden hesaplanır ve çocuk büyüdükçe kendiliğinden değişir." />
        <AgeBandPicker value={c.ageBand} birthday={c.birthday} onChange={(b) => setChildAgeBand(c.id, b)} />
      </Card>
      <Card style={{ gap: 12 }}>
        <InfoTitle title="Giriş kodu" style={styles.h} info={`${c.name}, Pofi Adası oyununa bu kodla ya da QR ile giriş yapar. Tabletteki oyunda "QR okut"a dokunması yeterli; bilgisayarda kodu yazar. Kod 15 dakika geçerlidir; yeni kod üretince eskisi geçersiz olur.`} />
        {code ? (
          <CodeBox code={code} busy={busy} onRenew={issue} qr={`pofiadasi://baglan?kod=${code.code}`}
            shareText={`${c.name} için Pofi Adası giriş kodu: ${code.code} (15 dakika geçerli)`} />
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
      {consentUi}
    </ScrollView>
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

// Kartın sağ üstündeki kalem ve düzenleme altındaki Vazgeç / Kaydet
function EditPencil({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.pencil} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name="pencil" size={16} color={colors.navy} />
    </Pressable>
  );
}

function EditButtons({ onCancel, onSave, busy, disabled }: { onCancel: () => void; onSave: () => void; busy?: boolean; disabled?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Pressable onPress={onCancel} style={[styles.editBtn, { backgroundColor: '#F1F2F6' }]} accessibilityRole="button">
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.navy }}>Vazgeç</Text>
      </Pressable>
      <Pressable onPress={onSave} disabled={busy || disabled} style={[styles.editBtn, { backgroundColor: colors.navy }, (busy || disabled) && { opacity: 0.45 }]} accessibilityRole="button">
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Kaydet</Text>}
      </Pressable>
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
          const n = thread.filter((m) => m.sender === 'child' && !m.readAt).length;
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
                <Text numberOfLines={1} style={{ fontSize: 13, color: n ? colors.navy : colors.muted, fontWeight: n ? '600' : '400' }}>
                  {last ? `${last.sender === 'parent' ? 'Sen: ' : ''}${messagePreview(last)}` : 'Sohbeti başlatmak için dokun'}
                </Text>
              </View>
              {n > 0 && <View style={styles.count}><Text style={styles.countText}>{n}</Text></View>}
              <Ionicons name="chevron-forward" size={16} color={colors.faint} />
            </Pressable>
          );
        })}
      </Card>
    </ScrollView>
  );
}

/* ---------- Hesap ---------- */

type AccountRow = 'manage' | 'join' | 'clinic' | 'notifications' | 'membership' | 'guide' | 'legal' | 'kvkk' | 'other';

const accountRows: { icon: keyof typeof Ionicons.glyphMap; label: string; id?: AccountRow }[] = [
  { icon: 'sunny-outline', label: 'Üyelik', id: 'membership' },
  { icon: 'person-outline', label: 'Hesabı yönet', id: 'manage' },
  { icon: 'keypad-outline', label: 'Kod gir', id: 'join' },
  { icon: 'notifications-outline', label: 'Bildirimler', id: 'notifications' },
  { icon: 'medkit-outline', label: 'Uzmanım', id: 'clinic' },
  { icon: 'compass-outline', label: 'Nasıl kullanılır?', id: 'guide' },
  { icon: 'document-text-outline', label: 'Yasal metinler', id: 'legal' },
  { icon: 'shield-outline', label: 'KVKK başvurusu', id: 'kvkk' },
  { icon: 'create-outline', label: 'Geri bildirim gönder' },
  { icon: 'star-outline', label: 'Uygulamayı puanla' },
  { icon: 'book-outline', label: 'Ebeveyn kaynakları' },
  { icon: 'happy-outline', label: 'Ebeveyn topluluğu' },
  { icon: 'help-circle-outline', label: 'Yardım merkezi' },
];

function Account({ onLogout }: { onLogout?: () => void }) {
  const [open, setOpen] = useState<AccountRow | null>(null);
  const navigation = useNavigation<any>();
  const { access } = useBilling();
  const pick = (id: AccountRow) => (id === 'notifications' ? navigation.navigate('Notifications')
    : id === 'membership' ? navigation.navigate('Paywall')
    : id === 'clinic' ? navigation.navigate('Uzmanım')
    : id === 'legal' ? navigation.navigate('LegalDocs')
    : id === 'kvkk' ? navigation.navigate('Kvkk') : setOpen(id));
  const memberText = !access ? '' : access.state === 'premium' ? (access.plan === 'yearly' ? 'Yıllık' : 'Aylık')
    : access.state === 'clinic' ? 'Klinik' : access.state === 'trial' ? `Deneme · ${access.daysLeft ?? 0} gün`
    : access.state === 'expired' ? 'Ücretsiz' : '';
  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
      <Card style={{ padding: 0 }}>
        {accountRows.map((r, i) => (
          <Pressable key={r.label} onPress={r.id ? () => pick(r.id!) : soon} style={[styles.accRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line }]}>
            <Ionicons name={r.icon} size={20} color={colors.navy} />
            <Text style={{ flex: 1, fontSize: 15, color: colors.navy }}>{r.label}</Text>
            {r.id === 'membership' && !!memberText && <Text style={{ fontSize: 13, color: colors.muted }}>{memberText}</Text>}
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
      <CodeSheet visible={open === 'join'} onClose={() => setOpen(null)} />
      <Onboarding visible={open === 'guide'} onClose={() => setOpen(null)} />
    </ScrollView>
  );
}

/* ---------- Kod gir (uzman kodu ya da eşin aile kodu; tür kendiliğinden anlaşılır) ---------- */

function CodeSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const navigation = useNavigation<any>();
  const done = (r: CodeResult) => {
    onClose();
    if (r.kind === 'invite') afterModal(() => navigation.navigate('Invite', { invite: r.invite }));
    else if (r.kind === 'family') Alert.alert('Aileye katıldın', 'Ailenin çocuklarını, görevlerini ve bildirimlerini artık görüyorsun.');
    else if (r.kind === 'guest') Alert.alert('Hediye kartı kullanıldı', guestRedeemedText(r.trialEndsAt));
    else Alert.alert('Bu daveti zaten kabul ettin', `${r.invite.clinician || r.invite.clinic} ile paylaşım Uzmanım sekmesinde.`);
  };
  return (
    <Sheet visible={visible} title="Kod gir" onClose={onClose}>
      <View style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ flex: 1, fontSize: 13, color: colors.muted }}>Uzmanından ya da eşinden aldığın kod, hediye kartı</Text>
          <Info title="Hangi kod?" text={'Uygulama kodun kimden geldiğini kendisi anlar.\n\n• Uzman kodu (6 karakter): uzmanın davet ekranı açılır; onaylarsan çocuğunun görevleri onunla paylaşılır.\n• Eşinin kodu (6 karakter): aynı aileye katılırsın. Eşin kodu Aile › + › Ebeveyn bölümünden üretir; kod 15 dakika geçerlidir.\n• Hediye kartı (8 karakter): başka bir ailenin hediye ettiği 30 günlük tam erişim. ParentApp\'e yeni başlayan ailelerde (ilk 7 gün) geçerlidir.'} />
        </View>
        <CodeEntry onResult={done} />
      </View>
    </Sheet>
  );
}

/* ---------- Hesabı yönet ---------- */

function ManageSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { session } = useAuth();
  const navigation = useNavigation<any>();
  // Silme ayrı ekranda (hukuk/50 §5.1: abonelik uyarısı, aile durumuna göre metin, "SİL" yazarak onay)
  const toDelete = () => { onClose(); afterModal(() => navigation.navigate('DeleteAccount')); };
  return (
    <Sheet visible={visible} title="Hesabı yönet" onClose={onClose}>
      <View style={{ gap: 14 }}>
        <View>
          <Text style={styles.cap}>E-posta</Text>
          <Text style={{ fontSize: 15, color: colors.navy, marginTop: 4 }}>{session?.user.email}</Text>
        </View>
        <Pressable onPress={toDelete} style={styles.logout} accessibilityLabel="Hesabımı sil">
          <Text style={{ color: colors.danger, fontWeight: '700' }}>Hesabımı sil</Text>
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
  const { addChild, createInviteCode, familyId, children } = useStore();
  const { allow } = useBilling();
  const navigation = useNavigation<any>();
  const [photo, setPhoto] = useState<LocalPhoto | null>(null);
  const [kind, setKind] = useState<'child' | 'parent'>('child');
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'kız' | 'erkek'>('kız');
  const [birthday, setBirthday] = useState<string | undefined>();
  const [band, setBand] = useState<AgeBand | null>(null); // null: otomatik
  const [avatar, setAvatarState] = useState(defaultChildAvatar('kız'));
  const touched = useRef(false); // avatar elle seçilmediyse cinsiyet değişince o cinsiyetin ilk Okti'si gelir
  const setAvatar = (a: string) => { touched.current = true; setAvatarState(a); };
  const [code, setCode] = useState<IssuedCode | undefined>();
  const [busy, setBusy] = useState(false);
  const invite = async () => {
    setBusy(true);
    try { setCode(await createInviteCode()); }
    catch (e) { Alert.alert('Kod üretilemedi', (e as Error).message); }
    finally { setBusy(false); }
  };

  const close = () => { setName(''); setBirthday(undefined); setBand('A'); setCode(undefined); setKind('child'); setPhoto(null);
    setGender('kız'); setAvatarState(defaultChildAvatar('kız')); touched.current = false; onClose(); };

  // Aynı ad uyarısı (akislar.md 10 adım 6c): uzmanın bekleyen davetinde ya da ailede bu adda çocuk varsa önce sor
  const save = async () => {
    const nm = name.trim();
    if (!nm) return Alert.alert('İsim gerekli');
    const same = (x?: string) => !!x && x.trim().toLocaleLowerCase('tr') === nm.toLocaleLowerCase('tr');
    const inv = (await pendingInvites().catch(() => [] as PendingInvite[])).find((i) => same(i.childName));
    if (inv) {
      return Alert.alert(`Uzmanının davetinde ${inv.childName} zaten var`,
        `${inv.clinician || inv.clinic} ${inv.childName} için davet gönderdi. Bilgileri davette kontrol edip tek adımda ekleyebilirsin.`, [
          { text: 'Vazgeç', style: 'cancel' },
          { text: 'Yine de ekle', onPress: () => { doSave(); } },
          { text: 'Davete git', onPress: () => { close(); afterModal(() => navigation.navigate('Invite', { invite: inv })); } },
        ]);
    }
    const dup = children.find((c) => same(c.name));
    if (dup) {
      return Alert.alert(`Kayıtlarında ${dup.name} adında bir çocuk var`, 'Aynı çocuğu iki kez eklemek istemiyorsan vazgeç.', [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Yine de ekle', onPress: () => { doSave(); } },
      ]);
    }
    doSave();
  };

  const doSave = async () => {
    if (!allow('child')) return close();
    let av = avatar;
    if (photo && familyId) {
      setBusy(true);
      try { av = await uploadChildPhoto(familyId, photo.uri, photo.mime); }
      catch (e) { setBusy(false); return Alert.alert('Fotoğraf yüklenemedi', (e as Error).message); }
      setBusy(false);
    }
    addChild({ name: name.trim(), avatar: av, gender, birthday, ageBand: band ?? undefined });
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
          <ChildAvatarPicker avatar={avatar} photo={photo} onAvatar={setAvatar} onPhoto={setPhoto} gender={gender} />
          <Field label="İsim" value={name} onChange={setName} placeholder="Çocuğunun adı" />
          <View>
            <Text style={[styles.cap, { marginBottom: 6 }]}>Cinsiyet</Text>
            <Segmented options={[{ id: 'kız', label: 'Kız' }, { id: 'erkek', label: 'Erkek' }]} value={gender}
              onChange={(g) => { setGender(g); if (!touched.current && !photo) setAvatarState(defaultChildAvatar(g)); }} />
          </View>
          <View>
            <Text style={[styles.cap, { marginBottom: 6 }]}>Doğum günü (isteğe bağlı)</Text>
            <DateField
              mode="date"
              value={birthday}
              onChange={setBirthday}
              placeholder="Tarih seç"
              clearable
              maximumDate={new Date()}
            />
          </View>
          <View>
            <Text style={[styles.cap, { marginBottom: 6 }]}>Oyundaki yaş grubu</Text>
            <AgeBandPicker value={band ?? undefined} birthday={birthday} onChange={setBand} />
          </View>
          <Pressable style={[styles.cta, busy && { opacity: 0.6 }]} disabled={busy} onPress={save}><Text style={styles.ctaText}>Çocuğu ekle</Text></Pressable>
          {/* veli beyanı (hukuk/50 §1.4) */}
          <Text style={{ fontSize: 11, lineHeight: 16, color: colors.muted, textAlign: 'center' }}>Çocuğu ekleyerek velisi ya da yasal temsilcisi olduğunu beyan edersin. Doğum günü ve cinsiyet isteğe bağlıdır.</Text>
        </>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ flex: 1, fontSize: 13, color: colors.muted }}>Diğer ebeveyn bu kodla aileye katılır.</Text>
            <Info title="Ebeveyn daveti" text="Her yeni ebeveyn için ayrı bir kod üretilir. Diğer ebeveyn kodu kayıttan sonra açılan “Kodun var mı?” ekranına ya da Aile › Hesap › Kod gir bölümüne yazar. Kod 15 dakika geçerlidir." />
          </View>
          {code ? (
            <CodeBox code={code} busy={busy} onRenew={invite} shareText={`ParentApp'e katılmak için davet kodun: ${code.code}\nKayıttan sonra açılan "Kodun var mı?" ekranına ya da Aile > Hesap > Kod gir bölümüne yaz. Kod 15 dakika geçerli.`} />
          ) : (
            <Pressable
              style={[styles.cta, busy && { opacity: 0.6 }]}
              disabled={busy}
              onPress={invite}
            >
              <Text style={styles.ctaText}>Davet kodu üret</Text>
            </Pressable>
          )}
        </>
      )}
    </Sheet>
  );
}

// Oyun yaş grubu: "Otomatik" (doğum gününden, çocuk büyüdükçe değişir) ya da bilerek seçilen grup
function AgeBandPicker({ value, birthday, onChange }: { value?: AgeBand; birthday?: string; onChange: (b: AgeBand | null) => void }) {
  const auto = suggestAgeBand(birthday);
  const chip = (on: boolean, label: string, onPress: () => void) => (
    <Pressable key={label} onPress={onPress} accessibilityState={{ selected: on }}
      style={{ height: 38, paddingHorizontal: 14, borderRadius: 19, justifyContent: 'center', borderWidth: 1,
        borderColor: on ? colors.navy : colors.line, backgroundColor: on ? colors.navy : '#fff' }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: on ? '#fff' : colors.navy }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {chip(!value, `Otomatik · ${ageBandLabel(auto)}`, () => onChange(null))}
        {ageBands.map((b) => chip(value === b.id, b.label, () => onChange(b.id)))}
      </View>
      <Text style={{ fontSize: 12, color: colors.muted }}>
        {!value ? (birthday ? 'Doğum gününden; çocuk büyüdükçe kendiliğinden değişir.' : 'Doğum günü girilmediği için 6–8 sayılır.') : 'Elle seçildi; doğum günü değişse de bu grup kalır.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pencil: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F1F2F6', alignItems: 'center', justifyContent: 'center' },
  editBtn: { flex: 1, height: 46, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  link: { fontSize: 13, fontWeight: '600', color: colors.navy },
  stoneDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.gold, borderWidth: 3, borderColor: '#F6D77A' },
  shopBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 36, borderRadius: radius.pill, backgroundColor: '#FFF6DF' },
  miniBox: { flex: 1, borderRadius: radius.sm, padding: 10, gap: 2 },
  mini: { fontSize: 17, fontWeight: '800' },
  abcRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.md, backgroundColor: '#fff' },
  safe: { flex: 1, backgroundColor: colors.bg },
  dot: { position: 'absolute', right: 1, top: 0, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold },
  plus: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', justifyContent: 'center', gap: 36, paddingVertical: 4, flexShrink: 0 },
  h: { fontSize: 16, fontWeight: '700', color: colors.navy },
  cap: { fontSize: 12, color: colors.muted },
  input: { letterSpacing: 0, backgroundColor: '#F3F4F8', borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.navy, marginTop: 4 },
  convRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  accRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 16 },
  logout: { height: 50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  cta: { height: 52, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  coins: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF6DE', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  coinDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.gold },
  count: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  countText: { fontSize: 11, fontWeight: '800', color: colors.navy },
});
