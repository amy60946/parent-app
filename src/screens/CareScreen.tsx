import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Share, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Info from '../components/Info';
import { colors, radius } from '../theme';
import { useStore } from '../store';
import { useCare, groupClinicians } from '../lib/care';
import { TELL_CLINICIAN } from '../data/clinicTexts';
import { ClinicianView } from './ClinicianScreen';
import { ClinicianAvatar } from '../components/ClinicianAvatar';

// Uzmanım sekmesi (kullanıcı isteği 28 Ekim 2026, Joon "Care" örneğinden; yapay zekâ asistanı şimdilik yok).
// 3 Kasım 2026 (kullanıcı isteği): uzman bağlıysa sekme doğrudan uzmanın sayfasıyla açılır (program, öneriler, bugün
// yapılacaklar); sağ üstte "Uzman bağla". Birden çok uzmanda üstte uzman seçici. Uzman yoksa: bekleyen davetler,
// "Uzman bağla" ve "Uzmanına anlat". Ana sayfadan { clinicId } ile gelinirse o uzman seçilir.
export default function CareScreen({ navigation, route }: any) {
  const { familyId } = useStore();
  const state = useCare(familyId);
  const { care } = state;
  const clinicians = groupClinicians(care?.links ?? []);
  const tell = () => Share.share({ message: TELL_CLINICIAN }).catch(() => {});
  const [sel, setSel] = useState<string | undefined>();
  const asked: string | undefined = route?.params?.clinicId;
  useEffect(() => {
    if (!asked) return;
    setSel(asked);
    navigation.setParams({ clinicId: undefined });
  }, [asked]); // eslint-disable-line react-hooks/exhaustive-deps

  const invites = (care?.invites ?? []).map((inv) => (
    <Pressable key={inv.code} onPress={() => navigation.navigate('Invite', { invite: inv })} style={styles.invite} accessibilityRole="button"
      accessibilityLabel={`${inv.clinician || inv.clinic} seni bekliyor`}>
      <Ionicons name="mail-unread-outline" size={20} color={colors.navy} />
      <View style={{ flex: 1 }}>
        <Text style={styles.h}>{inv.clinician || inv.clinic} seni bekliyor</Text>
        <Text style={styles.cap}>{inv.childName ? `${inv.childName} için bilgileri kontrol et ve paylaş` : 'Çocuğunu seç ve paylaş'}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.navy} />
    </Pressable>
  ));

  if (care && clinicians.length) {
    const cur = clinicians.find((c) => c.clinicId === sel) ?? clinicians[0];
    const count = (c: (typeof clinicians)[number]) =>
      care.suggestions.filter((s) => c.links.some((l) => l.linkId === s.linkId)).length
      + care.todos.filter((t) => !t.doneToday && c.links.some((l) => l.linkId === t.linkId)).length;
    const top = (
      <>
        {clinicians.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {clinicians.map((c) => {
              const on = c.clinicId === cur.clinicId;
              const n = count(c);
              return (
                <Pressable key={c.clinicId} onPress={() => setSel(c.clinicId)} style={[styles.pick, on && styles.pickOn]}
                  accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${c.name}${n ? `, ${n} bekleyen` : ''}`}>
                  <ClinicianAvatar name={c.name} size={26} light={on} />
                  <Text style={[styles.pickText, on && { color: '#fff' }]} numberOfLines={1}>{c.name}</Text>
                  {n > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{n}</Text></View>}
                </Pressable>
              );
            })}
          </ScrollView>
        )}
        {invites}
      </>
    );
    return <ClinicianView navigation={navigation} clinicId={cur.clinicId} {...state} tab={{ top, onConnect: () => navigation.navigate('Invite') }} />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.title} accessibilityRole="header">Uzmanım</Text>
          <Info title="Uzmanım" text={'Çocuğunla çalışan bir uzman (psikolog, ergoterapist, özel eğitim öğretmeni…) varsa görev ilerlemesini ve davranış kayıtlarını onunla paylaşabilirsin. Uzmanın sana bir davet bağlantısı ya da kod gönderir.\n\nPaylaşım yalnız senin onayınla başlar, çocuk çocuk seçilir ve istediğin an durur. Uzmanın verdiği program ve görev önerileri burada görünür.'} />
        </View>

        {care === null ? <ActivityIndicator color={colors.navy} style={{ marginTop: 30 }} /> : (
          <>
            {/* Uzmanın daveti bağlandı ama çocuk henüz paylaşılmadı (akislar.md 10 adım 6) */}
            {invites}

            <View style={styles.card}>
              <Pressable onPress={() => navigation.navigate('Invite')} style={styles.row} accessibilityRole="button">
                <View style={styles.plus}><Ionicons name="add" size={20} color={colors.navy} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>Uzman bağla</Text>
                  <Text style={styles.cap}>Uzmanından aldığın kodla</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.faint} />
              </Pressable>
            </View>

            <View style={styles.tip}>
              <Text style={styles.h}>Uzmanın ParentApp'i bilmiyor mu?</Text>
              <Text style={styles.text}>Çocuğunla çalışan uzman ClinicApp'te hesap açıp sana bir davet kodu gönderebilir. Kısa bir mesajla anlat.</Text>
              <Pressable onPress={tell} style={styles.tipBtn} accessibilityRole="button">
                <Ionicons name="share-outline" size={16} color={colors.navy} />
                <Text style={styles.tipBtnText}>Uzmanına anlat</Text>
              </Pressable>
            </View>
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 26, fontWeight: '800', color: colors.navy },
  h: { fontSize: 15, fontWeight: '700', color: colors.navy },
  cap: { fontSize: 12, lineHeight: 16, color: colors.muted },
  text: { fontSize: 14, lineHeight: 20, color: '#4A5165' },
  card: { backgroundColor: '#fff', borderRadius: radius.md, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  rowTitle: { fontSize: 16, fontWeight: '700', color: colors.navy },
  plus: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: colors.line, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 12, fontWeight: '800', color: colors.navy },
  pick: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 240, height: 40, paddingLeft: 7, paddingRight: 12, borderRadius: radius.pill, backgroundColor: '#fff' },
  pickOn: { backgroundColor: colors.navy },
  pickText: { flexShrink: 1, fontSize: 14, fontWeight: '700', color: colors.navy },
  invite: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF6DE', borderRadius: radius.md, padding: 14, borderWidth: 1, borderColor: '#F3DFA2' },
  tip: { backgroundColor: '#FFF4D6', borderRadius: radius.lg, padding: 16, gap: 8 },
  tipBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 14, height: 40, borderRadius: radius.pill, backgroundColor: '#fff' },
  tipBtnText: { fontSize: 14, fontWeight: '700', color: colors.navy },
});
