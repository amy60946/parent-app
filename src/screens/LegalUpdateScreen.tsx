import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { LegalDoc, isNotice, legalAccept, openLegal } from '../lib/legal';
import { track } from '../lib/track';

// Yeniden onay (hukuk/50 §2): açılışta legal_pending boş değilse. Her onay isteyen metin ayrı kutu (önceden işaretli değil);
// aydınlatma metninde kutu yok ("gösterildi" kaydı). Bu ekrandayken de hesap silme, yasal metinler ve KVKK başvurusu açılır.
export default function LegalUpdateScreen({ navigation, route }: any) {
  const parent: LegalDoc[] = route.params?.parent ?? [];
  const child: LegalDoc[] = route.params?.child ?? [];
  const kids: string = route.params?.kids ?? '';
  const boxes = [...parent, ...child].filter((d) => !isNotice(d.key));
  const [on, setOn] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const all = boxes.every((d) => on[`${d.key}@${d.version}`]);
  const updated = [...parent, ...child].some((d) => !!d.summary);

  const done = async () => {
    setBusy(true);
    try {
      await legalAccept('parent', parent);
      await legalAccept('child', child);
      track('legal.accept', { n: parent.length + child.length });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Kaydedilemedi', (e as Error).message);
    } finally { setBusy(false); }
  };

  const Doc = ({ d, forChild }: { d: LegalDoc; forChild?: boolean }) => {
    const k = `${d.key}@${d.version}`;
    return (
      <View style={styles.card}>
        <Text style={styles.h}>{d.title}</Text>
        {!!d.summary && (
          <View style={{ gap: 4 }}>
            <Text style={styles.cap}>Kısaca ne değişti:</Text>
            <Text style={styles.text}>{d.summary}</Text>
          </View>
        )}
        <Pressable onPress={() => openLegal(d.key, d.version)} hitSlop={6} accessibilityRole="link">
          <Text style={styles.link}>Tam metni oku</Text>
        </Pressable>
        {isNotice(d.key) ? (
          <Text style={styles.cap}>{updated ? 'Aydınlatma metnimizi güncelledik.' : 'Kişisel verilerinin nasıl işlendiğini bu metinde anlatıyoruz.'}</Text>
        ) : (
          <Pressable onPress={() => setOn((p) => ({ ...p, [k]: !p[k] }))} style={styles.row} accessibilityRole="checkbox" accessibilityState={{ checked: !!on[k] }}>
            <Ionicons name={on[k] ? 'checkbox' : 'square-outline'} size={22} color={colors.navy} />
            <Text style={[styles.text, { flex: 1 }]}>
              {forChild ? `Velisi olarak ${d.title} metnini okudum, çocuğum adına kabul ediyorum.` : `${d.title} metnini okudum, kabul ediyorum.`}
            </Text>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
        <View style={styles.icon}><Ionicons name="document-text-outline" size={30} color={colors.navy} /></View>
        <Text style={styles.title} accessibilityRole="header">{updated ? 'Koşullarımız güncellendi' : 'Koşullarımızı onayla'}</Text>
        {parent.map((d) => <Doc key={d.key} d={d} />)}
        {child.length > 0 && (
          <>
            <Text style={[styles.h, { marginTop: 6 }]}>Pofi Adası{kids ? ` · ${kids} adına` : ''}</Text>
            {child.map((d) => <Doc key={d.key} d={d} forChild />)}
          </>
        )}
        <Pressable onPress={done} disabled={!all || busy} style={[styles.cta, (!all || busy) && { opacity: 0.45 }]} accessibilityRole="button">
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Devam et</Text>}
        </Pressable>
        <Text style={[styles.cap, { textAlign: 'center' }]}>
          Kabul etmek istemiyorsan <Text style={styles.link} onPress={() => navigation.navigate('DeleteAccount')}>hesabını silebilir</Text> ya da{' '}
          <Text style={styles.link} onPress={() => navigation.navigate('Kvkk')}>KVKK başvurusu</Text> gönderebilirsin.{' '}
          <Text style={styles.link} onPress={() => navigation.navigate('LegalDocs')}>Yasal metinler</Text>
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  icon: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.today, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginTop: 8 },
  title: { fontSize: 22, fontWeight: '800', color: colors.navy, textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: radius.md, padding: 16, gap: 10 },
  h: { fontSize: 15, fontWeight: '700', color: colors.navy },
  text: { fontSize: 14, lineHeight: 20, color: '#4A5165' },
  cap: { fontSize: 12, lineHeight: 17, color: colors.muted },
  link: { fontSize: 13, color: colors.navy, fontWeight: '700', textDecorationLine: 'underline' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F6F7FB', borderRadius: radius.sm, padding: 10 },
  cta: { height: 52, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
