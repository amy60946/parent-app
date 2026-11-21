import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Switch, Alert, Platform, Linking, ActivityIndicator, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { IconButton } from '../components/ui';
import { pushEnabled, pushPermission, setPushEnabled } from '../lib/notifications';
import { NotifPrefKey, NotifPrefs, loadNotifPrefs, saveNotifPref } from '../lib/notificationPrefs';
import { track } from '../lib/track';

// Bildirim ayarları (kullanıcı kararları 20 Kasım 2026; ortak akislar.md 25 "5a" ve "Sunucu motoru", metin hukuk/50 §14.1).
// Giriş iki yerden: Bildirimler listesinin sağ üstündeki dişli ve Aile › Hesap › Bildirim ayarları.
// Telefonun bildirim izni kapalıysa üstte bant + "Ayarları aç" (anahtarlar yine kaydedilir).
// "Kampanya ve yenilikler" anahtarı (hukuk/50 §14.1) sunucuda izin kaydı ve İYS bildirimi olmadan eklenmez.
const ROWS: { key: NotifPrefKey; title: string; text: string }[] = [
  { key: 'step_done', title: 'Adım bildirimleri', text: 'Çocuğun oyunda bir adımı işaretleyince haber ver.' },
  { key: 'day_complete', title: 'Günün özeti', text: 'Bugünün bütün adımları tamamlanınca tek bildirim: "Bugünün adımları tamamlandı."' },
  { key: 'tips', title: 'Hatırlatmalar ve ipuçları', text: 'Moyo\'yu kurarken ve kullanırken kısa hatırlatmalar.' },
];

export default function NotificationSettingsScreen({ navigation }: any) {
  const [prefs, setPrefs] = useState<NotifPrefs | null | undefined>(undefined); // undefined: yükleniyor, null: yüklenemedi
  const [failed, setFailed] = useState(false);
  const [push, setPush] = useState(true);
  const [denied, setDenied] = useState(false);

  const checkPermission = useCallback(() => {
    if (Platform.OS === 'web') return;
    pushPermission().then((p) => setDenied(p === 'denied'));
  }, []);

  useFocusEffect(useCallback(() => {
    pushEnabled().then(setPush);
    checkPermission();
    loadNotifPrefs().then((p) => { setPrefs(p); setFailed(p === null); }).catch(() => { setPrefs(null); setFailed(true); });
    // iPhone Ayarları'ndan dönünce izin bandı güncellensin
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') checkPermission(); });
    return () => sub.remove();
  }, [checkPermission]));

  const togglePush = async (on: boolean) => {
    setPush(on);
    const r = await setPushEnabled(on);
    if (on && r === 'denied') {
      setPush(false);
      setDenied(true);
      Alert.alert('İzin gerekli', 'Telefonun Ayarlar › Moyo › Bildirimler bölümünden izin ver, sonra tekrar aç.');
    }
  };

  const toggle = async (key: NotifPrefKey, on: boolean) => {
    if (!prefs) return;
    const before = prefs;
    setPrefs({ ...prefs, [key]: on });
    try {
      setPrefs(await saveNotifPref(key, on));
      track('notification.pref', { key, on });
    } catch {
      setPrefs(before);
      Alert.alert('Kaydedilemedi', 'Ayar şu an kaydedilemedi. İnternet bağlantını kontrol edip tekrar dene.');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <IconButton name="chevron-back" onPress={() => navigation.goBack()} label="Geri" />
        <Text style={styles.title} accessibilityRole="header">Bildirim ayarları</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        {denied && (
          <View style={styles.banner}>
            <Ionicons name="notifications-off-outline" size={20} color={colors.navy} />
            <View style={{ flex: 1, gap: 8 }}>
              <Text style={styles.h}>Telefon bildirimleri kapalı</Text>
              <Text style={styles.cap}>Açmak için iPhone Ayarları › Moyo › Bildirimler.</Text>
              <Pressable onPress={() => Linking.openSettings()} style={styles.bannerBtn} accessibilityRole="button">
                <Text style={styles.bannerBtnText}>Ayarları aç</Text>
              </Pressable>
            </View>
          </View>
        )}

        {Platform.OS !== 'web' && (
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.h}>Telefona bildirim gönder</Text>
                <Text style={styles.cap}>Kapalıyken bildirimler yalnız uygulamada görünür.</Text>
              </View>
              <Switch value={push} onValueChange={togglePush} trackColor={{ true: colors.navy }} accessibilityLabel="Telefona bildirim gönder" />
            </View>
          </View>
        )}

        <Text style={styles.lead}>Moyo sana günde birden fazla bildirim göndermemeye çalışır.</Text>
        <View style={styles.card}>
          {prefs === undefined && <ActivityIndicator color={colors.navy} style={{ paddingVertical: 20 }} />}
          {failed && <Text style={[styles.cap, { paddingVertical: 14 }]}>Bu ayarlar şu an yüklenemedi. Biraz sonra tekrar dene.</Text>}
          {prefs && ROWS.map((r, i) => (
            <View key={r.key} style={[styles.row, i > 0 && styles.sep]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.h}>{r.title}</Text>
                <Text style={styles.cap}>{r.text}</Text>
              </View>
              <Switch value={prefs[r.key]} onValueChange={(v) => toggle(r.key, v)} trackColor={{ true: colors.navy }} accessibilityLabel={r.title} />
            </View>
          ))}
        </View>
        <Text style={styles.foot}>
          Bu ayarlar yalnız telefona gelen bildirimleri etkiler; hepsi uygulamadaki Bildirimler listesinde görünür. Ailedeki öteki ebeveyn kendi ayarını seçer.
          Hesap, abonelik, güvenlik ve uzman paylaşımıyla ilgili bildirimler bu ayarlara bağlı değildir.{' '}
          <Text style={styles.link} onPress={() => navigation.navigate('LegalText', { key: 'kosullar-parentapp' })}>Kullanım Koşulları</Text>
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  title: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.navy },
  banner: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: radius.md, backgroundColor: '#FFF4DA' },
  bannerBtn: { alignSelf: 'flex-start', backgroundColor: colors.navy, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  bannerBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: radius.md, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  lead: { fontSize: 13, color: colors.muted, paddingHorizontal: 2 },
  h: { fontSize: 14, fontWeight: '600', color: colors.navy },
  cap: { fontSize: 12, color: colors.muted, marginTop: 2, lineHeight: 16 },
  foot: { fontSize: 12, color: colors.muted, lineHeight: 17, paddingHorizontal: 2 },
  link: { color: colors.navy, textDecorationLine: 'underline' },
});
