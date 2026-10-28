import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Share, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { IconButton } from '../components/ui';
import Info from '../components/Info';
import { colors, radius } from '../theme';
import { createGuestPass, GuestPass } from '../lib/guestPass';
import { formatTR } from '../dates';
import { track } from '../lib/track';

// 30 günlük misafir kartı (kullanıcı isteği 28 Ekim 2026, Joon "30-Day All Access Guest Pass"; akislar.md 19):
// aile, ParentApp'i kullanmayan bir aileye 30 gün tam erişim hediye eder. Kod açılınca üretilir (kullanılmamış kart
// varsa aynısı gelir), paylaşım metniyle gönderilir. Kart yeni başlayan bir ailede bir kez kullanılır.
const pretty = (code: string) => `${code.slice(0, 4)} ${code.slice(4)}`;

export default function GuestPassScreen({ navigation }: any) {
  const [pass, setPass] = useState<GuestPass | null | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    createGuestPass().then(setPass).catch((e) => { setPass(null); setError((e as Error).message); });
  }, []);

  const message = pass
    ? `Sana ParentApp'te 30 gün tam erişim hediye ediyorum. Çocukların rutinleri ve görevleri için kullandığım uygulama; evde işler gerçekten kolaylaştı. ParentApp'i indir, hesap aç ve kurulumda "Kodum var"a (ya da Aile › Hesap › Kod gir) şu kodu yaz: ${pretty(pass.code)} (${formatTR(pass.expiresAt.slice(0, 10))} tarihine kadar geçerli).`
    : '';
  const share = async () => {
    if (!pass) return;
    track('guest_pass.share');
    await Share.share({ message }).catch(() => {});
  };
  const copy = async () => {
    if (!pass) return;
    await Clipboard.setStringAsync(pass.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={{ width: 36 }} />
        <IconButton name="close" label="Kapat" onPress={() => navigation.goBack()} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24, gap: 18, alignItems: 'stretch' }}>
        <Text style={styles.title} accessibilityRole="header">Bir aileye 30 gün hediye et</Text>

        {/* Kart */}
        <View style={styles.card}>
          <View style={styles.glow} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Image source={require('../../assets/brand-mark.png')} style={{ width: 34, height: 34 }} />
            <Text style={styles.brand}>ParentApp</Text>
          </View>
          <View style={{ flex: 1 }} />
          <Text style={styles.big}>30 gün</Text>
          <Text style={styles.cardSub}>Tam erişim · hediye kartı</Text>
          <View style={styles.codeRow}>
            {pass === undefined ? <ActivityIndicator color="#fff" /> : pass ? (
              <>
                <Text style={styles.code} selectable accessibilityLabel={`Kod ${pass.code.split('').join(' ')}`}>{pretty(pass.code)}</Text>
                <Pressable onPress={copy} hitSlop={8} accessibilityRole="button" accessibilityLabel="Kodu kopyala" style={styles.copy}>
                  <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={colors.navy} />
                  <Text style={styles.copyText}>{copied ? 'Kopyalandı' : 'Kopyala'}</Text>
                </Pressable>
              </>
            ) : <Text style={styles.cardSub}>Kod şu an üretilemedi</Text>}
          </View>
        </View>

        <Text style={styles.text}>
          Günlük rutinlerle uğraşan bir ebeveyn tanıyorsan ParentApp'i 30 gün bütün özellikleriyle denemesini sağla: görevler, rutinler, ödüller ve çocuğunun oyunu.
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[styles.cap, { flex: 1 }]}>Kart ParentApp'e yeni başlayan bir ailede bir kez kullanılır{pass ? `; ${formatTR(pass.expiresAt.slice(0, 10))} tarihine kadar geçerli` : ''}.</Text>
          <Info title="Hediye kartı" text={'Kodu alan aile ParentApp\'i indirip hesap açar, kurulumda "Kodum var"a (ya da Aile › Hesap › Kod gir) kodu yazar; ParentApp 30 gün bütün özellikleriyle açılır. Ödeme bilgisi istenmez, süre bitince kendiliğinden ücretsiz plana döner.\n\nKart, ParentApp\'i kullanmaya başlayalı 7 günü geçmemiş ve daha önce kart kullanmamış bir ailede geçerlidir. Kart kullanılınca sana bildirim gelir; kimin kullandığı gösterilmez.'} />
        </View>
        {!!error && <Text style={{ fontSize: 13, color: colors.danger }}>{error}</Text>}
        {pass === null && !error && <Text style={styles.cap}>Hediye kartları çok yakında.</Text>}
      </ScrollView>
      <View style={{ paddingHorizontal: 24, paddingBottom: 8, gap: 10 }}>
        <Pressable onPress={share} disabled={!pass} style={[styles.cta, !pass && { opacity: 0.45 }]} accessibilityRole="button">
          <Ionicons name="share-outline" size={18} color="#fff" />
          <Text style={styles.ctaText}>Hediye kartını paylaş</Text>
        </Pressable>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={{ alignSelf: 'center', paddingVertical: 6 }} accessibilityRole="button">
          <Text style={styles.link}>Daha sonra</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  title: { fontSize: 24, fontWeight: '800', color: colors.navy, textAlign: 'center' },
  card: { height: 210, borderRadius: 22, backgroundColor: colors.navy, padding: 20, overflow: 'hidden' },
  glow: { position: 'absolute', right: -70, top: -70, width: 220, height: 220, borderRadius: 110, borderWidth: 26, borderColor: 'rgba(233,178,43,0.14)' },
  brand: { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },
  big: { fontSize: 38, fontWeight: '800', color: '#fff' },
  cardSub: { fontSize: 13, color: 'rgba(255,255,255,0.72)' },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, minHeight: 34 },
  code: { fontSize: 22, fontWeight: '800', color: colors.gold, letterSpacing: 3 },
  copy: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff', borderRadius: radius.pill, paddingHorizontal: 12, height: 32 },
  copyText: { fontSize: 13, fontWeight: '700', color: colors.navy },
  text: { fontSize: 15, lineHeight: 22, color: '#4A5165', textAlign: 'center' },
  cap: { fontSize: 12, lineHeight: 17, color: colors.muted },
  cta: { flexDirection: 'row', gap: 8, height: 52, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  link: { fontSize: 15, fontWeight: '700', color: colors.navy },
});
