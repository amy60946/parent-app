import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Share, ActivityIndicator, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { IconButton } from '../components/ui';
import Info from '../components/Info';
import { colors, radius } from '../theme';
import { createGuestPass, GuestPass, myReferrals, Referrals } from '../lib/guestPass';
import { storeRedeemCode } from '../lib/purchases';
import { formatTR } from '../dates';
import { track } from '../lib/track';

// Aile davet et (önce 30 günlük misafir kartı, 28 Ekim 2026; 3 Kasım 2026 kullanıcı kararı, akislar.md 19): davet edilen aile
// 7 + 7 = 14 gün dener; abone olursa davet eden 1 ay kazanır (yılda en çok 12; benchmark: ödemeye bağlı çift taraflı davet,
// YNAB / Babbel). Kod açılınca üretilir (kullanılmamış kod varsa aynısı gelir), paylaşım metniyle gönderilir. Altta davet özeti
// (kimlik yok) ve App Store'dan ödeyen aileye gönderilen Apple hediye kodu.
const pretty = (code: string) => `${code.slice(0, 4)} ${code.slice(4)}`;

export default function GuestPassScreen({ navigation }: any) {
  const [pass, setPass] = useState<GuestPass | null | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [copied, setCopied] = useState<string | null>(null);
  const [ref, setRef] = useState<Referrals | null>(null);
  useEffect(() => {
    createGuestPass().then(setPass).catch((e) => { setPass(null); setError((e as Error).message); });
    myReferrals().then(setRef).catch(() => {});
  }, []);

  const message = pass
    ? `Çocukların rutinleri ve sorumlulukları için Moyo'yu kullanıyorum. Bu davet koduyla 7 yerine 14 gün ücretsiz denersin: ${pretty(pass.code)}. Moyo'yu indir, açılışta "Davet kodun var mı?" sorusuna Evet de ve kodu yaz (sonra da Aile › Hesap › Kod gir). Kod ${formatTR(pass.expiresAt.slice(0, 10))} tarihine kadar geçerli.`
    : '';
  const share = async () => {
    if (!pass) return;
    track('guest_pass.share');
    await Share.share({ message }).catch(() => {});
  };
  const copy = async (code: string) => {
    await Clipboard.setStringAsync(code).catch(() => {});
    setCopied(code);
    setTimeout(() => setCopied(null), 1600);
  };
  // Apple hediye kodu: panoya kopyala, Apple'ın kod sayfasını aç (yapıştırılır)
  const redeem = async (code: string) => {
    await copy(code);
    track('referral.redeem');
    if (!(await storeRedeemCode())) Alert.alert('Kodu kullan', 'App Store › profil resmin › Hediye Kartı veya Kod Kullan › kodu yapıştır.');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={{ width: 36 }} />
        <IconButton name="close" label="Kapat" onPress={() => navigation.goBack()} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24, gap: 18, alignItems: 'stretch' }}>
        <Text style={styles.title} accessibilityRole="header">Bir aileyi davet et</Text>

        {/* Kart */}
        <View style={styles.card}>
          <View style={styles.glow} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Image source={require('../../assets/brand-mark.png')} style={{ width: 34, height: 34 }} />
            <Text style={styles.brand}>Moyo</Text>
          </View>
          <View style={{ flex: 1 }} />
          <Text style={styles.big}>+1 hafta</Text>
          <Text style={styles.cardSub}>Davet edilen aileye · 14 gün ücretsiz</Text>
          <View style={styles.codeRow}>
            {pass === undefined ? <ActivityIndicator color="#fff" /> : pass ? (
              <>
                <Text style={styles.code} selectable accessibilityLabel={`Kod ${pass.code.split('').join(' ')}`}>{pretty(pass.code)}</Text>
                <Pressable onPress={() => copy(pass.code)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Kodu kopyala" style={styles.copy}>
                  <Ionicons name={copied === pass.code ? 'checkmark' : 'copy-outline'} size={16} color={colors.navy} />
                  <Text style={styles.copyText}>{copied === pass.code ? 'Kopyalandı' : 'Kopyala'}</Text>
                </Pressable>
              </>
            ) : <Text style={styles.cardSub}>Kod şu an üretilemedi</Text>}
          </View>
        </View>

        {/* İki taraf ne kazanır: kısa, iki satır */}
        <View style={styles.perks}>
          <Perk icon="people-outline" title="Onlar" text="7 yerine 14 gün bütün özelliklerle dener" />
          <View style={styles.perkSep} />
          <Perk icon="gift-outline" title="Sen" text="Aile abone olursa 1 ay ücretsiz (yılda en çok 12 ay)" />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[styles.cap, { flex: 1 }]}>Kod yeni başlayan bir ailede bir kez kullanılır{pass ? `; ${formatTR(pass.expiresAt.slice(0, 10))} tarihine kadar geçerli` : ''}.</Text>
          <Info title="Aile davet et" text={'Kodu alan aile Moyo\'yu indirir, açılışta "Davet kodun var mı?" sorusunda (ya da sonra Aile › Hesap › Kod gir) kodu yazar; Moyo 7 yerine 14 gün bütün özellikleriyle açılır. Ödeme bilgisi istenmez.\n\nAile mağazadan abone olursa sen 1 ay ücretsiz kazanırsın: abone değilsen süren hemen uzar; App Store aboneliğin varsa sana 1 aylık Apple hediye kodu gönderilir. Yılda en çok 12 ay.\n\nKod, Moyo\'yu kullanmaya başlayalı 7 günü geçmemiş ve daha önce kod kullanmamış bir ailede geçerlidir. Kimin kullandığı ve kimin abone olduğu gösterilmez.'} />
        </View>

        {/* Davet özeti (sunucu güncellemesi uygulandıysa) */}
        {ref && (ref.joined > 0 || ref.codes.length > 0) && (
          <View style={styles.stats}>
            <Stat n={ref.joined} label="aile başladı" />
            <Stat n={ref.paid} label="abone oldu" />
            <Stat n={ref.months} label="ay kazandın" />
          </View>
        )}
        {!!ref?.pendingCodes && (
          <Text style={styles.cap}>{ref.pendingCodes} aylık Apple hediye kodun hazırlanıyor; gelince burada ve bildirimlerde görünür.</Text>
        )}
        {ref?.codes.map((c) => (
          <View key={c.code} style={styles.offer}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#6B5300' }}>1 ay Apple hediye kodu</Text>
              <Text style={{ fontSize: 17, fontWeight: '800', color: colors.navy, letterSpacing: 1 }} selectable>{c.code}</Text>
            </View>
            <Pressable onPress={() => redeem(c.code)} style={styles.offerBtn} accessibilityRole="button" accessibilityLabel="Apple hediye kodunu kullan">
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>{copied === c.code ? 'Kopyalandı' : 'Kodu kullan'}</Text>
            </Pressable>
          </View>
        ))}

        {!!error && <Text style={{ fontSize: 13, color: colors.danger }}>{error}</Text>}
        {pass === null && !error && <Text style={styles.cap}>Aile davetleri çok yakında.</Text>}
      </ScrollView>
      <View style={{ paddingHorizontal: 24, paddingBottom: 8, gap: 10 }}>
        <Pressable onPress={share} disabled={!pass} style={[styles.cta, !pass && { opacity: 0.45 }]} accessibilityRole="button">
          <Ionicons name="share-outline" size={18} color="#fff" />
          <Text style={styles.ctaText}>Davet kodunu paylaş</Text>
        </Pressable>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={{ alignSelf: 'center', paddingVertical: 6 }} accessibilityRole="button">
          <Text style={styles.link}>Daha sonra</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Perk({ icon, title, text }: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={styles.perkIcon}><Ionicons name={icon} size={20} color={colors.navy} /></View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: colors.navy }}>{title}</Text>
        <Text style={{ fontSize: 14, lineHeight: 19, color: '#4A5165' }}>{text}</Text>
      </View>
    </View>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text style={{ fontSize: 22, fontWeight: '800', color: colors.navy }}>{n}</Text>
      <Text style={{ fontSize: 12, color: colors.muted }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  perks: { backgroundColor: '#fff', borderRadius: radius.md, padding: 14, gap: 12 },
  perkSep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  perkIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF4D6', alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: radius.md, paddingVertical: 14 },
  offer: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF6DE', borderRadius: radius.md, padding: 14 },
  offerBtn: { height: 38, paddingHorizontal: 14, borderRadius: 19, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
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
  cap: { fontSize: 12, lineHeight: 17, color: colors.muted },
  cta: { flexDirection: 'row', gap: 8, height: 52, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  link: { fontSize: 15, fontWeight: '700', color: colors.navy },
});
