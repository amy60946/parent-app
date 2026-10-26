import React, { useState } from 'react';
import { Modal, Pressable, Text, View, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';

// "i" düğmesi: uzun açıklama ekranda yazılmaz, ilgili başlığın/eylemin yanındaki i'ye dokununca açılır.
// Ekranda yalnız çok önemli bilgi kısa cümleyle kalır; ayrıntısı burada.
export default function Info({ title, text, children, size = 18, color = colors.muted }: {
  title: string; text?: string; children?: React.ReactNode; size?: number; color?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Bilgi: ${title}`}>
        <Ionicons name="information-circle-outline" size={size} color={color} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Kapat">
          <Pressable style={styles.card} onPress={() => {}}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="information-circle" size={22} color={colors.navy} />
              <Text style={styles.title} accessibilityRole="header">{title}</Text>
            </View>
            <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 8 }}>
              {!!text && <Text style={styles.text}>{text}</Text>}
              {children}
            </ScrollView>
            <Pressable onPress={() => setOpen(false)} style={styles.ok} accessibilityRole="button">
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Tamam</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// Başlık + i yan yana (en sık kullanım)
export function InfoTitle({ title, info, infoTitle, style }: { title: string; info: string; infoTitle?: string; style?: object }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Text style={style}>{title}</Text>
      <Info title={infoTitle ?? title} text={info} />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,27,61,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: radius.lg, padding: 20, gap: 12 },
  title: { flex: 1, fontSize: 17, fontWeight: '800', color: colors.navy },
  text: { fontSize: 14, lineHeight: 21, color: colors.navy },
  ok: { height: 46, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
});
