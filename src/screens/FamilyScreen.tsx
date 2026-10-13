import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, Modal, Share, Alert, StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  useAudioRecorder, useAudioRecorderState, useAudioPlayer, useAudioPlayerStatus, RecordingPresets,
  requestRecordingPermissionsAsync, setAudioModeAsync,
} from 'expo-audio';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { colors, radius } from '../theme';
import { Avatar, IconButton, Segmented, Card } from '../components/ui';
import DateField from '../components/DateField';
import { childAvatars, parentAvatars } from '../data/avatars';
import { useStore, Message } from '../store';
import { useAuth } from '../lib/auth';
import { formatTR } from '../dates';

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
    <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
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
  const { children, createChildCode } = useStore();
  const [code, setCode] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const c = children.find((x) => x.id === id);
  React.useEffect(() => setCode(undefined), [id]);
  if (!c) return null;

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
        </View>
      </Card>
      <Card style={{ gap: 12 }}>
        <Text style={styles.h}>Giriş kodu</Text>
        <Text style={{ fontSize: 13, color: colors.muted }}>
          {c.name}, Fidan oyununa bu kodla giriş yapar. Yeni kod üretince eskisi geçersiz olur.
        </Text>
        {code ? (
          <CodeBox code={code} shareText={`${c.name} için Fidan giriş kodu: ${code}`} />
        ) : (
          <Pressable style={[styles.cta, busy && { opacity: 0.6 }]} disabled={busy} onPress={issue}>
            <Text style={styles.ctaText}>Giriş kodu üret</Text>
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

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View>
      <Text style={styles.cap}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} style={styles.input} placeholderTextColor={colors.muted} />
    </View>
  );
}

/* ---------- Posta ---------- */

