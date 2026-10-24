import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppState, Linking, Platform, Pressable, Text, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './lib/supabase';
import { colors, radius } from './theme';

// Uzaktan ayar (ortak/sozlesme/admin.md "Uygulamaların okuması"): client_config('parent') açılışta ve öne gelişte okunur.
// min_version > sürüm → "Güncelleme gerekli", maintenance → bakım ekranı, banner → kapatılabilir duyuru, flags → özellik aç/kapa.
// Okunamazsa (ağ yok, sunucu eski) uygulama normal açılır; hiçbir şey engellenmez.
type Config = { minVersion?: string; maintenance: boolean; banner?: string; flags: Record<string, boolean> };
const empty: Config = { maintenance: false, flags: {} };
const version = Constants.expoConfig?.version ?? '0.0.0';
const DISMISS_KEY = 'banner-dismissed';
// Uygulama mağazaya çıkınca App Store adresi buraya; o zamana kadar TestFlight açılır
const STORE_URL = Platform.OS === 'ios' ? 'itms-beta://' : 'https://play.google.com/store';

// "1.2.3" karşılaştırma: a < b ise negatif
export function compareVersions(a: string, b: string) {
  const pa = a.split('.').map((x) => parseInt(x, 10) || 0);
  const pb = b.split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  return 0;
}

async function fetchConfig(): Promise<Config> {
  const { data, error } = await supabase.rpc('client_config', { p_app: 'parent' });
  if (error || !data) return empty;
  const app = (data as any).app ?? {};
  const flags: Record<string, boolean> = {};
  for (const [k, v] of Object.entries((data as any).flags ?? {})) flags[k] = v === true;
  return {
    minVersion: typeof app.min_version === 'string' ? app.min_version : undefined,
    maintenance: app.maintenance === true,
    banner: typeof app.banner === 'string' && app.banner.trim() ? app.banner.trim() : undefined,
    flags,
  };
}

const Ctx = createContext<Config>(empty);
// Özellik bayrağı: sunucuda tanımlı değilse kapalı
export const useFlag = (key: string) => useContext(Ctx).flags[key] === true;

export function ClientConfigProvider({ children }: { children: React.ReactNode }) {
  const [cfg, setCfg] = useState<Config>(empty);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const load = useCallback(() => { fetchConfig().then(setCfg).catch(() => {}); }, []);
  useEffect(() => {
    load();
    AsyncStorage.getItem(DISMISS_KEY).then(setDismissed).catch(() => {});
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') load(); });
    return () => sub.remove();
  }, [load]);

  if (cfg.maintenance) {
    return <Blocker icon="construct-outline" title="Kısa bir bakım yapıyoruz" body="ParentApp birazdan yeniden açılacak. Verilerin güvende; lütfen biraz sonra tekrar dene." action="Tekrar dene" onAction={load} />;
  }
  if (cfg.minVersion && compareVersions(version, cfg.minVersion) < 0) {
    return <Blocker icon="cloud-download-outline" title="Güncelleme gerekli" body={`Devam etmek için ParentApp'in yeni sürümünü yükle (en az ${cfg.minVersion}; sende ${version}).`} action="Güncelle" onAction={() => Linking.openURL(STORE_URL).catch(() => {})} />;
  }
  const showBanner = !!cfg.banner && cfg.banner !== dismissed;
  return (
    <Ctx.Provider value={cfg}>
      {children}
      {showBanner && <Banner text={cfg.banner!} onClose={() => { setDismissed(cfg.banner!); AsyncStorage.setItem(DISMISS_KEY, cfg.banner!).catch(() => {}); }} />}
    </Ctx.Provider>
  );
}

function Blocker({ icon, title, body, action, onAction }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string; action: string; onAction: () => void }) {
  return (
    <View style={styles.blocker}>
      <View style={styles.blockIcon}><Ionicons name={icon} size={30} color={colors.navy} /></View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <Pressable style={styles.cta} onPress={onAction}><Text style={styles.ctaText}>{action}</Text></Pressable>
    </View>
  );
}

// Üstte kapatılabilir duyuru; aynı metin kapatıldıysa bir daha çıkmaz
function Banner({ text, onClose }: { text: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.banner, { top: insets.top + 6 }]} accessibilityRole="alert">
      <Ionicons name="megaphone-outline" size={18} color={colors.navy} />
      <Text style={{ flex: 1, fontSize: 13, lineHeight: 18, color: colors.navy }}>{text}</Text>
      <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Duyuruyu kapat">
        <Ionicons name="close" size={18} color={colors.navy} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  blocker: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
  blockIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFF6DE', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: colors.navy, textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 22, color: colors.muted, textAlign: 'center', maxWidth: 360 },
  cta: { marginTop: 8, height: 52, minWidth: 200, paddingHorizontal: 24, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  banner: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: '#FFF6DE', borderWidth: 1, borderColor: colors.gold, shadowColor: '#0F1B3D', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
});
