import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, radius } from '../theme';
import { useBilling } from '../billing';

// Görevler ve Ben ekranında üyelik durumu: deneme süresi / ücretsiz plan. Üyelerde görünmez.
export default function TrialBanner({ style }: { style?: ViewStyle }) {
  const { access } = useBilling();
  const navigation = useNavigation<any>();
  if (!access || (access.state !== 'trial' && access.state !== 'expired')) return null;
  const expired = access.state === 'expired';
  const text = !expired
    ? `Ücretsiz deneme · ${access.daysLeft ?? 0} gün kaldı`
    : access.enforced ? 'Ücretsiz plandasın' : 'Ücretsiz deneme süresi bitti';
  return (
    <Pressable onPress={() => navigation.navigate('Paywall')} style={[styles.bar, expired && { backgroundColor: '#FFF6DE' }, style]}
      accessibilityLabel={`${text}. Planları gör`}>
      <Ionicons name={expired ? 'lock-open-outline' : 'time-outline'} size={15} color={colors.navy} />
      <Text style={styles.text}>{text}</Text>
      <Text style={styles.link}>{expired ? 'Premium\'a geç ›' : 'Planlar ›'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginTop: 6, marginBottom: 12, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.sm, backgroundColor: colors.today },
  text: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.navy },
  link: { fontSize: 13, fontWeight: '700', color: colors.navy },
});
