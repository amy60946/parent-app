import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Platform, type Insets, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Yüzen sekme çubuğu (src/components/LiquidTabBar.tsx; kullanıcı isteği 18 Kasım 2026, Instagram örneği): ekran kaydırılınca
// çubuk hafifçe küçülür, kaydırma durunca, yukarı kaydırılınca ya da en üstte büyür. Bu dosya sekme ekranlarının kaydırmasını
// çubuğa bağlar ve içeriğin çubuğun altında kalmaması için alt boşluğu verir.
export const TAB_BAR_HEIGHT = 60;
export const TAB_BAR_GAP = 22; // çubuğun altı ile alt güvenli alan arasındaki boşluk
const CONTENT_EXTRA = 16; // son satır çubuğa yapışmasın
const SHRINK_AFTER = 30; // aşağı kaydırma bu kadar noktayı geçince küçül
const IDLE_MS = 700; // son kaydırmadan bu kadar sonra büyü ("kullanım durunca")
const TOP_ZONE = 4; // en üst: hep tam boy

type Listener = (compact: boolean) => void;
let compact = false;
const listeners = new Set<Listener>();
let idle: ReturnType<typeof setTimeout> | undefined;

export function setTabBarCompact(next: boolean) {
  if (!next && idle) { clearTimeout(idle); idle = undefined; }
  if (compact === next) return;
  compact = next;
  listeners.forEach((fn) => fn(next));
}

export function subscribeTabBarCompact(fn: Listener): () => void {
  listeners.add(fn);
  fn(compact);
  return () => { listeners.delete(fn); };
}

function restartIdle() {
  if (idle) clearTimeout(idle);
  idle = setTimeout(() => { idle = undefined; setTabBarCompact(false); }, IDLE_MS);
}

// Ekranın altından çubuğun üst kenarına uzaklık (sağ alttaki yüzen düğmeler bunun üstüne konur)
export function useTabBarSpace() {
  return useSafeAreaInsets().bottom + TAB_BAR_GAP + TAB_BAR_HEIGHT;
}

type ScrollHandler = (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
export type TabBarScrollProps = { onScroll?: ScrollHandler; scrollEventThrottle?: number; scrollIndicatorInsets?: Insets };
export type TabBarScroll = {
  /** Ana dikey ScrollView / FlatList / SectionList'e yayılır: <ScrollView {...bar.scrollProps} /> */
  scrollProps: TabBarScrollProps;
  /** Yalnız kaydırma konumunu veren listeler için (ör. DraggableFlatList onScrollOffsetChange) */
  onOffset: (y: number, max?: number) => void;
  /** İçeriğin alt boşluğu (contentContainerStyle.paddingBottom): çubuk + aralık + alt güvenli alan + biraz */
  contentInsetBottom: number;
  /** Ekranın altından çubuğun üst kenarına uzaklık */
  barSpace: number;
};

// Sekme ekranının ana kaydırma görünümü için. `onScroll` verilirse ikisi birlikte çalışır.
// `enabled: false`: aynı bileşen sekme dışında (yığın ekranında) kullanıldığında çubuğa dokunmaz.
export function useTabBarScroll(opts: { enabled?: boolean; onScroll?: ScrollHandler } = {}): TabBarScroll {
  const { enabled = true } = opts;
  const own = useRef(opts.onScroll);
  own.current = opts.onScroll;
  const navigation = useNavigation();
  const barSpace = useTabBarSpace();
  const st = useRef({ last: 0, anchor: 0, at: 0 });

  // Yeni bir kaydırma görünümü (ör. Aile › Genel → Mesajlar) tam boy çubukla başlar
  useEffect(() => { if (enabled) setTabBarCompact(false); }, [enabled]);

  const onOffset = useCallback((rawY: number, max?: number) => {
    if (!enabled || !navigation.isFocused()) return;
    const s = st.current;
    // iOS esneme (en üstte eksi, en altta fazla) yön değişikliği sayılmaz
    const y = Math.max(0, max === undefined ? rawY : Math.min(rawY, Math.max(0, max)));
    const now = Date.now();
    if (now - s.at > IDLE_MS) s.anchor = s.last; // durup yeniden kaydırınca eşik baştan sayılır
    s.at = now;
    const dy = y - s.last;
    s.last = y;
    if (y <= TOP_ZONE) { s.anchor = y; setTabBarCompact(false); return; }
    if (dy < -1) { s.anchor = y; setTabBarCompact(false); } // yukarı: hemen büyü
    else if (dy > 0 && y - s.anchor > SHRINK_AFTER) setTabBarCompact(true);
    restartIdle();
  }, [enabled, navigation]);

  const onScroll = useCallback<ScrollHandler>((e) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    onOffset(contentOffset.y, contentSize.height - layoutMeasurement.height);
    own.current?.(e);
  }, [onOffset]);

  return useMemo<TabBarScroll>(() => ({
    scrollProps: enabled
      ? {
        onScroll,
        scrollEventThrottle: 16,
        // Kaydırma çizgisi çubuğun altına inmesin (iOS alt güvenli alanı kendisi ekler)
        ...(Platform.OS === 'ios' ? { scrollIndicatorInsets: { bottom: TAB_BAR_HEIGHT + TAB_BAR_GAP } } : null),
      }
      : opts.onScroll ? { onScroll, scrollEventThrottle: 16 } : {},
    onOffset,
    contentInsetBottom: barSpace + CONTENT_EXTRA,
    barSpace,
  }), [enabled, onScroll, onOffset, barSpace, !!opts.onScroll]); // eslint-disable-line react-hooks/exhaustive-deps
}
