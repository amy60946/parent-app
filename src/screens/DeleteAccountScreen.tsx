import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { IconButton } from '../components/ui';
import { useStore } from '../store';
import { useAuth } from '../lib/auth';
import { useBilling } from '../billing';
import { useParentTasks, memberName } from '../parentTasks';
import { track } from '../lib/track';

// Hesabımı sil (hukuk/50 §5.1; ortak delete_account()). Etkin App Store aboneliği varsa önce uyarı; ailede tek ebeveynse
// ailenin bütün verisi silinir; başka ebeveyn varsa yalnız bu hesap. Onay: "SİL" yazılır.
export default function DeleteAccountScreen({ navigation }: any) {
  const { isOnlyParent, deleteAccount } = useStore();
  const { signOutLocal } = useAuth();
  const { access } = useBilling();
  const pt = useParentTasks();
  const [only, setOnly] = useState<boolean | null>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { isOnlyParent().then(setOnly).catch(() => setOnly(true)); }, [isOnlyParent]);
  const other = pt.members.find((m) => m.id !== pt.me);
  const subscribed = access?.state === 'premium' && access.autoRenew !== false;
  const ok = typed.trim().toLocaleUpperCase('tr') === 'SİL' && !busy;

  const del = async () => {
    setBusy(true);
    try {
      track('account.delete', { only: !!only });
      await deleteAccount();
      await signOutLocal();
      Alert.alert('Hesabın silindi');
    } catch (e) {
      Alert.alert('Hesap silinemedi', (e as Error).message);
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <IconButton name="chevron-back" label="Geri" onPress={() => navigation.goBack()} />
        <Text style={styles.topTitle}>Hesabımı sil</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        {subscribed && (
          <View style={styles.red}>
            <Text style={[styles.h, { color: colors.danger }]}>Aboneliğin Apple'da devam ediyor.</Text>
            <Text style={styles.text}>Hesabını silmek aboneliği durdurmaz; Apple ücret almaya devam eder. Önce aboneliğini iptal et.</Text>
            <Pressable onPress={() => Linking.openURL('https://apps.apple.com/account/subscriptions')} style={styles.redBtn} accessibilityRole="button">
              <Text style={{ fontWeight: '700', color: colors.danger }}>Aboneliği yönet</Text>
            </Pressable>
          </View>
        )}
        {only === null ? <ActivityIndicator color={colors.navy} /> : only ? (
          <View style={styles.card}>
            <Text style={styles.h}>Hesabını silersen ailen de silinir.</Text>
            <Text style={styles.text}>Ailende başka ebeveyn olmadığı için şunlar kalıcı olarak silinir:</Text>
            {[
              'hesabın ve çocuk profillerin,',
              'görevler, onaylar, ödüller, coin ve Güneş Taşı geçmişi,',
              'mesajlar, fotoğraflar ve sesli mesajlar,',
              'gözlem notları (zor an kayıtları) ve tanışma yanıtları,',
              'uzman paylaşımları (uzmanın erişimi hemen biter) ve uzmanın bu çocuklar için tuttuğu notlar, hedefler ve takip planı,',
              'oyun yedekleri.',
            ].map((t) => (
              <View key={t} style={{ flexDirection: 'row', gap: 8 }}><Text style={styles.text}>•</Text><Text style={[styles.text, { flex: 1 }]}>{t}</Text></View>
            ))}
            <Text style={styles.text}>Çocuğunun cihazındaki Pofi Adası'nın aileyle bağlantısı kapanır.</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.h}>Yalnız senin hesabın silinir.</Text>
            <Text style={styles.text}>Ailende {other ? memberName(other) : 'başka bir ebeveyn'} da var. Aile, çocuklar ve kayıtlar onda kalır.</Text>
          </View>
        )}
        <Text style={styles.cap}>
          Kanunen saklamamız gereken ödeme kayıtları ve ekip işlem kaydı, e-posta adresin çıkarılarak süresi dolana kadar tutulur. Ücretsiz deneme hakkının tekrar kullanılmaması için e-posta adresinin geri çevrilemez bir özeti saklanır.{' '}
          <Text style={styles.link} onPress={() => navigation.navigate('LegalText', { key: 'gizlilik' })}>Ayrıntı</Text>
        </Text>
        <Text style={styles.h}>Bu işlem geri alınamaz. Onaylamak için SİL yaz:</Text>
        <TextInput value={typed} onChangeText={setTyped} autoCapitalize="characters" placeholder="SİL" placeholderTextColor={colors.faint}
          style={styles.input} accessibilityLabel="Onay için SİL yaz" />
        <Pressable onPress={del} disabled={!ok} style={[styles.cta, !ok && { opacity: 0.4 }]} accessibilityRole="button">
          {busy ? <ActivityIndicator color="#fff" /> : (
            <><Ionicons name="trash-outline" size={18} color="#fff" /><Text style={styles.ctaText}>Hesabımı kalıcı olarak sil</Text></>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  topTitle: { fontSize: 16, fontWeight: '700', color: colors.navy },
  card: { backgroundColor: '#fff', borderRadius: radius.md, padding: 16, gap: 8 },
  red: { backgroundColor: '#FDECEC', borderRadius: radius.md, padding: 16, gap: 8, borderWidth: 1, borderColor: '#F3C2C2' },
  redBtn: { alignSelf: 'flex-start', backgroundColor: '#fff', borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 8 },
  h: { fontSize: 15, fontWeight: '700', color: colors.navy },
  text: { fontSize: 14, lineHeight: 20, color: '#4A5165' },
  cap: { fontSize: 12, lineHeight: 17, color: colors.muted },
  link: { color: colors.navy, fontWeight: '700', textDecorationLine: 'underline' },
  input: { letterSpacing: 0, backgroundColor: '#fff', borderRadius: radius.sm, paddingHorizontal: 14, height: 48, fontSize: 16, fontWeight: '700', color: colors.navy, borderWidth: 1, borderColor: colors.line },
  cta: { flexDirection: 'row', gap: 8, height: 52, borderRadius: radius.md, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
