import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Sheet from './Sheet';
import { colors, radius } from '../theme';
import { track } from '../lib/track';
import { COUNTRIES, Country, sendPhoneCode, smsUnavailable, toE164, validLocal, verifyPhoneCode } from '../lib/phone';

// Uzman bağlandıktan sonra telefon numarası (iki yönlü doğrulama): numara → 6 haneli SMS kodu → hesaba yazılır.
// "Şimdilik geç" her adımda. Bayrak `parent_sms_verify` kapalıyken çağıran bu adımı hiç göstermez (lib/phone.ts).
export default function PhoneStep({ onDone }: { onDone: (verified: boolean) => void }) {
  const [country, setCountry] = useState<Country>(COUNTRIES[0]);
  const [pick, setPick] = useState(false);
  const [local, setLocal] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const send = async () => {
    if (!validLocal(country.dial, local)) return setError(country.code === 'TR' ? 'Numarayı 5 ile başlayan 10 hane olarak yaz.' : 'Numarayı kontrol et.');
    const phone = toE164(country.dial, local);
    setBusy(true);
    setError(undefined);
    try {
      await sendPhoneCode(phone);
      track('phone.code_sent');
      setSentTo(phone);
    } catch (e) {
      if (smsUnavailable(e)) {
        Alert.alert('Telefon doğrulaması şu an açık değil', 'Bu adımı şimdilik geçiyoruz; numaranı sonra ekleyebilirsin.', [{ text: 'Tamam', onPress: () => onDone(false) }]);
      } else setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const verify = async () => {
    if (!sentTo || token.length !== 6) return setError('6 haneli kodu yaz.');
    setBusy(true);
    setError(undefined);
    try {
      await verifyPhoneCode(sentTo, token);
      track('phone.verified');
      onDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 14 }}>
      <View style={styles.art}><Ionicons name="chatbubble-ellipses-outline" size={34} color={colors.navy} /></View>
      <Text style={styles.title} accessibilityRole="header">{sentTo ? 'Kodu yaz' : 'Telefon numaranı ekle'}</Text>
      <Text style={styles.text}>
        {sentTo
          ? `+${sentTo} numarasına 6 haneli bir kod gönderdik.`
          : 'Uzmanının hatırlatmaları ve evde uygulama ipuçları kısa mesajla da gelebilsin. Numaran uzmana gösterilmez.'}
      </Text>

      {!sentTo ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={() => setPick(true)} style={styles.dial} accessibilityRole="button" accessibilityLabel={`Ülke kodu +${country.dial}, değiştir`}>
            <Text style={styles.dialText}>+{country.dial}</Text>
            <Ionicons name="chevron-down" size={14} color={colors.navy} />
          </Pressable>
          <TextInput value={local} onChangeText={(v) => { setLocal(v.replace(/[^\d ]/g, '').slice(0, 16)); setError(undefined); }}
            placeholder={country.code === 'TR' ? '5xx xxx xx xx' : 'Numara'} placeholderTextColor={colors.faint} keyboardType="phone-pad"
            textContentType="telephoneNumber" autoComplete="tel" style={[styles.input, { flex: 1, minWidth: 0 }]} accessibilityLabel="Telefon numarası" />
        </View>
      ) : (
        <TextInput value={token} onChangeText={(v) => { setToken(v.replace(/\D/g, '').slice(0, 6)); setError(undefined); }} placeholder="______"
          placeholderTextColor={colors.faint} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="sms-otp" autoFocus
          style={[styles.input, styles.code]} accessibilityLabel="Doğrulama kodu" />
      )}
      {!!error && <Text style={{ fontSize: 13, color: colors.danger }}>{error}</Text>}

      <View style={styles.note}>
        <Text style={styles.cap}>
          Numaran yalnız doğrulama ve bu kısa mesajlar için kullanılır; reklam gönderilmez.
        </Text>
      </View>

      <Pressable onPress={sentTo ? verify : send} disabled={busy} style={[styles.cta, busy && { opacity: 0.6 }]} accessibilityRole="button">
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>{sentTo ? 'Doğrula' : 'Kod gönder'}</Text>}
      </Pressable>
      {sentTo && (
        <Pressable onPress={() => { setSentTo(null); setToken(''); }} hitSlop={8} style={{ alignSelf: 'center' }} accessibilityRole="button">
          <Text style={styles.link}>Numarayı değiştir ya da yeni kod iste</Text>
        </Pressable>
      )}
      <Pressable onPress={() => { track('phone.skip'); onDone(false); }} hitSlop={8} style={{ alignSelf: 'center', paddingVertical: 4 }} accessibilityRole="button">
        <Text style={styles.link}>Şimdilik geç</Text>
      </Pressable>

      <Sheet visible={pick} title="Ülke kodu" onClose={() => setPick(false)}>
        {COUNTRIES.map((c, i) => (
          <Pressable key={c.code} onPress={() => { setCountry(c); setPick(false); }} style={[styles.countryRow, i > 0 && styles.sep]}
            accessibilityRole="button" accessibilityState={{ selected: c.code === country.code }}>
            <Text style={[styles.dialText, { flex: 1 }]}>{c.name}</Text>
            <Text style={styles.cap}>+{c.dial}</Text>
            {c.code === country.code && <Ionicons name="checkmark" size={18} color={colors.navy} />}
          </Pressable>
        ))}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  art: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.today, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: colors.navy, textAlign: 'center' },
  text: { fontSize: 14, lineHeight: 20, color: '#4A5165', textAlign: 'center' },
  cap: { fontSize: 12, lineHeight: 17, color: colors.muted },
  dial: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, height: 50, borderRadius: radius.sm, backgroundColor: '#F3F4F8' },
  dialText: { fontSize: 16, fontWeight: '700', color: colors.navy },
  input: { height: 50, borderRadius: radius.sm, backgroundColor: '#F3F4F8', paddingHorizontal: 14, fontSize: 17, color: colors.navy },
  code: { textAlign: 'center', fontSize: 26, fontWeight: '800', letterSpacing: 10 },
  note: { backgroundColor: '#F7F8FB', borderRadius: radius.sm, padding: 12 },
  cta: { height: 52, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  link: { fontSize: 14, fontWeight: '700', color: colors.navy },
  countryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
});
