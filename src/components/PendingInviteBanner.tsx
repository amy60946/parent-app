import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { colors, radius } from '../theme';
import { PendingInvite, pendingInvites } from '../lib/clinic';

// Uzmanın bekleyen daveti (akislar.md 10 adım 6): ebeveyn davet ekranını kapattıysa Görevler'in üstünde hatırlatılır.
// Eski sunucuda liste boş döner, hiçbir şey görünmez.
export default function PendingInviteBanner() {
  const navigation = useNavigation<any>();
  const [invite, setInvite] = useState<PendingInvite | undefined>();
  useFocusEffect(useCallback(() => {
    let live = true;
    pendingInvites().then((l) => { if (live) setInvite(l[0]); }).catch(() => {});
    return () => { live = false; };
  }, []));
  if (!invite) return null;
  const who = invite.clinician || invite.clinic || 'Uzmanın';
  return (
    <Pressable onPress={() => navigation.navigate('Invite', { invite })} accessibilityRole="button"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, marginBottom: 10, backgroundColor: '#FFF6DE', borderRadius: radius.md,
        padding: 14, borderWidth: 1, borderColor: '#F3DFA2' }}>
      <Ionicons name="mail-unread-outline" size={20} color={colors.navy} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.navy }}>{who} seni bekliyor</Text>
        <Text style={{ fontSize: 12, color: '#6B5300' }}>
          {invite.childName ? `${invite.childName} için bilgileri kontrol et ve paylaş` : 'Çocuğunu seç ve paylaş'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.navy} />
    </Pressable>
  );
}
