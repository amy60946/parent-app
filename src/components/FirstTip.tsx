import React, { useRef, useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius } from '../theme';
import { Tip } from '../data/rewardTips';
import { afterModal } from '../lib/modal';

const KEY = (k: string) => `tip-${k}`;

// İlk kullanımda ipucu: gate(anahtar, ipucu, işlem) ipucu daha önce görüldüyse işlemi hemen yapar;
// görülmediyse ipucunu gösterir, "Anladım" denince bir daha göstermez ve işleme devam eder.
// Kapatılırsa (geri tuşu / dışına dokunma) işlem yapılmaz, ipucu sonra yine çıkar.
export function useFirstTip() {
  const [tip, setTip] = useState<Tip | null>(null);
  const pending = useRef<{ key: string; run: () => void } | null>(null);

  const gate = async (key: string, t: Tip, run: () => void) => {
    let seen = false;
    try { seen = !!(await AsyncStorage.getItem(KEY(key))); } catch {}
    if (seen) return run();
    pending.current = { key, run };
    setTip(t);
  };

  const accept = () => {
    const p = pending.current;
    pending.current = null;
    setTip(null);
    if (!p) return;
    AsyncStorage.setItem(KEY(p.key), '1').catch(() => {});
    afterModal(p.run); // işlem çoğu kez bir sayfa açar: ipucu penceresi kapanınca
  };
  const dismiss = () => { pending.current = null; setTip(null); };

  const element = (
    <Modal visible={!!tip} transparent animationType="fade" onRequestClose={dismiss}>
      <Pressable style={styles.backdrop} onPress={dismiss} accessibilityLabel="Kapat">
        {tip && (
          <Pressable style={styles.card} onPress={() => {}} accessibilityRole="alert">
            <View style={styles.icon}><Ionicons name={tip.icon} size={24} color={colors.navy} /></View>
            <Text style={styles.title}>{tip.title}</Text>
            <View style={{ gap: 8 }}>
              {tip.lines.map((l) => (
                <View key={l} style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={styles.dot} />
                  <Text style={styles.line}>{l}</Text>
                </View>
              ))}
            </View>
            <Pressable style={styles.cta} onPress={accept}><Text style={styles.ctaText}>{tip.ok}</Text></Pressable>
          </Pressable>
        )}
      </Pressable>
    </Modal>
  );
  return { gate, element };
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,27,61,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: radius.lg, padding: 22, gap: 14 },
  icon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFF6DE', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 19, fontWeight: '800', color: colors.navy },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.gold, marginTop: 8 },
  line: { flex: 1, fontSize: 15, lineHeight: 21, color: colors.navy },
  cta: { height: 52, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