const mmss = (ms: number) => {
  const t = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

function Mail() {
  const { children, messages, sendMessage, sendPhoto, sendVoice } = useStore();
  const [to, setTo] = useState(children[0]?.id);
  const [text, setText] = useState('');
  const [viewer, setViewer] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder, 250);
  const listRef = useRef<ScrollView>(null);
  const thread = messages.filter((m) => m.childId === to);
  const target = children.find((c) => c.id === to);

  useEffect(() => {
    if (!to && children[0]) setTo(children[0].id);
  }, [children, to]);

  const pickPhoto = async () => {
    if (!to) return;
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (r.canceled || !r.assets?.[0]) return;
    sendPhoto(to, r.assets[0].uri, r.assets[0].mimeType);
  };

  const startRecording = async () => {
    if (!to) return;
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) return Alert.alert('Mikrofon izni gerekli', 'Sesli mesaj için Ayarlar\'dan Fidan\'a mikrofon izni ver.');
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
    } catch (e) {
      Alert.alert('Kayıt başlatılamadı', (e as Error).message);
    }
  };

  const stopRecording = async (send: boolean) => {
    const duration = recorder.getStatus().durationMillis;
    setRecording(false);
    try {
      await recorder.stop();
    } finally {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    }
    const uri = recorder.uri;
    if (send && to && uri && duration >= 700) sendVoice(to, uri, duration);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ padding: 20, gap: 12, flex: 1 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
          {children.map((c) => (
            <Pressable key={c.id} onPress={() => setTo(c.id)} style={[styles.rcpt, to === c.id && { backgroundColor: colors.navy }]}>
              <Avatar id={c.avatar} size={22} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: to === c.id ? '#fff' : colors.navy }}>{c.name}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView
          ref={listRef}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          style={{ flex: 1, backgroundColor: '#fff', borderRadius: radius.lg }}
          contentContainerStyle={{ padding: 14, gap: 8 }}
        >
          {thread.map((m) => <Bubble key={m.id} m={m} onImage={setViewer} />)}
        </ScrollView>

        {recording ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <IconButton name="trash-outline" label="Kaydı sil" color={colors.danger} onPress={() => stopRecording(false)} />
            <View style={[styles.input, styles.recPill]}>
              <View style={styles.recDot} />
              <Text style={{ fontSize: 15, color: colors.navy, fontVariant: ['tabular-nums'] }}>{mmss(recState.durationMillis)}</Text>
            </View>
            <Pressable accessibilityLabel="Sesli mesajı gönder" onPress={() => stopRecording(true)} style={[styles.send, { backgroundColor: colors.navy }]}>
              <Ionicons name="paper-plane-outline" size={18} color="#fff" />
            </Pressable>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <IconButton name="image-outline" label="Fotoğraf" onPress={pickPhoto} />
            <IconButton name="mic-outline" label="Sesli mesaj" onPress={startRecording} />
            <TextInput
              value={text} onChangeText={setText} placeholder={`${target?.name ?? ''} için mesaj yaz`}
              placeholderTextColor={colors.muted} style={[styles.input, { flex: 1, minWidth: 0, borderRadius: 24, height: 44, paddingVertical: 0 }]}
            />
            <Pressable
              accessibilityLabel="Gönder"
              onPress={() => { if (to && text.trim()) { sendMessage(to, text.trim()); setText(''); } }}
              style={[styles.send, { backgroundColor: text.trim() ? colors.navy : '#A9AEBB' }]}
            >
              <Ionicons name="paper-plane-outline" size={18} color="#fff" />
            </Pressable>
          </View>
        )}
      </View>

      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={styles.viewer}>
          {viewer && <Image source={{ uri: viewer }} style={{ width: '100%', height: '80%' }} resizeMode="contain" />}
          <IconButton name="close" label="Kapat" onPress={() => setViewer(null)} style={{ position: 'absolute', top: 56, right: 20 }} />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function Bubble({ m, onImage }: { m: Message; onImage: (uri: string) => void }) {
  const mine = m.sender === 'parent';
  const fg = mine ? '#fff' : colors.navy;
  return (
    <View style={[styles.bubble, !mine && styles.bubbleIn, m.kind === 'image' && { padding: 4 }]}>
      {m.kind === 'image' ? (
        <Pressable onPress={() => m.mediaUrl && onImage(m.mediaUrl)} accessibilityLabel="Fotoğrafı aç">
          <Image source={m.mediaUrl ? { uri: m.mediaUrl } : undefined} style={styles.photo} resizeMode="cover" />
        </Pressable>
      ) : m.kind === 'audio' ? (
        <Voice uri={m.mediaUrl} durationMs={m.durationMs} color={fg} />
      ) : (
        <Text style={{ color: fg, fontSize: 15 }}>{m.text}</Text>
      )}
      <Text style={{ color: mine ? '#AEB6D1' : colors.muted, fontSize: 10, marginTop: 2, marginHorizontal: m.kind === 'image' ? 8 : 0 }}>
        {new Date(m.at).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );
}

function Voice({ uri, durationMs, color }: { uri?: string; durationMs?: number; color: string }) {
  const player = useAudioPlayer(uri ? { uri } : null);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    if (status.didJustFinish) {
      player.pause();
      player.seekTo(0);
    }
  }, [status.didJustFinish, player]);

  const total = status.duration > 0 ? status.duration * 1000 : durationMs ?? 0;
  const pos = status.currentTime * 1000;
  const progress = total > 0 ? Math.min(1, pos / total) : 0;
  const toggle = async () => {
    if (status.playing) return player.pause();
    await setAudioModeAsync({ playsInSilentMode: true });
    player.play();
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, width: 180 }}>
      <Pressable onPress={toggle} hitSlop={8} accessibilityLabel={status.playing ? 'Duraklat' : 'Oynat'}>
        <Ionicons name={status.playing ? 'pause' : 'play'} size={20} color={color} />
      </Pressable>
      <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: color, opacity: 0.3 }}>
        <View style={{ width: `${progress * 100}%`, height: 3, borderRadius: 2, backgroundColor: color }} />
      </View>
      <Text style={{ fontSize: 11, color, fontVariant: ['tabular-nums'] }}>{mmss(status.playing || pos > 0 ? pos : total)}</Text>
    </View>
  );
}

