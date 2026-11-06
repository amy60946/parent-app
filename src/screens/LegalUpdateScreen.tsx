import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { LegalDoc, isNotice, legalAccept } from '../lib/legal';
import { track } from '../lib/track';

// Yeniden onay (hukuk/50 §2): açılışta legal_pending boş değilse. Kullanıcı isteği 28 Ekim 2026: büyük sayfa yerine küçük
// kart; metin adları tek satırda bağlantı, ayrıntı metinde. Koşullar için tek kutu (önceden işaretli değil); veli olarak
// çocuk adına kabul ayrı kutu; aydınlatma metinlerinde kutu yok ("gösterildi" kaydı). "Kısaca neler değişti?" açılır.
// Hesap silme ve Yasal ve gizlilik (KVKK başvurusu) bu ekrandan da açılır.
export default function LegalUpdateScreen({ navigation, route }: any) {
  const parent: LegalDoc[] = route.params?.parent ?? [];
  const child: LegalDoc[] = route.params?.child ?? [];
  const kids: string = route.params?.kids ?? '';
  const parentBox = parent.filter((d) => !isNotice(d.key));
  const childBox = child.filter((d) => !isNotice(d.key));
  const [okParent, setOkParent] = useState(false);
  const [okChild, setOkChild] = useState(false);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const all = (!parentBox.length || okParent) && (!childBox.length || okChild);
  const summaries = [...parent, ...child].filter((d) => !!d.summary);
  const updated = summaries.length > 0;

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

  const Links = ({ docs }: { docs: LegalDoc[] }) => (
    <>
      {docs.map((d, i) => (
        <Text key={d.key}>
          {i > 0 ? (i === docs.length - 1 ? ' ve ' : ', ') : ''}
          <Text style={styles.link} onPress={() => navigation.navigate('LegalText', { key: d.key, version: d.version })}>{d.title}</Text>
        </Text>
      ))}
    </>
  );
  const notices = [...parent, ...child].filter((d) => isNotice(d.key));

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}>
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name="document-text-outline" size={22} color={colors.navy} />
            <Text style={styles.title} accessibilityRole="header">{updated ? 'Koşullarımız güncellendi' : 'Koşullarımızı onayla'}</Text>
          </View>

          {updated && (
            <View style={{ gap: 6 }}>
              <Pressable onPress={() => setMore(!more)} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} accessibilityRole="button">
                <Text style={styles.small}>Kısaca neler değişti?</Text>
                <Ionicons name={more ? 'chevron-up' : 'chevron-down'} size={14} color={colors.navy} />
              </Pressable>
              {more && summaries.map((d) => (
                <Text key={d.key} style={styles.cap}><Text style={{ fontWeight: '700' }}>{d.title}: </Text>{d.summary}</Text>
              ))}
            </View>
          )}

          {parentBox.length > 0 && (
            <Pressable onPress={() => setOkParent(!okParent)} style={styles.row} accessibilityRole="checkbox" accessibilityState={{ checked: okParent }}>
              <Ionicons name={okParent ? 'checkbox' : 'square-outline'} size={20} color={colors.navy} />
              <Text style={styles.line}><Links docs={parentBox} /> {parentBox.length > 1 ? 'metinlerini' : 'metnini'} kabul ediyorum.</Text>
            </Pressable>
          )}
          {childBox.length > 0 && (
            <Pressable onPress={() => setOkChild(!okChild)} style={styles.row} accessibilityRole="checkbox" accessibilityState={{ checked: okChild }}>
              <Ionicons name={okChild ? 'checkbox' : 'square-outline'} size={20} color={colors.navy} />
              <Text style={styles.line}>Velisi olarak <Links docs={childBox} /> {childBox.length > 1 ? 'metinlerini' : 'metnini'} {kids ? `${kids} adına` : 'çocuğum adına'} kabul ediyorum.</Text>
            </Pressable>
          )}
          {notices.length > 0 && (
            <Text style={styles.cap}>Verilerinin nasıl işlendiği: <Links docs={notices} /></Text>
          )}

          <Pressable onPress={done} disabled={!all || busy} style={[styles.cta, (!all || busy) && { opacity: 0.45 }]} accessibilityRole="button">
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Devam et</Text>}
          </Pressable>
          <Text style={[styles.cap, { textAlign: 'center' }]}>
            Kabul etmek istemiyorsan <Text style={styles.link} onPress={() => navigation.navigate('DeleteAccount')}>hesabını silebilir</Text> ya da{' '}
            <Text style={styles.link} onPress={() => navigation.navigate('LegalDocs')}>KVKK başvurusu</Text> gönderebilirsin.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: 18, gap: 12 },
  title: { fontSize: 18, fontWeight: '800', color: colors.navy, flex: 1 },
  small: { fontSize: 13, fontWeight: '600', color: colors.navy },
  line: { flex: 1, fontSize: 13, lineHeight: 19, color: '#4A5165' },
  cap: { fontSize: 12, lineHeight: 17, color: colors.muted },
  link: { color: colors.navy, fontWeight: '600', textDecorationLine: 'underline' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cta: { height: 50, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
