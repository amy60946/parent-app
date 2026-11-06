import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { Avatar, IconButton, Segmented } from '../components/ui';
import { useStore } from '../store';
import { useAuth } from '../lib/auth';
import { KvkkKind, KvkkRequest, kvkkCreate, kvkkKinds, kvkkStatus, myKvkk } from '../lib/legal';
import { formatTR, toISO } from '../dates';
import { track } from '../lib/track';

// Aile › Hesap › KVKK başvurusu (hukuk/50 §4; ortak kvkk_request_create / my_kvkk_requests, türler durumlar.md P17).
// "Kimin için": kendim ya da ailedeki çocuk (p_child). Yanıt e-postayla; durum "Başvurularım"da.
const MAX = 2000;
const fmt = (iso: string) => formatTR(toISO(new Date(iso)));

export default function KvkkScreen({ navigation, route }: any) {
  const { children } = useStore();
  const { session } = useAuth();
  const email = session?.user.email ?? '';
  const [tab, setTab] = useState<'new' | 'list'>(route.params?.tab === 'list' ? 'list' : 'new');
  const [who, setWho] = useState<string>('me');
  const [kind, setKind] = useState<KvkkKind | null>(null);
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState<KvkkRequest[] | null | undefined>();

  const load = useCallback(() => { myKvkk().then(setList).catch(() => setList([])); }, []);
  useEffect(() => { load(); }, [load]);
  const meta = kvkkKinds.find((k) => k.kind === kind);
  const can = !!kind && (!meta?.needsDetail || detail.trim().length >= 5) && !busy;

  const send = async () => {
    if (!kind) return;
    setBusy(true);
    try {
      const r = await kvkkCreate(kind, detail.trim(), who === 'me' ? undefined : who);
      track('kvkk.create', { kind, child: who !== 'me' });
      Alert.alert('Başvurun alındı', `Başvuru no: ${r.id.slice(0, 8).toUpperCase()}\nEn geç ${fmt(r.due_at)} tarihine kadar ${email} adresine yanıt vereceğiz. Durumunu "Başvurularım"dan izleyebilirsin.`);
      setKind(null); setDetail(''); setWho('me'); setTab('list'); load();
    } catch (e) {
      Alert.alert('Gönderilemedi', (e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <IconButton name="chevron-back" label="Geri" onPress={() => navigation.goBack()} />
        <Text style={styles.topTitle}>KVKK başvurusu</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={{ paddingHorizontal: 20, paddingBottom: 6 }}>
        <Segmented options={[{ id: 'new', label: 'Yeni başvuru' }, { id: 'list', label: 'Başvurularım' }]} value={tab} onChange={setTab} />
      </View>
      {tab === 'new' ? (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
          <Text style={styles.text}>
            Kişisel verilerinle ilgili taleplerini buradan iletebilirsin. En geç 30 gün içinde, ücretsiz yanıt veririz. Yanıt {email} adresine gelir.{' '}
            <Text style={styles.link} onPress={() => navigation.navigate('LegalText', { key: 'kvkk-basvuru' })}>Başvuru usulü</Text>
          </Text>
          {children.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text style={styles.h}>Kimin için?</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Chip label="Kendim" on={who === 'me'} onPress={() => setWho('me')} />
                {children.map((c) => <Chip key={c.id} label={c.name} avatar={c.avatar} on={who === c.id} onPress={() => setWho(c.id)} />)}
              </View>
            </View>
          )}
          <View style={{ gap: 8 }}>
            <Text style={styles.h}>Ne istiyorsun?</Text>
            <View style={styles.list}>
              {kvkkKinds.map((k, i) => (
                <Pressable key={k.kind} onPress={() => setKind(k.kind)} style={[styles.opt, i > 0 && styles.sep]} accessibilityRole="radio" accessibilityState={{ selected: kind === k.kind }}>
                  <Ionicons name={kind === k.kind ? 'radio-button-on' : 'radio-button-off'} size={20} color={colors.navy} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.optText}>{k.label}</Text>
                    {kind === k.kind && k.hint && <Text style={styles.cap}>{k.hint}</Text>}
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={{ gap: 6 }}>
            <Text style={styles.h}>Açıklama{meta?.needsDetail ? '' : ' (isteğe bağlı)'}</Text>
            <TextInput value={detail} onChangeText={(v) => setDetail(v.slice(0, MAX))} multiline
              placeholder="Talebini kısaca yaz. Gerekmedikçe sağlık bilgisi ya da başka birinin kişisel bilgisini yazma."
              placeholderTextColor={colors.muted} style={styles.input} />
            <Text style={[styles.cap, { alignSelf: 'flex-end' }]}>{detail.length}/{MAX}</Text>
          </View>
          <Text style={styles.cap}>Başvurun hesabına bağlıdır; kimliğini ayrıca kanıtlaman gerekmez. Bazı taleplerde e-posta adresine bir doğrulama bağlantısı gönderebiliriz.</Text>
          <Pressable onPress={send} disabled={!can} style={[styles.cta, !can && { opacity: 0.45 }]} accessibilityRole="button">
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Başvuruyu gönder</Text>}
          </Pressable>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 10 }}>
          {list === undefined ? <ActivityIndicator color={colors.navy} /> : list === null ? (
            <Text style={styles.cap}>Başvurular sunucu güncellenince burada görünecek.</Text>
          ) : list.length === 0 ? (
            <Text style={[styles.cap, { textAlign: 'center', marginTop: 20 }]}>Henüz başvurun yok.</Text>
          ) : list.map((r) => (
            <View key={r.id} style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[styles.h, { flex: 1 }]} numberOfLines={2}>{kvkkKinds.find((k) => k.kind === r.kind)?.label ?? r.kind}</Text>
                <View style={[styles.badge, (r.status === 'answered' || r.status === 'rejected') && { backgroundColor: colors.easy.bg }]}>
                  <Text style={styles.badgeText}>{kvkkStatus[r.status].split(' (')[0]}</Text>
                </View>
              </View>
              <Text style={styles.cap}>
                No {r.id.slice(0, 8).toUpperCase()} · {fmt(r.received_at)}
                {r.child_id ? ` · ${children.find((c) => c.id === r.child_id)?.name ?? 'Çocuk'} için` : ''}
                {r.answered_at ? ` · Yanıt: ${fmt(r.answered_at)}` : ` · Son gün: ${fmt(r.due_at)}`}
              </Text>
              {r.status === 'rejected' && <Text style={styles.cap}>{kvkkStatus.rejected}</Text>}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Chip({ label, on, onPress, avatar }: { label: string; on: boolean; onPress: () => void; avatar?: string }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, on && styles.chipOn]} accessibilityRole="radio" accessibilityState={{ selected: on }}>
      {avatar && <Avatar id={avatar} size={22} />}
      <Text style={{ fontSize: 14, fontWeight: '600', color: on ? '#fff' : colors.navy }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  topTitle: { fontSize: 16, fontWeight: '700', color: colors.navy },
  text: { fontSize: 14, lineHeight: 20, color: '#4A5165' },
  link: { color: colors.navy, fontWeight: '700', textDecorationLine: 'underline' },
  h: { fontSize: 14, fontWeight: '700', color: colors.navy },
  cap: { fontSize: 12, lineHeight: 17, color: colors.muted },
  list: { backgroundColor: '#fff', borderRadius: radius.md, paddingHorizontal: 12 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  optText: { fontSize: 14, color: colors.navy },
  input: { letterSpacing: 0, backgroundColor: '#fff', borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.navy, minHeight: 100, textAlignVertical: 'top', borderWidth: 1, borderColor: colors.line },
  cta: { height: 52, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: radius.md, padding: 14, gap: 6 },
  badge: { backgroundColor: colors.medium.bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: '700', color: colors.navy },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 36, borderRadius: radius.pill, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
});
