import React from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';

// Ortada kısa bilgi kartı: simge, başlık, bir-iki cümle, ana eylem ve isteğe bağlı ikinci bağlantı.
// Bildirim izni ön sorusu ve ilk onay kutlaması için (kullanıcı isteği 27 Ekim 2026).
export default function Dialog({ visible, icon, badge, title, text, primary, onPrimary, secondary, onSecondary }: {
  visible: boolean; icon: keyof typeof Ionicons.glyphMap; badge?: keyof typeof Ionicons.glyphMap;
  title: string; text: string; primary: string; onPrimary: () => void; secondary?: string; onSecondary?: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onSecondary ?? onPrimary}>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          <View style={styles.art}>
            <Ionicons name={icon} size={46} color={colors.navy} />
            {badge && (
              <View style={styles.badge}><Ionicons name={badge} size={16} color="#fff" /></View>
            )}
          </View>
          <Text style={styles.title} accessibilityRole="header">{title}</Text>
          <Text style={styles.text}>{text}</Text>
          <Pressable onPress={onPrimary} style={styles.cta} accessibilityRole="button">
            <Text style={styles.ctaText}>{primary}</Text>
          </Pressable>
          {secondary && onSecondary && (
            <Pressable onPress={onSecondary} hitSlop={8} accessibilityRole="button" style={{ paddingVertical: 6 }}>
              <Text style={styles.link}>{secondary}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,27,61,0.45)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: 22, gap: 12, alignItems: 'center' },
  art: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.today, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  badge: { position: 'absolute', top: 6, right: 6, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  title: { fontSize: 19, fontWeight: '800', color: colors.navy, textAlign: 'center' },
  text: { fontSize: 14, color: '#4A5165', textAlign: 'center', lineHeight: 20 },
  cta: { alignSelf: 'stretch', height: 50, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  link: { fontSize: 14, fontWeight: '600', color: colors.navy },
});
