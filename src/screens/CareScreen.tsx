import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Share, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Info from '../components/Info';
import VerifiedBadge from '../components/VerifiedBadge';
import { colors, radius } from '../theme';
import { useStore } from '../store';
import { useCare, groupClinicians } from '../lib/care';
import { TELL_CLINICIAN } from '../data/clinicTexts';

// Uzmanım sekmesi (kullanıcı isteği 28 Ekim 2026, Joon "Care" örneğinden; yapay zekâ asistanı şimdilik yok):
// bağlı uzmanlar (uzman başına; paylaşılan çocuklarla) → uzman sayfası, bekleyen davetler, "Uzman bağla".
export default function CareScreen({ navigation }: any) {
  const { children, familyId } = useStore();
  const { care } = useCare(familyId);
  const clinicians = groupClinicians(care?.links ?? []);
  const childName = (id: string) => children.find((c) => c.id === id)?.name ?? '';
  const tell = () => Share.share({ message: TELL_CLINICIAN }).catch(() => {});

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
            {care.invites.map((inv) => (
              <Pressable key={inv.code} onPress={() => navigation.navigate('Invite', { invite: inv })} style={styles.invite} accessibilityRole="button"
                accessibilityLabel={`${inv.clinician || inv.clinic} seni bekliyor`}>
                <Ionicons name="mail-unread-outline" size={20} color={colors.navy} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.h}>{inv.clinician || inv.clinic} seni bekliyor</Text>
                  <Text style={styles.cap}>{inv.childName ? `${inv.childName} için bilgileri kontrol et ve paylaş` : 'Çocuğunu seç ve paylaş'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.navy} />
              </Pressable>
            ))}

            <View style={styles.card}>
              {clinicians.map((c, i) => {
                const sug = care.suggestions.filter((s) => c.links.some((l) => l.linkId === s.linkId)).length;
                const todo = care.todos.filter((t) => !t.doneToday && c.links.some((l) => l.linkId === t.linkId)).length;
                return (
                  <Pressable key={c.clinicId} onPress={() => navigation.navigate('Clinician', { clinicId: c.clinicId })}
                    style={[styles.row, i > 0 && styles.sep]} accessibilityRole="button" accessibilityLabel={`${c.name}, uzman sayfası`}>
                    <ClinicianAvatar name={c.name} />
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={styles.rowTitle}>{c.name}</Text>
                      <Text style={styles.cap} numberOfLines={1}>{[c.title, c.clinic !== c.name ? c.clinic : ''].filter(Boolean).join(' · ') || 'Uzman'}</Text>
                      <Text style={styles.cap} numberOfLines={1}>{c.links.map((l) => childName(l.childId)).filter(Boolean).join(', ')} ile paylaşılıyor</Text>
                      <VerifiedBadge verifiedAs={c.verifiedAs} />
                    </View>
                    {sug + todo > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{sug + todo}</Text></View>}
                    <Ionicons name="chevron-forward" size={16} color={colors.faint} />
                  </Pressable>
                );
              })}
              <Pressable onPress={() => navigation.navigate('Invite')} style={[styles.row, clinicians.length > 0 && styles.sep]} accessibilityRole="button">
                <View style={styles.plus}><Ionicons name="add" size={20} color={colors.navy} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>Uzman bağla</Text>
                  <Text style={styles.cap}>Uzmanından aldığın kodla</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.faint} />
              </Pressable>
            </View>

            {clinicians.length === 0 && (
              <View style={styles.tip}>
                <Text style={styles.h}>Uzmanın ParentApp'i bilmiyor mu?</Text>
                <Text style={styles.text}>Çocuğunla çalışan uzman ClinicApp'te hesap açıp sana bir davet kodu gönderebilir. Kısa bir mesajla anlat.</Text>
                <Pressable onPress={tell} style={styles.tipBtn} accessibilityRole="button">
                  <Ionicons name="share-outline" size={16} color={colors.navy} />
                  <Text style={styles.tipBtnText}>Uzmanına anlat</Text>
                </Pressable>
              </View>
            )}
          </>
        )}

        {/* Acil durum notu (hukuk/50 §9) */}
        <Text style={styles.foot}>ParentApp bir acil yardım hizmeti değildir. Çocuğunun ya da başka birinin güvenliği tehlikedeyse hemen 112'yi ara.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// Uzmanın baş harfi (fotoğraf yok; uzman profilinde görsel alanı eklenirse buraya)
export function ClinicianAvatar({ name, size = 44, light }: { name: string; size?: number; light?: boolean }) {
  const letter = name.trim().replace(/^(dr\.?|uzm\.?|psk\.?|prof\.?)\s+/i, '').charAt(0).toLocaleUpperCase('tr-TR') || '?';
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: light ? 'rgba(255,255,255,0.18)' : colors.today, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.42, fontWeight: '800', color: light ? '#fff' : colors.navy }}>{letter}</Text>
    </View>
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
  invite: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF6DE', borderRadius: radius.md, padding: 14, borderWidth: 1, borderColor: '#F3DFA2' },
  tip: { backgroundColor: '#FFF4D6', borderRadius: radius.lg, padding: 16, gap: 8 },
  tipBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 14, height: 40, borderRadius: radius.pill, backgroundColor: '#fff' },
  tipBtnText: { fontSize: 14, fontWeight: '700', color: colors.navy },
  foot: { fontSize: 11, lineHeight: 16, color: colors.muted, textAlign: 'center' },
});
