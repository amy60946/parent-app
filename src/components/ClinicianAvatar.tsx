import React from 'react';
import { View, Text } from 'react-native';
import { colors } from '../theme';

// Acil durum notu (hukuk/50 §9): Uzmanım sekmesinin altında her zaman
export const EMERGENCY_NOTE = "ParentApp bir acil yardım hizmeti değildir. Çocuğunun ya da başka birinin güvenliği tehlikedeyse hemen 112'yi ara.";

// Uzmanın baş harfi (fotoğraf yok; uzman profilinde görsel alanı eklenirse buraya)
export function ClinicianAvatar({ name, size = 44, light }: { name: string; size?: number; light?: boolean }) {
  const letter = name.trim().replace(/^(dr\.?|uzm\.?|psk\.?|prof\.?)\s+/i, '').charAt(0).toLocaleUpperCase('tr-TR') || '?';
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: light ? 'rgba(255,255,255,0.18)' : colors.today, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.42, fontWeight: '800', color: light ? '#fff' : colors.navy }}>{letter}</Text>
    </View>
  );
}
