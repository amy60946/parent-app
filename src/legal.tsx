import React, { useCallback, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from './theme';
import { LegalDoc, legalAccept, legalPending } from './lib/legal';
import { LegalTextView } from './components/LegalText';
import { track } from './lib/track';
import { MODAL_GAP } from './lib/modal';
import { genitive } from './lib/tr';

// Veli onayı (hukuk/50 §1.3): Pofi Adası'nı bağlamadan önce (giriş kodu ya da QR gösterilmeden) GameApp koşulları
// veli tarafından çocuk adına kabul edilir; aydınlatma kutusuz satır. Sunucuda işlev yoksa ya da onay güncelse hemen geçer.
// Pencere çağıran ekranın içinde çizilir ({consentUi}): iOS'ta kökten açılan Modal, açık bir modal ekranın (cihaz kur,
// davet) üstünde görünmez.
export function useChildConsent() {
  const [ask, setAsk] = useState<{ name: string; docs: LegalDoc[] } | null>(null);
  const [shown, setShown] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const result = useRef(false);

  const ensureChildConsent = useCallback(async (childName: string) => {
    if (resolver.current) return false; // pencere zaten açık (çift dokunuş)
    let docs: LegalDoc[] | null = null;
    try { docs = await legalPending('child'); } catch { return true; } // ağ hatası kodu engellemesin; bir sonraki seferde sorulur
    if (!docs || docs.length === 0) return true;
    return new Promise<boolean>((resolve) => { resolver.current = resolve; setAsk({ name: childName, docs: docs! }); setShown(true); });
  }, []);

  // Sonuç pencere tamamen kapanınca verilir: ardından açılan pencere (cihaz kurulumu sayfası) kapanışla çakışırsa iOS'ta
  // açılmaz ya da dokunuşlar kilitlenir. onDismiss gelmezse (Android, eski sürüm) süre dolunca.
  const settle = () => {
    const r = resolver.current;
    if (!r) return;
    resolver.current = null;
    setAsk(null);
    r(result.current);
  };
  const finish = (ok: boolean) => {
    result.current = ok;
    setShown(false);
    setTimeout(settle, Platform.OS === 'ios' ? MODAL_GAP + 300 : 0);
  };
  const consentUi = ask ? <ChildConsent visible={shown} name={ask.name} docs={ask.docs} onDone={finish} onDismiss={settle} /> : null;
  return { ensureChildConsent, consentUi };
}

function ChildConsent({ visible, name, docs, onDone, onDismiss }: {
  visible: boolean; name: string; docs: LegalDoc[]; onDone: (ok: boolean) => void; onDismiss: () => void;
}) {
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [doc, setDoc] = useState<string | null>(null); // açık metin: aynı pencerede tam ekran
  const insets = useSafeAreaInsets();
  const accept = async () => {
    setBusy(true);
    try {
      await legalAccept('child', docs);
      track('legal.child_accept', { n: docs.length });
      onDone(true);
    } catch (e) {
      Alert.alert('Kaydedilemedi', (e as Error).message);
    } finally { setBusy(false); }
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onDismiss={onDismiss} onRequestClose={() => (doc ? setDoc(null) : onDone(false))}>
      {doc ? (
        <View style={{ flex: 1, backgroundColor: '#fff', paddingTop: insets.top, paddingBottom: insets.bottom }}>
          <LegalTextView docKey={doc} onClose={() => setDoc(null)} />
        </View>
      ) : (
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.title} accessibilityRole="header">Pofi Adası'nı bağlamadan önce</Text>
          {/* "izleme aracı" = üçüncü taraf reklam/analiz takibi; oyunun aileye raporladığı ilerleme ayrı (hukuk/50 §1.3, 28 Ekim).
              Kısa metin (kullanıcı isteği 28 Ekim 2026); ayrıntı bağlantılı metinlerde. */}
          <Text style={styles.text}>Oyunda reklam, satın alma ve dışarıdan izleme aracı yok. {genitive(name)} ilerlemesini yalnız ailesi, izin verirsen uzmanı görür.</Text>
          <Pressable onPress={() => setOn(!on)} style={styles.row} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
            <Ionicons name={on ? 'checkbox' : 'square-outline'} size={20} color={colors.navy} />
            <Text style={[styles.cap, { flex: 1, color: '#4A5165', fontSize: 13, lineHeight: 19 }]}>
              Velisi olarak <Text style={styles.link} onPress={() => setDoc('kosullar-gameapp')}>Pofi Adası Koşulları</Text>'nı {name} adına kabul ediyorum.{' '}
              <Text style={styles.link} onPress={() => setDoc('aydinlatma-cocuk')}>Aydınlatma</Text>
            </Text>
          </Pressable>
          <Pressable onPress={accept} disabled={!on || busy} style={[styles.cta, (!on || busy) && { opacity: 0.45 }]} accessibilityRole="button">
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Kabul et ve devam et</Text>}
          </Pressable>
          <Pressable onPress={() => onDone(false)} hitSlop={8} accessibilityRole="button"><Text style={styles.cancel}>Vazgeç</Text></Pressable>
        </View>
      </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,27,61,0.45)', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: 18, gap: 12, alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: colors.navy, textAlign: 'center' },
  text: { fontSize: 14, lineHeight: 20, color: '#4A5165', textAlign: 'center' },
  cap: { fontSize: 12, lineHeight: 17, color: colors.muted },
  link: { color: colors.navy, fontWeight: '700', textDecorationLine: 'underline' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch' },
  cta: { alignSelf: 'stretch', height: 50, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cancel: { fontSize: 14, fontWeight: '600', color: colors.navy, paddingVertical: 4 },
});
