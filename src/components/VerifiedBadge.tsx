import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { useFlag } from '../clientConfig';

// Uzman belge incelemesi rozeti (ortak/sozlesme/akislar.md 14). Bayrak `clinician_verification` kapalıyken hiçbir şey gösterilmez.
// Rozet "doğrulandı" demez: ekip uzmanın yüklediği belgeyi incelemiştir. Uyarı ve veli beyanı rozet olsa da kalır.
export default function VerifiedBadge({ verifiedAs }: { verifiedAs?: string }) {
  const on = useFlag('clinician_verification');
  if (!on) return null;
  if (!verifiedAs) {
    return <Text style={{ fontSize: 12, color: colors.muted }}>Belgesi incelenmedi</Text>;
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: '#E6F4EA', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}
      accessibilityLabel={`Belgesi incelendi: ${verifiedAs}`}>
      <Ionicons name="shield-checkmark" size={13} color="#2F7D4A" />
      <Text style={{ fontSize: 12, fontWeight: '700', color: '#2F7D4A' }}>Belgesi incelendi: {verifiedAs}</Text>
    </View>
  );
}
