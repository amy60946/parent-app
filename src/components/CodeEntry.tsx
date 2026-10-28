import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, radius } from '../theme';
import { useStore } from '../store';
import { AppError, hintOf } from '../lib/errors';
import { PendingInvite, inviteErrorTitle, openInvite } from '../lib/clinic';
import { track } from '../lib/track';
import { GUEST_CODE, redeemGuestPass } from '../lib/guestPass';

// Tek kod kutusu (kullanıcı kararı 26 Ekim 2026, "B"): ebeveyn kodun türünü bilmek zorunda değil.
// 8 karakter: başka bir ailenin hediye ettiği 30 günlük misafir kartı (akislar.md 19). 6 karakter: önce uzman daveti
// (ClinicApp) denenir; değilse eşin aile kodu (join_family).
export type CodeResult = { kind: 'invite'; invite: PendingInvite } | { kind: 'accepted'; invite: PendingInvite } | { kind: 'family' }
  | { kind: 'guest'; trialEndsAt: string };

const NOT_FOUND = 'Kod bulunamadı. Harfleri kontrol et ya da uzmanından/eşinden yeni kod iste.';
const ask = (title: string, body: string, ok: string) => new Promise<boolean>((res) =>
  Alert.alert(title, body, [{ text: 'Vazgeç', style: 'cancel', onPress: () => res(false) }, { text: ok, style: 'destructive', onPress: () => res(true) }]));

export function useRedeemCode() {
  const { joinFamily, isOnlyParent, children, tasks } = useStore();
  return useCallback(async (code: string): Promise<CodeResult | null> => {
    if (GUEST_CODE.test(code)) return { kind: 'guest', trialEndsAt: await redeemGuestPass(code) };
    // 1) Uzman daveti
    try {
      const r = await openInvite(code);
      if (r.kind === 'pending') return { kind: 'invite', invite: r.invite };
      if (r.kind === 'done') return { kind: 'accepted', invite: r.invite };
      // eski sunucu (uzman daveti işlevi yok): aile koduna geç
    } catch (e) {
      if (hintOf(e) !== 'not_found') throw e;
    }
    // 2) Eşin aile kodu: bu ailede veri varsa ve tek ebeveynse önce sor (yeni aileye geçince eski aile silinir)
    let loses = false;
    try { loses = (children.length > 0 || tasks.length > 0) && (await isOnlyParent()); } catch { /* sunucu yine kontrol eder */ }
    if (loses && !(await ask('Mevcut aileden ayrılınsın mı?', 'Yeni aileye katılınca şu anki ailendeki çocuklar, görevler ve mesajlar silinir.', 'Katıl'))) return null;
    try {
      await joinFamily(code);
    } catch (e) {
      if (hintOf(e) === 'not_found') throw new AppError(NOT_FOUND, 'not_found');
      throw e;
    }
    return { kind: 'family' };
  }, [joinFamily, isOnlyParent, children.length, tasks.length]);
}

// Kod kutusu + Devam. Hata kutunun altında yazılır (ekran değişmez, ebeveyn aynı yerde düzeltir).
export default function CodeEntry({ onResult, autoFocus }: { onResult: (r: CodeResult) => void; autoFocus?: boolean }) {
  const redeem = useRedeemCode();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const submit = async () => {
    if (code.length !== 6 && code.length !== 8) return setError('Kod 6 (hediye kartında 8) karakter olmalı.');
    setBusy(true);
    setError(undefined);
    try {
      const r = await redeem(code);
      if (!r) return;
      track('code.redeem', { kind: r.kind });
      setCode('');
      onResult(r);
    } catch (e) {
      const hint = hintOf(e);
      setError(hint === 'accepted' ? `${inviteErrorTitle(hint)}.` : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: 10 }}>
      <TextInput
        value={code}
        onChangeText={(v) => { setCode(v.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8)); setError(undefined); }}
        placeholder="KOD"
        placeholderTextColor={colors.faint}
        autoCapitalize="characters"
        autoCorrect={false}
        autoFocus={autoFocus}
        onSubmitEditing={submit}
        accessibilityLabel="Kod"
        style={[styles.input, !!error && { borderColor: colors.danger }]}
      />
      {!!error && <Text style={{ fontSize: 13, color: colors.danger }}>{error}</Text>}
      <Pressable style={[styles.cta, (busy || (code.length !== 6 && code.length !== 8)) && { opacity: 0.5 }]} disabled={busy} onPress={submit} accessibilityRole="button">
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Devam</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  input: { backgroundColor: '#F3F4F8', borderRadius: radius.sm, borderWidth: 1.5, borderColor: 'transparent', paddingVertical: 14,
    fontSize: 26, fontWeight: '800', letterSpacing: 8, textAlign: 'center', color: colors.navy },
  cta: { height: 52, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
