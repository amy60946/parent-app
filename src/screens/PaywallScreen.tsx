import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Alert, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { IconButton } from '../components/ui';
import { useBilling } from '../billing';
import { PlanId, plans, premiumFeatures, freeFeatures } from '../data/plans';
import { purchase, restorePurchases } from '../lib/billing';
import { formatTR, toISO } from '../dates';
import { openLegal } from '../lib/legal';

const NOT_CONNECTED = 'Ödeme henüz açık değil. Uygulama App Store\'da yayınlanınca üyelik buradan alınabilecek.';

// Üyelik: deneme bitince açılır; Aile > Hesap > Üyelik'ten ve kapalı bir özelliğe dokununca da açılır.
export default function PaywallScreen({ navigation, route }: any) {
  const reason: string | undefined = route.params?.reason;
  const { access, refresh } = useBilling();
  const [plan, setPlan] = useState<PlanId>('yearly');
  const [busy, setBusy] = useState(false);
  const state = access?.state;
  const member = state === 'premium' || state === 'clinic';

  const buy = async () => {
    setBusy(true);
    try {
      const r = await purchase(plan);
      if (r.ok) { await refresh(); navigation.goBack(); Alert.alert('Premium üyeliğin başladı'); }
      else if (r.reason === 'not_connected') Alert.alert('Yakında', NOT_CONNECTED);
      else if (r.reason === 'failed') Alert.alert('Satın alınamadı', r.message ?? 'Tekrar dene.');
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    const r = await restorePurchases();
    if (r.ok) { await refresh(); Alert.alert('Satın alımların geri yüklendi'); }
    else Alert.alert('Geri yükleme', r.reason === 'not_connected' ? NOT_CONNECTED : 'Bu Apple Kimliği ile etkin bir üyelik bulunamadı.');
  };

  const title = member ? 'Üyeliğin' : state === 'expired' ? 'Ücretsiz deneme süren bitti' : 'Premium\'a geç';
  // Deneme kartsız ve kendiliğinden ücretlenmez (hukuk/50 §7)
  const sub = reason
    ?? (state === 'trial' && access?.daysLeft !== undefined
      ? `Ücretsiz denemende ${access.daysLeft} gün kaldı. Bittiğinde ücretsiz planla devam edersin; senden kendiliğinden ücret alınmaz.`
      : state === 'expired'
        ? 'Ücretsiz planda 1 çocuk ve 3 etkin görevle devam edebilirsin; ödüller, mesajlar ve gözlem notları kapanır. Verilerin silinmez.'
        : 'Ailenin bütün özellikleri tek üyelikte. İki ebeveyn birlikte kullanır.');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.head}>
        <IconButton name="close" label="Kapat" onPress={() => navigation.goBack()} style={{ backgroundColor: '#F1F2F6' }} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 28, gap: 18 }}>
        <View style={{ gap: 8 }}>
          <View style={styles.mark}><Ionicons name="sunny" size={26} color={colors.gold} /></View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.sub}>{member ? memberText(access) : sub}</Text>
        </View>

        {member ? (
          <>
            {state === 'premium' && (
              <Pressable style={styles.secondary} onPress={() => Linking.openURL('https://apps.apple.com/account/subscriptions')}>
                <Text style={styles.secondaryText}>Aboneliği yönet</Text>
              </Pressable>
            )}
          </>
        ) : (
          <>
            <View style={{ gap: 10 }}>
              {premiumFeatures.map((f) => (
                <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.easy.fg} />
                  <Text style={{ fontSize: 15, color: colors.navy }}>{f}</Text>
                </View>
              ))}
            </View>

            <View style={{ gap: 10 }}>
              {(['yearly', 'monthly'] as PlanId[]).map((id) => {
                const p = plans[id];
                const on = plan === id;
                return (
                  <Pressable key={id} onPress={() => setPlan(id)} style={[styles.plan, on && styles.planOn]}
                    accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${p.title} ${p.price} / ${p.period}`}>
                    <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={22} color={colors.navy} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.navy }}>{p.title}</Text>
                        {p.badge && <View style={styles.badge}><Text style={styles.badgeText}>{p.badge}</Text></View>}
                      </View>
                      <Text style={{ fontSize: 12, color: colors.muted }}>{p.note}</Text>
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.navy }}>{p.price}<Text style={{ fontSize: 12, fontWeight: '500', color: colors.muted }}> / {p.period}</Text></Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable style={[styles.cta, busy && { opacity: 0.6 }]} disabled={busy} onPress={buy} accessibilityLabel="Üyeliği başlat">
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Devam et</Text>}
            </Pressable>
            <Pressable onPress={restore} hitSlop={8} style={{ alignSelf: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.navy }}>Satın alımları geri yükle</Text>
            </Pressable>
            {state === 'expired' && (
              <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={{ alignSelf: 'center', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 14, color: colors.muted }}>Şimdilik ücretsiz devam et</Text>
                <Text style={{ fontSize: 12, color: colors.muted, textAlign: 'center' }}>{freeFeatures}</Text>
              </Pressable>
            )}
            {/* hukuk/50 §6.1 (Apple 3.1.2) */}
            <Text style={styles.legal}>
              Ödeme, satın almayı onayladığında Apple hesabından alınır. Abonelik, dönem bitmeden en az 24 saat önce iptal edilmezse
              aynı süre ve fiyatla kendiliğinden yenilenir; yenileme ücreti dönemin son 24 saati içinde alınır. Aboneliğini iPhone
              Ayarlar › [adın] › Abonelikler'den ya da aşağıdaki "Aboneliği yönet" ile istediğin an iptal edebilirsin; iptal, ödenmiş
              dönemin sonunda geçerli olur. İade talepleri Apple'ın kurallarına göre Apple'a yapılır.
            </Text>
            <Text style={[styles.legal, { textAlign: 'center' }]}>
              <Text style={styles.legalLink} onPress={() => openLegal('kosullar-parentapp')}>Kullanım Koşulları</Text>{'  ·  '}
              <Text style={styles.legalLink} onPress={() => openLegal('gizlilik')}>Gizlilik Politikası</Text>{'  ·  '}
              <Text style={styles.legalLink} onPress={() => Linking.openURL('https://apps.apple.com/account/subscriptions')}>Aboneliği yönet</Text>
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function memberText(a: ReturnType<typeof useBilling>['access']) {
  if (a?.state === 'clinic') return 'Uzmanının kliniği üzerinden Premium kullanıyorsun.';
  const plan = a?.plan === 'yearly' ? 'Yıllık' : 'Aylık';
  const end = a?.periodEnd ? formatTR(toISO(new Date(a.periodEnd))) : '';
  if (!end) return `${plan} Premium üyelik.`;
  return a?.autoRenew === false ? `${plan} Premium · ${end} tarihinde bitecek (yenileme kapalı).` : `${plan} Premium · ${end} tarihinde yenilenir.`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  head: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingVertical: 8 },
  mark: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#FFF6DE', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '800', color: colors.navy },
  sub: { fontSize: 15, lineHeight: 21, color: colors.muted },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.line },
  planOn: { borderColor: colors.navy, backgroundColor: '#F6F7FB' },
  badge: { backgroundColor: colors.easy.bg, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '700', color: colors.easy.fg },
  cta: { height: 54, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondary: { height: 50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: colors.navy, fontSize: 15, fontWeight: '700' },
  legal: { fontSize: 11, lineHeight: 16, color: colors.muted, textAlign: 'center' },
  legalLink: { color: colors.navy, fontWeight: '700', textDecorationLine: 'underline' },
});
