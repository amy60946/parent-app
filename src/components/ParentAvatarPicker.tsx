import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { colors } from '../theme';
import { Avatar } from './ui';
import { parentAvatars, parentAvatarId } from '../data/avatars';

// Ebeveynin oyundaki yüzü: Okti'nin üç anne ve üç baba hâli, üçerli iki satır.
export default function ParentAvatarPicker({ value, onChange, size = 64 }: { value: string; onChange: (id: string) => void; size?: number }) {
  const cur = parentAvatarId(value);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 }}>
      {parentAvatars.map((a) => (
        <Pressable key={a.id} onPress={() => onChange(a.id)} style={{ width: '31%', alignItems: 'center', gap: 4 }}
          accessibilityRole="radio" accessibilityLabel={`Okti, ${a.name}`} accessibilityState={{ selected: cur === a.id }}>
          <Avatar id={a.id} size={size} ring={cur === a.id} />
          <Text style={{ fontSize: 12, color: cur === a.id ? colors.navy : colors.muted, fontWeight: cur === a.id ? '700' : '500' }} numberOfLines={1}>{a.name}</Text>
        </Pressable>
      ))}
    </View>
  );
}
