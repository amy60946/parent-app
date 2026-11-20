import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFlag } from '../clientConfig';

// Uzman belge incelemesi rozeti (ortak/sozlesme/akislar.md 14). Bayrak `clinician_verification` kapalıyken hiçbir şey gösterilmez.
// Rozet yalnız "Uzman diploma belgesini yükledi" der (14 Kasım 2026, ortak hukuk_notlari M; metin hukuk/50): Moyo bir şeyi
// doğruladığını, incelediğini ya da onayladığını söylemez; meslek adı rozette yazılmaz. Uyarı ve veli beyanı rozet olsa da kalır.
// Belge yüklememiş uzmanda hiçbir şey yazılmaz (kullanıcı kararı 20 Kasım 2026, hukuk_notlari "Kullanıcının hukuk kararları" 2).
export default function VerifiedBadge({ verifiedAs }: { verifiedAs?: string }) {
  const on = useFlag('clinician_verification');
  if (!on || !verifiedAs) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: '#E6F4EA', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}
      accessibilityLabel="Uzman diploma belgesini yükledi.">
      <Ionicons name="shield-checkmark" size={13} color="#2F7D4A" />
      <Text style={{ fontSize: 12, fontWeight: '700', color: '#2F7D4A' }}>Uzman diploma belgesini yükledi</Text>
    </View>
  );
}