/* ---------- Hesap ---------- */

type AccountRow = 'manage' | 'join' | 'other';

const accountRows: { icon: keyof typeof Ionicons.glyphMap; label: string; id?: AccountRow }[] = [
  { icon: 'person-outline', label: 'Hesabı yönet', id: 'manage' },
  { icon: 'person-add-outline', label: 'Aileye katıl', id: 'join' },
  { icon: 'notifications-outline', label: 'Bildirim ayarları' },
  { icon: 'medkit-outline', label: 'Terapistimi bağla' },
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
    </ScrollView>
  );
}

/* ---------- Alttan açılan sayfa ---------- */

function Sheet({ visible, title, onClose, children }: {
  visible: boolean; title: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(15,27,61,0.35)' }} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <Text style={styles.h}>{title}</Text>
            <IconButton name="close" label="Kapat" onPress={onClose} style={{ backgroundColor: '#F1F2F6' }} />
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
  const [avatar, setAvatar] = useState(childAvatars[1].id);
  const [code, setCode] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const close = () => { setName(''); setBirthday(undefined); setCode(undefined); setKind('child'); onClose(); };

  const save = () => {
    if (!name.trim()) return Alert.alert('İsim gerekli');
    addChild({ name: name.trim(), avatar, gender, birthday });
    close();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(15,27,61,0.35)' }} onPress={close} />
      <View style={styles.sheet}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <Text style={styles.h}>Ekle</Text>
          <IconButton name="close" label="Kapat" onPress={close} style={{ backgroundColor: '#F1F2F6' }} />
        </View>
        <Segmented options={[{ id: 'child', label: 'Çocuk' }, { id: 'parent', label: 'Ebeveyn' }]} value={kind} onChange={(k) => { setKind(k); setCode(undefined); }} />

        <ScrollView style={{ maxHeight: 460 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: 16, gap: 14 }}>
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
              <Field label="İsim" value={name} onChange={setName} />
              <View>
                <Text style={[styles.cap, { marginBottom: 6 }]}>Cinsiyet</Text>
                <Segmented options={[{ id: 'kız', label: 'Kız' }, { id: 'erkek', label: 'Erkek' }]} value={gender} onChange={setGender} />
              </View>
              <View>
                <Text style={[styles.cap, { marginBottom: 6 }]}>Doğum günü</Text>
                <DateField mode="date" value={birthday} onChange={setBirthday} placeholder="Tarih seç" clearable />
              </View>
              <Pressable style={styles.cta} onPress={save}><Text style={styles.ctaText}>Çocuğu ekle</Text></Pressable>
            </>
          ) : (
            <>
              <Text style={{ fontSize: 13, color: colors.muted }}>
                Her yeni ebeveyn için size özel bir kod üretilir. Diğer ebeveyn bu kodla aileye katılır.
              </Text>
              {code ? (
                <CodeBox code={code} shareText={`Fidan'a katılmak için davet kodun: ${code}\nUygulamada Aile > Hesap > Aileye katıl bölümüne yaz.`} />
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
        </ScrollView>
      </View>
    </Modal>
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
  rcpt: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: '#fff' },
  bubble: { alignSelf: 'flex-end', backgroundColor: colors.navy, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, maxWidth: '80%' },
  bubbleIn: { alignSelf: 'flex-start', backgroundColor: '#F1F2F6' },
  photo: { width: 200, height: 200, borderRadius: 12, backgroundColor: colors.navySoft },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  recPill: { flex: 1, borderRadius: 24, height: 44, paddingVertical: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  accRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 16 },
  logout: { height: 50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 34 },
  cta: { height: 52, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  codeBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F3F4F8', borderRadius: radius.md, padding: 14 },
});
