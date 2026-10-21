import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, Modal, Image, Alert, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  useAudioRecorder, useAudioRecorderState, useAudioPlayer, useAudioPlayerStatus, RecordingPresets,
  requestRecordingPermissionsAsync, setAudioModeAsync,
} from 'expo-audio';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { Avatar, IconButton } from '../components/ui';
import { useStore, Message } from '../store';
import { formatTR, todayISO, toISO, addDays } from '../dates';
import { useKeyboardHeight } from '../lib/useKeyboardHeight';
import { stickers, stickerOf } from '../data/stickers';
import { useBilling } from '../billing';
import { useNotifications } from '../notifications';

export const mmss = (ms: number) => {
  const t = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

const dayLabel = (iso: string) => {
  const d = toISO(new Date(iso));
  if (d === todayISO()) return 'Bugün';
  if (d === toISO(addDays(new Date(), -1))) return 'Dün';
  return formatTR(d);
};

// Sohbet listesinde son mesajın kısa hâli
export const messagePreview = (m: Message) =>
  m.kind === 'image' ? 'Fotoğraf' : m.kind === 'audio' ? `Sesli mesaj · ${mmss(m.durationMs ?? 0)}`
    : m.kind === 'sticker' ? `Çıkartma: ${stickerOf(m.text)?.label ?? ''}` : m.text;

type Row = { type: 'msg'; m: Message } | { type: 'day'; id: string; label: string };

export default function ChatScreen({ navigation, route }: any) {
  const childId: string = route.params.childId;
  const { children, messages, sendMessage, sendSticker, sendPhoto, sendVoice, markThreadRead } = useStore();
  const { allow } = useBilling();
  const { items: notes, markRead } = useNotifications();
  const [picker, setPicker] = useState(false);
  const child = children.find((c) => c.id === childId);
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const [text, setText] = useState('');
  const [viewer, setViewer] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder, 250);

  // Ters çevrilmiş liste: en yeni mesaj en altta, klavye açılınca da görünür kalır
  const rows = useMemo<Row[]>(() => {
    const thread = messages.filter((m) => m.childId === childId);
    const out: Row[] = [];
    thread.forEach((m, i) => {
      const day = toISO(new Date(m.at));
      if (i === 0 || toISO(new Date(thread[i - 1].at)) !== day) out.push({ type: 'day', id: `day-${day}`, label: dayLabel(m.at) });
      out.push({ type: 'msg', m });
    });
    return out.reverse();
  }, [messages, childId]);

  useEffect(() => {
    if (!child) navigation.goBack();
  }, [child, navigation]);

  // Açıkken gelen mesajlar da okundu sayılır; bu sohbetin bildirimleri de okundu olur
  const unreadCount = messages.filter((m) => m.childId === childId && m.sender === 'child' && !m.readAt).length;
  useEffect(() => { markThreadRead(childId); }, [childId, unreadCount, markThreadRead]);
  useEffect(() => {
    const ids = notes.filter((n) => !n.readAt && n.kind === 'message' && n.data?.child_id === childId).map((n) => n.id);
    if (ids.length) markRead(ids);
  }, [notes, childId, markRead]);
  if (!child) return null;

  const send = () => {
    const t = text.trim();
    if (!t || !allow('message')) return;
    sendMessage(childId, t);
    setText('');
  };

  const pickPhoto = async () => {
    if (!allow('message')) return;
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (r.canceled || !r.assets?.[0]) return;
    sendPhoto(childId, r.assets[0].uri, r.assets[0].mimeType);
  };

  const startRecording = async () => {
    if (!allow('message')) return;
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) return Alert.alert('Mikrofon izni gerekli', 'Sesli mesaj için Ayarlar\'dan uygulamaya mikrofon izni ver.');
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
    } catch (e) {
      Alert.alert('Kayıt başlatılamadı', (e as Error).message);
    }
  };

  const stopRecording = async (keep: boolean) => {
    const duration = recorder.getStatus().durationMillis;
    setRecording(false);
    try {
      await recorder.stop();
    } finally {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    }
    const uri = recorder.uri;
    if (keep && uri && duration >= 700) sendVoice(childId, uri, duration);
  };

  const hasText = !!text.trim();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <IconButton name="chevron-back" label="Geri" onPress={() => navigation.goBack()} style={{ backgroundColor: 'transparent' }} />
        <Avatar id={child.avatar} size={38} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{child.name}</Text>
          <Text style={styles.sub}>Mesajlar</Text>
        </View>
      </View>

      {rows.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 }}>
          <Avatar id={child.avatar} size={64} />
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.navy }}>{child.name} ile sohbet</Text>
          <Text style={{ fontSize: 13, color: colors.muted, textAlign: 'center' }}>
            Yazı, fotoğraf, sesli mesaj ya da çıkartma gönder. {child.name} Pofi Adası'nda okuyup yanıtlayabilir.
          </Text>
        </View>
      ) : (
      <FlatList
        data={rows}
        inverted
        keyExtractor={(r) => (r.type === 'day' ? r.id : r.m.id)}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 12 }}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) =>
          item.type === 'day' ? (
            <View style={styles.dayPill}><Text style={styles.dayText}>{item.label}</Text></View>
          ) : (
            <Bubble m={item.m} onImage={setViewer} />
          )
        }
      />
      )}

      {picker && !recording && (
        <View style={styles.picker}>
          {stickers.map((st) => (
            <Pressable key={st.key} accessibilityLabel={`${st.label} çıkartması gönder`} style={styles.pick}
              onPress={() => { if (allow('message')) sendSticker(childId, st.key); setPicker(false); }}>
              <Ionicons name={st.icon} size={30} color={st.color} />
              <Text style={{ fontSize: 10, color: colors.muted }} numberOfLines={1}>{st.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <View style={[styles.bar, { paddingBottom: kb ? kb + 8 : Math.max(insets.bottom, 10) }]}>
        {recording ? (
          <>
            <IconButton name="trash-outline" label="Kaydı sil" color={colors.danger} onPress={() => stopRecording(false)} style={styles.barBtn} />
            <View style={[styles.inputWrap, styles.recPill]}>
              <View style={styles.recDot} />
              <Text style={{ fontSize: 15, color: colors.navy, fontVariant: ['tabular-nums'] }}>{mmss(recState.durationMillis)}</Text>
              <Text style={{ fontSize: 12, color: colors.muted }}>Kaydediliyor…</Text>
            </View>
            <Pressable accessibilityLabel="Sesli mesajı gönder" onPress={() => stopRecording(true)} style={styles.send}>
              <Ionicons name="send" size={18} color="#fff" />
            </Pressable>
          </>
        ) : (
          <>
            <IconButton name="image-outline" label="Fotoğraf gönder" onPress={pickPhoto} style={styles.barBtn} />
            <IconButton name={picker ? 'close' : 'happy-outline'} label="Çıkartma" onPress={() => setPicker(!picker)} style={styles.barBtn} />
            <View style={styles.inputWrap}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Mesaj yaz"
                placeholderTextColor={colors.muted}
                multiline
                maxLength={2000}
                style={styles.input}
              />
            </View>
            {hasText ? (
              <Pressable accessibilityLabel="Gönder" onPress={send} style={styles.send}>
                <Ionicons name="send" size={18} color="#fff" />
              </Pressable>
            ) : (
              <Pressable accessibilityLabel="Sesli mesaj kaydet" onPress={startRecording} style={styles.send}>
                <Ionicons name="mic" size={20} color="#fff" />
              </Pressable>
            )}
          </>
        )}
      </View>

      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={styles.viewer}>
          {viewer && <Image source={{ uri: viewer }} style={{ width: '100%', height: '80%' }} resizeMode="contain" />}
          <IconButton name="close" label="Kapat" onPress={() => setViewer(null)} style={{ position: 'absolute', top: 56, right: 20 }} />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Bubble({ m, onImage }: { m: Message; onImage: (uri: string) => void }) {
  const mine = m.sender === 'parent';
  const fg = mine ? '#fff' : colors.navy;
  const time = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-end', marginTop: 2 }}>
      <Text style={[styles.time, { color: mine ? '#AEB6D1' : colors.muted }]}>{hhmm(m.at)}</Text>
      {mine && m.readAt && <Ionicons name="checkmark-done" size={13} color="#AEB6D1" accessibilityLabel="Okundu" />}
    </View>
  );
  if (m.kind === 'sticker') {
    const st = stickerOf(m.text);
    return (
      <View style={[styles.sticker, { alignSelf: mine ? 'flex-end' : 'flex-start' }]} accessibilityLabel={`Çıkartma: ${st?.label ?? ''}`}>
        <Ionicons name={st?.icon ?? 'help'} size={44} color={st?.color ?? colors.muted} />
        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.navy }}>{st?.label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Text style={[styles.time, { color: colors.muted, marginTop: 0 }]}>{hhmm(m.at)}</Text>
          {mine && m.readAt && <Ionicons name="checkmark-done" size={13} color={colors.muted} accessibilityLabel="Okundu" />}
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.bubble, mine ? styles.bubbleOut : styles.bubbleIn, m.kind === 'image' && { padding: 4 }]}>
      {m.kind === 'image' ? (
        <>
          <Pressable onPress={() => m.mediaUrl && onImage(m.mediaUrl)} accessibilityLabel="Fotoğrafı aç">
            <Image source={m.mediaUrl ? { uri: m.mediaUrl } : undefined} style={styles.photo} resizeMode="cover" />
          </Pressable>
          <View style={{ paddingHorizontal: 8, paddingBottom: 2 }}>{time}</View>
        </>
      ) : m.kind === 'audio' ? (
        <>
          <Voice uri={m.mediaUrl} durationMs={m.durationMs} color={fg} />
          {time}
        </>
      ) : (
        <>
          <Text style={{ color: fg, fontSize: 15, lineHeight: 20 }}>{m.text}</Text>
          {time}
        </>
      )}
    </View>
  );
}

export function Voice({ uri, durationMs, color }: { uri?: string; durationMs?: number; color: string }) {
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
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, width: 190 }}>
      <Pressable onPress={toggle} hitSlop={8} accessibilityLabel={status.playing ? 'Duraklat' : 'Oynat'}>
        <Ionicons name={status.playing ? 'pause' : 'play'} size={22} color={color} />
      </Pressable>
      <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: color, opacity: 0.3 }}>
        <View style={{ width: `${progress * 100}%`, height: 3, borderRadius: 2, backgroundColor: color }} />
      </View>
      <Text style={{ fontSize: 11, color, fontVariant: ['tabular-nums'] }}>{mmss(status.playing || pos > 0 ? pos : total)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#EEF0F5' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line,
  },
  name: { fontSize: 16, fontWeight: '700', color: colors.navy },
  sub: { fontSize: 12, color: colors.muted },
  dayPill: { alignSelf: 'center', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, marginVertical: 10 },
  dayText: { fontSize: 11, fontWeight: '600', color: colors.muted },
  bubble: { maxWidth: '80%', borderRadius: 18, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6, marginVertical: 2 },
  bubbleOut: { alignSelf: 'flex-end', backgroundColor: colors.navy, borderBottomRightRadius: 6 },
  bubbleIn: { alignSelf: 'flex-start', backgroundColor: '#fff', borderBottomLeftRadius: 6 },
  time: { fontSize: 10 },
  sticker: { alignItems: 'center', gap: 2, paddingHorizontal: 14, paddingVertical: 10, marginVertical: 4, borderRadius: 18, backgroundColor: '#fff' },
  picker: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, paddingVertical: 8, backgroundColor: '#fff', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  pick: { width: '16.66%', alignItems: 'center', gap: 2, paddingVertical: 8 },
  photo: { width: 220, height: 220, borderRadius: 14, backgroundColor: colors.navySoft },
  bar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 10, paddingTop: 8,
    backgroundColor: '#fff', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line,
  },
  barBtn: { backgroundColor: '#F1F2F6', width: 42, height: 42, borderRadius: 21 },
  inputWrap: { flex: 1, minHeight: 42, maxHeight: 120, borderRadius: 21, backgroundColor: '#F1F2F6', paddingHorizontal: 14, justifyContent: 'center' },
  input: { letterSpacing: 0, fontSize: 15, color: colors.navy, paddingTop: 10, paddingBottom: 10, maxHeight: 116 },
  send: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  recPill: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
});
