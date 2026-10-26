import React, { useState } from 'react';
import { View, Text, Pressable, Share, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { colors, radius } from '../theme';
import { IconButton } from './ui';
import { QrCode } from './QrCode';
import type { IssuedCode } from '../store';

// Kalan süre (saniye); her saniye güncellenir
function useSecondsLeft(expiresAt: string) {
  const left = () => Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000));
  const [s, setS] = useState(left);
  React.useEffect(() => {
    setS(left());
    const t = setInterval(() => setS(left()), 1000);
    return () => clearInterval(t);
  }, [expiresAt]); // eslint-disable-line react-hooks/exhaustive-deps
  return s;
}

// Kod + kalan süre + kopyala/paylaş. Süre bitince kod soluklaşır, "Yeni kod al" çıkar (kodlar 15 dakika geçerli).
// qr verilirse (çocuk giriş kodu) kodun altında QR; süre dolunca QR de kalkar (ortak/sozlesme/akislar.md 2.0).
export function CodeBox({ code, shareText, onRenew, busy, qr }: { code: IssuedCode; shareText: string; onRenew: () => void; busy?: boolean; qr?: string }) {
  const left = useSecondsLeft(code.expiresAt);
  const expired = left <= 0;
  return (
    <View style={{ gap: 8 }}>
      <View style={[styles.codeBox, expired && { opacity: 0.5 }]}>
        <Text style={{ flex: 1, fontSize: 28, fontWeight: '800', letterSpacing: 6, color: colors.navy, textDecorationLine: expired ? 'line-through' : 'none' }}>{code.code}</Text>
        {!expired && (
          <>
            <IconButton name="copy-outline" label="Kopyala" style={{ backgroundColor: '#fff' }}
              onPress={async () => { await Clipboard.setStringAsync(code.code); Alert.alert('Kod kopyalandı'); }} />
            <IconButton name="share-outline" label="Paylaş" style={{ backgroundColor: '#fff' }}
              onPress={() => Share.share({ message: shareText })} />
          </>
        )}
      </View>
      {expired ? (
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.danger }}>Kodun süresi doldu. Kullanmak için yeni kod al.</Text>
          <Pressable style={[styles.cta, busy && { opacity: 0.6 }]} disabled={busy} onPress={onRenew} accessibilityLabel="Yeni kod al">
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Yeni kod al</Text>}
          </Pressable>
        </View>
      ) : (
        <>
          <Text style={styles.cap} accessibilityLabel={`Kalan süre ${Math.floor(left / 60)} dakika ${left % 60} saniye`}>
            Tek kullanımlık · {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')} içinde geçerliliğini yitirir
          </Text>
          {qr && (
            <View style={styles.qrWrap}>
              <QrCode value={qr} size={220} label="Giriş kodunun QR'ı" />
              <Text style={[styles.cap, { textAlign: 'center' }]}>Tabletteki oyunda "QR okut"a dokun ve bu kareyi göster</Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cap: { fontSize: 12, color: colors.muted },
  cta: { height: 52, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  qrWrap: { alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, paddingVertical: 16, paddingHorizontal: 12 },
  codeBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F3F4F8', borderRadius: radius.md, padding: 14 },
});
