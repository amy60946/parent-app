import React from 'react';
import { View, Text, Image, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, Difficulty, difficultyMeta } from '../theme';
import { findAvatar } from '../data/avatars';
import { isPhoto, usePhotoUrl } from '../lib/avatarPhoto';

export function Avatar({ id, size = 44, ring = false }: { id: string; size?: number; ring?: boolean }) {
  const a = findAvatar(id);
  const photo = usePhotoUrl(id);
  if (isPhoto(id)) {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: '#EEF0F5',
        borderWidth: ring ? 2 : 0, borderColor: colors.navy }}>
        {photo ? <Image source={{ uri: photo }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : null}
      </View>
    );
  }
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size / 2, backgroundColor: '#EEF0F5',
        alignItems: 'center', justifyContent: 'center',
        borderWidth: ring ? 2 : 0, borderColor: colors.navy,
      }}
    >
      {a.image && a.full ? (
        <Image source={a.image} style={{ width: '100%', height: '100%', borderRadius: size / 2 }} resizeMode="cover" />
      ) : a.image ? (
        <Image source={a.image} style={{ width: size * 0.8, height: size * 0.8 }} resizeMode="contain" />
      ) : (
        <Text style={{ fontSize: size * 0.5 }}>{a.emoji}</Text>
      )}
    </View>
  );
}

export function IconButton({
  name, onPress, size = 20, style, color = colors.navy, label,
}: {
  name: keyof typeof Ionicons.glyphMap; onPress?: () => void; size?: number;
  style?: ViewStyle; color?: string; label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={8}
      style={[{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }, style]}
    >
      <Ionicons name={name} size={size} color={color} />
    </Pressable>
  );
}

export function DifficultyBadge({ d, coins }: { d: Difficulty; coins: number }) {
  const c = d === 'easy' ? colors.easy : d === 'medium' ? colors.medium : colors.hard;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: c.fg }}>
        {difficultyMeta[d].label} · {coins}
      </Text>
      <View style={styles.coin} />
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Segmented<T extends string>({
  options, value, onChange,
}: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.seg}>
      {options.map((o) => (
        <Pressable key={o.id} onPress={() => onChange(o.id)} style={[styles.segItem, value === o.id && styles.segActive]}>
          <Text style={{ fontSize: 13, fontWeight: value === o.id ? '700' : '500', color: value === o.id ? colors.navy : colors.muted }}>
            {o.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      style={{ width: 46, height: 28, borderRadius: 14, backgroundColor: value ? colors.navy : '#D7DAE2', padding: 3, justifyContent: 'center' }}
    >
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignSelf: value ? 'flex-end' : 'flex-start' }} />
    </Pressable>
  );
}

export const Label = ({ children }: { children: string }) => (
  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: 20, marginBottom: 8 }}>
    {children}
  </Text>
);

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  coin: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: 16 },
  seg: { flexDirection: 'row', backgroundColor: '#ECEEF3', borderRadius: radius.sm, padding: 3 },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
  segActive: { backgroundColor: '#fff' },
});
