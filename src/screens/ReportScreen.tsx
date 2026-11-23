import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors, radius } from '../theme';
import { IconButton } from '../components/ui';
import { COLUMN } from '../components/Column';
import { Report, ReportSection, familyReport } from '../lib/reports';
import { errorText } from '../lib/errors';
import { formatTR, toISO } from '../dates';

// Uzmandan gelen rapor, uygulama içi sayfa (kullanıcı kararı 23 Kasım 2026; içerik şeması v1, ortak öneri 20261123100000).
// Telefonda büyük yazı; tablo dar ekranda satır kartlarına dönüşür (her satır: sütun adı · değer). İlk açılışta "görüldü" yazılır.
export const reportPeriod = (start: string | null | undefined, end: string | null | undefined) =>
  start && end ? (start === end ? formatTR(start) : `${formatTR(start)} – ${formatTR(end)}`) : '';
export const reportDate = (createdAt: string) => formatTR(toISO(new Date(createdAt)));

export default function ReportScreen({ navigation, route }: any) {
  const id: string | undefined = route.params?.reportId;
  const [report, setReport] = useState<Report | null | undefined>(undefined);
  const [error, setError] = useState('');
  const wide = Math.min(useWindowDimensions().width, COLUMN) >= 600; // sütun genişliği (iPad'de en çok 720)

  const load = useCallback(() => {
    if (!id) { setReport(null); setError('Rapor bulunamadı.'); return; }
    setError('');
    familyReport(id).then(setReport).catch((e) => { setReport(null); setError(errorText(e, 'Rapor açılamadı. Biraz sonra tekrar dene.')); });
  }, [id]);
  useFocusEffect(load);

  const c = report?.content;
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}><IconButton name="chevron-back" label="Geri" onPress={() => navigation.goBack()} /></View>
      <ScrollView contentContainerStyle={styles.pad}>
        {report === undefined && <ActivityIndicator color={colors.navy} style={{ marginTop: 40 }} />}
        {!!error && (
          <View style={{ gap: 12, alignItems: 'flex-start' }}>
            <Text style={styles.body}>{error}</Text>
            {!!id && <Pressable onPress={load} style={styles.retry} accessibilityRole="button"><Text style={styles.retryText}>Tekrar dene</Text></Pressable>}
          </View>
        )}
        {report && (
          <>
            <View style={{ gap: 6 }}>
              <Text style={styles.title} accessibilityRole="header">{report.title}</Text>
              <Text style={styles.meta}>
                {[c?.childName || report.childName, reportPeriod(c?.period?.start ?? report.periodStart, c?.period?.end ?? report.periodEnd)].filter(Boolean).join(' · ')}
              </Text>
              <Text style={styles.meta}>{[report.clinicianName, reportDate(report.createdAt)].filter(Boolean).join(' · ')}</Text>
            </View>
            {!c || c.v !== 1 ? (
              <Text style={styles.body}>Bu rapor Moyo'nun yeni bir sürümünde açılabiliyor. Uygulamayı güncelleyip yeniden dene.</Text>
            ) : (
              <>
                {c.sections.map((s, i) => <Section key={i} s={s} wide={wide} />)}
                {!!c.footer && <Text style={styles.footer}>{c.footer}</Text>}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ s, wide }: { s: ReportSection; wide: boolean }) {
  return (
    <View style={styles.card}>
      {!!s.title && <Text style={styles.h} accessibilityRole="header">{s.title}</Text>}
      {s.type === 'text' && s.body.split(/\n{2,}/).map((p, i) => <Text key={i} style={styles.body}>{p.trim()}</Text>)}
      {s.type === 'kv' && s.rows.map(([k, v], i) => (
        <View key={i} style={[styles.kv, i > 0 && styles.sep]}>
          <Text style={styles.label}>{k}</Text>
          <Text style={styles.value}>{v}</Text>
        </View>
      ))}
      {s.type === 'list' && s.items.map((it, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
          <Text style={styles.body} accessibilityElementsHidden importantForAccessibility="no">•</Text>
          <Text style={[styles.body, { flex: 1 }]}>{it}</Text>
        </View>
      ))}
      {s.type === 'table' && (wide ? <Table s={s} /> : s.rows.map((r, i) => (
        // Dar ekranda her satır bir kart: ilk sütun başlık, ötekiler "sütun adı · değer"
        <View key={i} style={[styles.rowCard, i > 0 && { marginTop: 8 }]}>
          <Text style={styles.value}>{r[0] ?? ''}</Text>
          {r.slice(1).map((cell, j) => (
            <View key={j} style={styles.cellLine}>
              <Text style={styles.cellLabel}>{s.columns[j + 1] ?? ''}</Text>
              <Text style={[styles.bodySmall, { flexShrink: 1, textAlign: 'right' }]}>{cell}</Text>
            </View>
          ))}
        </View>
      )))}
    </View>
  );
}

function Table({ s }: { s: Extract<ReportSection, { type: 'table' }> }) {
  return (
    <View style={styles.table}>
      <View style={[styles.tr, styles.thRow]}>
        {s.columns.map((col, i) => <Text key={i} style={[styles.th, { flex: i === 0 ? 1.4 : 1 }]}>{col}</Text>)}
      </View>
      {s.rows.map((r, i) => (
        <View key={i} style={[styles.tr, i > 0 && styles.sep]}>
          {s.columns.map((_, j) => <Text key={j} style={[styles.td, { flex: j === 0 ? 1.4 : 1 }, j === 0 && { fontWeight: '600' }]}>{r[j] ?? ''}</Text>)}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 12, paddingVertical: 8 },
  pad: { padding: 20, paddingTop: 4, gap: 16, paddingBottom: 48 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '800', color: colors.navy },
  meta: { fontSize: 14, color: colors.muted },
  card: { backgroundColor: '#fff', borderRadius: radius.md, padding: 16, gap: 10 },
  h: { fontSize: 18, fontWeight: '700', color: colors.navy },
  body: { fontSize: 17, lineHeight: 25, color: colors.navy },
  bodySmall: { fontSize: 16, lineHeight: 22, color: colors.navy },
  label: { fontSize: 14, color: colors.muted },
  value: { fontSize: 17, lineHeight: 24, fontWeight: '600', color: colors.navy },
  kv: { gap: 2, paddingTop: 10 },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  rowCard: { backgroundColor: colors.bg, borderRadius: radius.md, padding: 12, gap: 6 },
  cellLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  cellLabel: { fontSize: 15, color: '#5A6178' }, // satır kartında sütun adı: açık zeminde okunur gri
  table: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: radius.md, overflow: 'hidden' },
  tr: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, gap: 10 },
  thRow: { backgroundColor: colors.bg },
  th: { fontSize: 13, fontWeight: '700', color: colors.muted },
  td: { fontSize: 16, lineHeight: 22, color: colors.navy },
  footer: { fontSize: 13, lineHeight: 19, color: colors.muted, textAlign: 'center' },
  retry: { backgroundColor: colors.navy, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 10 },
  retryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
