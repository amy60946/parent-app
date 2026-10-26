import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Switch, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { IconButton } from '../components/ui';
import { useNotifications } from '../notifications';
import { AppNotification, pushEnabled, setPushEnabled } from '../lib/notifications';
import { track } from '../lib/track';

const icon: Record<string, keyof typeof Ionicons.glyphMap> = {
  task_done: 'checkmark-circle-outline', task_declined: 'close-circle-outline', message: 'mail-outline',
  clinic_suggestion: 'medkit-outline', clinic_revoked: 'medkit-outline', device_linked: 'phone-portrait-outline',
  parent_joined: 'person-add-outline', reward_request: 'gift-outline', reward_given: 'gift-outline',
  reward_decided: 'gift-outline', stones_deducted: 'sunny-outline',
};

// Bildirime dokununca ilgili ekran. Gösterilecek bir ekran yoksa hiçbir şey olmaz (false döner):
// yalnız bilgi veren bildirimler (eşin katılması, cihaz bağlanması, paylaşımın kapanması, görevin yapılamaması) ekran değiştirmez.
export function notificationTarget(n: Pick<AppNotification, 'kind' | 'data'>): [string, object?] | null {
  const childId = n.data?.child_id;
  if (n.kind === 'task_done') return ['Tabs', { screen: 'İnceleme' }];
  if (n.kind === 'message' && childId) return ['Chat', { childId }];
  if (n.kind === 'clinic_suggestion') return ['Tabs', { screen: 'Görevler' }];
  if (n.kind === 'reward_request') return ['Rewards', { childId }];
  // Uzmanın takip planı (akislar.md 12): tek paylaşım ya da davetle açılan ilk paylaşım
  const linkId = n.data?.link_id ?? (Array.isArray(n.data?.link_ids) ? n.data.link_ids[0] : undefined);
  if (n.kind === 'care_plan_shared' && linkId) return ['CarePlan', { linkId }];
  return null;
}
export function openNotification(navigation: any, n: Pick<AppNotification, 'kind' | 'data'>) {
  const t = notificationTarget(n);
  if (t) navigation.navigate(...t);
  return !!t;
}

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'şimdi';
  if (m < 60) return `${m} dk`;
  if (m < 1440) return `${Math.round(m / 60)} sa`;
  return `${Math.round(m / 1440)} g`;
};

export default function NotificationsScreen({ navigation }: any) {
  const { items, unread, markRead, remove } = useNotifications();
  const [push, setPush] = useState(true);
  useEffect(() => { pushEnabled().then(setPush); }, []);

  const togglePush = async (on: boolean) => {
    setPush(on);
    const r = await setPushEnabled(on);
    if (on && r === 'denied') {
      setPush(false);
      Alert.alert('İzin gerekli', 'Telefonun Ayarlar > ParentApp > Bildirimler bölümünden izin ver, sonra tekrar aç.');
    }
  };

  // Ekranı olan bildirim: bildirimler kapanır ve o ekran açılır. Olmayan: yalnız okundu sayılır, ekran değişmez.
  const open = (n: AppNotification) => {
    if (!n.readAt) markRead([n.id]);
    if (!notificationTarget(n)) return;
    track('notification.open', { kind: n.kind });
    navigation.goBack();
    openNotification(navigation, n);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <IconButton name="chevron-back" onPress={() => navigation.goBack()} label="Geri" />
        <Text style={styles.title}>Bildirimler</Text>
        <Pressable onPress={() => markRead()} disabled={!unread} hitSlop={8}>
          <Text style={[styles.link, !unread && { color: colors.faint }]}>Tümü okundu</Text>
        </Pressable>
      </View>

      {Platform.OS !== 'web' && (
        <View style={styles.setting}>
          <Ionicons name="notifications-outline" size={20} color={colors.navy} />
          <View style={{ flex: 1 }}>
            <Text style={styles.h}>Telefona bildirim gönder</Text>
            <Text style={styles.cap}>Kapalıyken bildirimler yalnız burada görünür.</Text>
          </View>
          <Switch value={push} onValueChange={togglePush} trackColor={{ true: colors.navy }} />
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={(n) => String(n.id)}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        ListEmptyComponent={<Text style={styles.empty}>Henüz bildirim yok. Çocuğun görev yaptığında, mesaj gönderdiğinde ya da uzmanın görev önerdiğinde burada görünür.</Text>}
        renderItem={({ item: n }) => (
          <Pressable onPress={() => open(n)} onLongPress={() => remove(n.id)} style={[styles.row, !n.readAt && styles.unread]}
            accessibilityHint={notificationTarget(n) ? 'Açmak için dokun. Uzun basınca silinir' : 'Uzun basınca silinir'}>
            <Ionicons name={icon[n.kind] ?? 'notifications-outline'} size={20} color={colors.navy} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.h, !n.readAt && { fontWeight: '700' }]}>{n.title}</Text>
              {!!n.body && <Text style={styles.cap}>{n.body}</Text>}
            </View>
            <Text style={styles.cap}>{ago(n.createdAt)}</Text>
            {!n.readAt && <View style={styles.dot} />}
            {notificationTarget(n) && <Ionicons name="chevron-forward" size={16} color={colors.faint} />}
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  title: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.navy },
  link: { fontSize: 13, fontWeight: '600', color: colors.navy },
  setting: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, padding: 14, borderRadius: radius.md, backgroundColor: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, backgroundColor: '#fff' },
  unread: { backgroundColor: '#EEF1F9' },
  h: { fontSize: 14, fontWeight: '600', color: colors.navy },
  cap: { fontSize: 12, color: colors.muted, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 40, lineHeight: 20, paddingHorizontal: 20 },
});
