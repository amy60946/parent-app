import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { IconButton } from '../components/ui';
import { LegalDoc, legalDocs } from '../lib/legal';
import { formatTR, toISO } from '../dates';

// Aile › Hesap › Yasal ve gizlilik (hukuk/50 §3–4; kullanıcı isteği 28 Ekim 2026: bütün hukuki içerik tek başlık altında):
// ParentApp ve Pofi Adası metinleri (legal_documents_for), onay tarihi; "Verdiğin izinler": uzman paylaşımı ve önceki
// uzman kayıtları (Uzmanım'da); KVKK başvurusu ve başvurularım. Sağlık yanıtları satırı kaldırıldı: tanışmada sağlık sorusu
// yok (14 Kasım 2026, ortak hukuk_notlari M).
export default function LegalDocsScreen({ navigation }: any) {
  const [docs, setDocs] = useState<LegalDoc[] | null | undefined>();

  const load = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([legalDocs('parent'), legalDocs('child')]);
      if (p === null) { setDocs(null); return; }
      const seen = new Set<string>();
      setDocs([...p, ...(c ?? [])].filter((d) => (seen.has(d.key) ? false : (seen.add(d.key), true))));
    } catch { setDocs([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <IconButton name="chevron-back" label="Geri" onPress={() => navigation.goBack()} />
        <Text style={styles.topTitle}>Yasal ve gizlilik</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
        {docs === undefined ? <ActivityIndicator color={colors.navy} /> : docs === null ? (
          <Text style={styles.cap}>Metinler sunucu güncellenince burada listelenecek.</Text>
        ) : (
          <View style={styles.list}>
            {docs.map((d, i) => (
              <Pressable key={d.key} onPress={() => navigation.navigate('LegalText', { key: d.key, version: d.version })} style={[styles.row, i > 0 && styles.sep]} accessibilityRole="link">
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.h}>{d.title}</Text>
                  <Text style={styles.cap}>
                    {d.version}{d.status === 'draft' ? ' · taslak' : ''}
                    {d.requires_acceptance && d.accepted_at ? ` · Onayladın: ${formatTR(toISO(new Date(d.accepted_at)))}` : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        )}

        <Text style={[styles.h, { marginTop: 6 }]}>Verdiğin izinler</Text>
        <Text style={styles.cap}>Bu izinler isteğe bağlıdır. Geri aldığında uygulamayı kullanmaya devam edersin; ilgili paylaşım hemen durur.</Text>
        <View style={styles.list}>
          <Pressable onPress={() => navigation.navigate('Tabs', { screen: 'Uzmanım' })} style={styles.row} accessibilityRole="button">
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.h}>Uzman paylaşımı ve önceki uzman kayıtları</Text>
              <Text style={styles.cap}>Uzmanım sekmesinde görür, durdurur ya da kapatırsın</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          </Pressable>
        </View>
        <Pressable onPress={() => navigation.navigate('Kvkk')} style={styles.kvkk} accessibilityRole="button">
          <Ionicons name="shield-outline" size={18} color={colors.navy} />
          <Text style={[styles.h, { flex: 1 }]}>KVKK başvurusu ve başvurularım</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  topTitle: { fontSize: 16, fontWeight: '700', color: colors.navy },
  list: { backgroundColor: '#fff', borderRadius: radius.md, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  h: { fontSize: 15, fontWeight: '600', color: colors.navy },
  cap: { fontSize: 12, lineHeight: 17, color: colors.muted },
  kvkk: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: radius.md, padding: 14 },
});
