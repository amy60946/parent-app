import React from 'react';
import { View, Pressable, Image, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { Avatar } from './ui';
import { childAvatars } from '../data/avatars';
import { isPhoto } from '../lib/avatarPhoto';

// Çocuğun avatarı: ebeveynin fotoğraflarından kare kırpılmış bir fotoğraf ya da hazır simge.
// photo: seçilen yerel fotoğraf (kaydedilince yüklenir); avatar: hazır simge ya da kayıtlı fotoğraf ('photo:…').
export type LocalPhoto = { uri: string; mime?: string };

export async function pickChildPhoto(): Promise<LocalPhoto | null> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6 });
  if (r.canceled || !r.assets?.[0]) return null;
  return { uri: r.assets[0].uri, mime: r.assets[0].mimeType ?? undefined };
}

export default function ChildAvatarPicker({ avatar, photo, onAvatar, onPhoto, size = 48 }: {
  avatar: string; photo: LocalPhoto | null; onAvatar: (id: string) => void; onPhoto: (p: LocalPhoto | null) => void; size?: number;
}) {
  const savedPhoto = !photo && isPhoto(avatar);
  const pick = async () => { const p = await pickChildPhoto(); if (p) onPhoto(p); };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      <Pressable onPress={pick} accessibilityRole="button" accessibilityLabel="Fotoğraflarından seç"
        style={[styles.pick, { width: size, height: size, borderRadius: size / 2 }, (photo || savedPhoto) && styles.on]}>
        {photo ? <Image source={{ uri: photo.uri }} style={{ width: '100%', height: '100%' }} />
          : savedPhoto ? <Avatar id={avatar} size={size - 4} />
          : <Ionicons name="image-outline" size={22} color={colors.navy} />}
      </Pressable>
      {childAvatars.map((a) => (
        <Pressable key={a.id} onPress={() => { onAvatar(a.id); onPhoto(null); }} accessibilityLabel={a.name}
          accessibilityState={{ selected: !photo && avatar === a.id }}>
          <Avatar id={a.id} size={size} ring={!photo && avatar === a.id} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pick: { overflow: 'hidden', backgroundColor: '#EEF0F5', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.faint, borderStyle: 'dashed' },
  on: { borderWidth: 2, borderColor: colors.navy, borderStyle: 'solid' },
});
