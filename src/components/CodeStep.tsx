import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import Info from './Info';
import CodeEntry, { CodeResult } from './CodeEntry';
import { track } from '../lib/track';

// Kayıttan hemen sonra tek ekran: "Kodun var mı?" (Life360 düzeni; kullanıcı kararı 26 Ekim 2026, "B").
// Uzman kodu → davet ekranı, eşin kodu → aileye katılım, kod yok → ilk kullanım rehberi.
export default function CodeStep({ visible, onResult, onSkip }: {
  visible: boolean; onResult: (r: CodeResult) => void; onSkip: () => void;
}) {
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onSkip}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.body}>
            <View style={styles.icon}><Ionicons name="key-outline" size={30} color={colors.navy} /></View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.title} accessibilityRole="header">Kodun var mı?</Text>
              <Info title="Hangi kod?" text={'Uzmanın ClinicApp\'ten ya da eşin ParentApp\'ten 6 haneli bir kod gönderdiyse buraya yaz. Uygulama kodun kimden geldiğini kendisi anlar:\n\n• Uzman kodu: uzmanın davet ekranı açılır, onaylarsan çocuğunun görevleri onunla paylaşılır.\n• Eşinin kodu: aynı aileye katılırsın, çocuklar ve görevler ortak olur.\n\nKodun yoksa devam et; sonra Aile › Hesap › Kod gir bölümünden de yazabilirsin.'} />
            </View>
            <Text style={styles.sub}>Uzmanından ya da eşinden aldığın 6 haneli kod</Text>
            <View style={{ alignSelf: 'stretch', marginTop: 8 }}>
              <CodeEntry onResult={onResult} />
            </View>
          </View>
          <Pressable onPress={() => { track('code.skip'); onSkip(); }} style={styles.skip} accessibilityRole="button">
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.navy }}>Kodum yok, devam</Text>
          </Pressable>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 8 },
  icon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.today, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  title: { fontSize: 26, fontWeight: '800', color: colors.navy },
  sub: { fontSize: 15, color: '#4A5165', textAlign: 'center' },
  skip: { marginHorizontal: 24, marginBottom: 16, height: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
});
