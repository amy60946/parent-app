import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme';
import { useNotifications } from '../notifications';

// Bütün sekmelerin sağ üstündeki zil: okunmamış sayısı + Bildirimler ekranı
export default function NotificationBell() {
  const navigation = useNavigation<any>();
  const { unread } = useNotifications();
  return (
    <Pressable onPress={() => navigation.navigate('Notifications')} hitSlop={10}
      accessibilityLabel={unread ? `Bildirimler, ${unread} okunmamış` : 'Bildirimler'}>
      <Ionicons name={unread ? 'notifications' : 'notifications-outline'} size={22} color={colors.navy} />
      {unread > 0 && (
        <View style={styles.badge}><Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text></View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: { position: 'absolute', top: -6, right: -8, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 10, fontWeight: '800', color: colors.navy },
});
