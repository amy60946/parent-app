import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, Alert, Share, Linking, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { Avatar, Segmented } from '../components/ui';
import Info from '../components/Info';
import { CodeBox } from '../components/CodeBox';
import { useStore, IssuedCode, Child } from '../store';
import { track } from '../lib/track';

// Kurulumdan sonra ilk iş: çocuğun cihazını kur (kullanıcı kararı 27 Ekim 2026; ortak/sozlesme/akislar.md 15 adım 13).
// "Başka cihaz": indirme bağlantısını paylaş + giriş kodu (QR + yazılı). "Bu cihaz": App Store + kod. Çocuk bağlanınca ✓.
// Pofi Adası App Store adresi yayında EXPO_PUBLIC_GAME_STORE_URL ile verilir (yoksa bağlantısız tarif).
const GAME_URL = process.env.EXPO_PUBLIC_GAME_STORE_URL ?? '';

export default function DeviceSetupScreen({ navigation }: any) {
  const { children } = useStore();
  const [open, setOpen] = useState<string | undefined>();
  const close = () => navigation.goBack();
  const kid = children.find((c) => c.id === open);
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14, flexGrow: 1 }}>
        <View style={{ alignItems: 'center', gap: 8, paddingTop: 12 }}>
          <View style={styles.icon}><Ionicons name="tablet-portrait-outline" size={40} color={colors.navy} /></View>
          <Text style={styles.title} accessibilityRole="header">Çocuğunun cihazını kuralım</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.text}>Son adım: Pofi Adası'na giriş</Text>
            <Info title="Çocuğun cihazı" text="Çocuğun Pofi Adası oyununu kendi tabletinde ya da telefonunda oynar. Oyunu indirip açınca giriş ekranında 'QR okut'a dokunur ya da 6 haneli kodu yazar. Kod 15 dakika geçerli ve tek kullanımlıktır; istediğin an Aile › çocuk › Giriş kodu bölümünden yenisini alırsın." />
          </View>
        </View>
        <Text style={styles.section}>Hangi çocukla başlayalım?</Text>
        {children.map((c) => (
          <View key={c.id} style={styles.row}>
            <Avatar id={c.avatar} size={40} />
            <Text style={[styles.h, { flex: 1 }]}>{c.name}</Text>
            {c.linked ? (
              <View style={styles.done}><Ionicons name="checkmark" size={14} color={colors.easy.fg} /><Text style={styles.doneText}>Bağlandı</Text></View>
            ) : (
              <Pressable onPress={() => { setOpen(c.id); track('device.setup_open'); }} style={styles.start} accessibilityRole="button" accessibilityLabel={`${c.name} için başla`}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Başla</Text>
                <Ionicons name="chevron-forward" size={14} color="#fff" />
              </Pressable>
            )}
          </View>
        ))}
        <View style={{ flex: 1 }} />
        <Pressable onPress={close} style={{ alignSelf: 'center', paddingVertical: 10 }} accessibilityRole="button">
          <Text style={styles.link}>{children.every((c) => c.linked) ? 'Bitti' : 'Sonra yaparım'}</Text>
        </Pressable>
      </ScrollView>
      {kid && <DeviceSheet child={kid} onClose={() => setOpen(undefined)} />}
    </SafeAreaView>
  );
}

function DeviceSheet({ child, onClose }: { child: Child; onClose: () => void }) {
  const { createChildCode } = useStore();
  const [where, setWhere] = useState<'other' | 'this'>('other');
  const [code, setCode] = useState<IssuedCode | undefined>();
  const [busy, setBusy] = useState(false);
  const issue = async () => {
    setBusy(true);
    try { setCode(await createChildCode(child.id)); }
    catch (e) { Alert.alert('Kod üretilemedi', (e as Error).message); }
    finally { setBusy(false); }
  };
  useEffect(() => { issue(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const shareLink = () => Share.share({ message: GAME_URL
    ? `Pofi Adası'nı indir: ${GAME_URL}${code ? `\nGiriş kodu: ${code.code} (15 dakika geçerli)` : ''}`
    : `Pofi Adası'nı App Store'dan indir.${code ? `\nGiriş kodu: ${code.code} (15 dakika geçerli)` : ''}` });
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.h, { flex: 1, fontSize: 17 }]}>{child.name} hangi cihazı kullanacak?</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Kapat"><Ionicons name="close" size={22} color={colors.navy} /></Pressable>
          </View>
          <Segmented options={[{ id: 'other', label: 'Başka cihaz' }, { id: 'this', label: 'Bu cihaz' }]} value={where} onChange={setWhere} />
          {child.linked ? (
            <View style={{ alignItems: 'center', gap: 8, paddingVertical: 16 }}>
              <Ionicons name="checkmark-circle" size={44} color={colors.easy.fg} />
              <Text style={styles.h}>{child.name} bağlandı</Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ gap: 12 }}>
              <View style={styles.store}>
                <Text style={styles.text}>{where === 'other' ? 'Pofi Adası\'nı çocuğunun cihazına indir' : 'Pofi Adası\'nı bu cihaza indir'}</Text>
                {where === 'other' ? (
                  <Pressable onPress={shareLink} style={styles.storeBtn} accessibilityRole="button">
                    <Ionicons name="share-outline" size={16} color={colors.navy} />
                    <Text style={styles.storeText}>İndirme bağlantısını paylaş</Text>
                  </Pressable>
                ) : GAME_URL ? (
                  <Pressable onPress={() => Linking.openURL(GAME_URL)} style={styles.storeBtn} accessibilityRole="button">
                    <Ionicons name="logo-apple-appstore" size={16} color={colors.navy} />
                    <Text style={styles.storeText}>App Store'da aç</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.cap}>App Store'da "Pofi Adası" diye ara.</Text>
                )}
              </View>
              <Text style={[styles.text, { textAlign: 'center' }]}>Oyunu açınca "QR okut"a dokunsun ya da kodu yazsın</Text>
              {code ? (
                <CodeBox code={code} busy={busy} onRenew={issue} qr={where === 'other' ? `pofiadasi://baglan?kod=${code.code}` : undefined}
                  shareText={`${child.name} için Pofi Adası giriş kodu: ${code.code} (15 dakika geçerli)`} />
              ) : (
                <ActivityIndicator color={colors.navy} />
              )}
              <Text style={[styles.cap, { textAlign: 'center' }]}>Bağlanınca burada ✓ görünür.</Text>
            </ScrollView>
          )}
          <Pressable onPress={onClose} style={styles.cta} accessibilityRole="button">
            <Ionicons name="checkmark" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{child.linked ? 'Bitti' : 'Kurdum'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  icon: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.today, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: colors.navy, textAlign: 'center' },
  text: { fontSize: 14, color: '#4A5165' },
  cap: { fontSize: 12, color: colors.muted },
  h: { fontSize: 15, fontWeight: '700', color: colors.navy },
  section: { fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: 12 },
  link: { fontSize: 14, fontWeight: '600', color: colors.navy },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: radius.md, padding: 14 },
  start: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.navy, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  done: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.easy.bg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  doneText: { color: colors.easy.fg, fontWeight: '700', fontSize: 13 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,27,61,0.45)', justifyContent: 'center', padding: 16 },
  sheet: { backgroundColor: '#fff', borderRadius: radius.lg, padding: 18, gap: 14 },
  store: { backgroundColor: '#F3F4F8', borderRadius: radius.md, padding: 14, gap: 10, alignItems: 'center' },
  storeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: colors.line },
  storeText: { color: colors.navy, fontWeight: '700' },
  cta: { flexDirection: 'row', gap: 6, height: 50, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
});
