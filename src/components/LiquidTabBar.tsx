import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo, Animated, Easing, Keyboard, Platform, Pressable, StyleSheet, Text, View,
  type LayoutChangeEvent, type TextStyle, type ViewStyle,
} from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { BottomTabBarHeightCallbackContext, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors } from '../theme';
import { TAB_BAR_GAP, TAB_BAR_HEIGHT, setTabBarCompact, subscribeTabBarCompact } from '../lib/tabBarScroll';

// Yüzen "liquid" sekme çubuğu (kullanıcı isteği 17 Kasım 2026: "instagram gibi liquid menü; ekran kullanımı yapılınca küçülsün
// hafif, kullanım durunca büyüsün"; 19 Kasım 2026: "Liquid Glass gibi, referans videodaki gibi aynı tasarım/renk ile yap.
// Şuanki gibi mavi olmasın"). Ölçüler kullanıcının verdiği Instagram iOS kaydından (60 fps, piksel örneklemesi; Moyo Mercek
// penceresi ölçtü): koyu grafit hap (lacivert değil), ince açık kenar, gölge neredeyse yok; yalnız simge (etiketsiz, iki
// durumda da beyaz; seçili dolu glif; altında küçük beyaz ad, kullanıcı isteği 19 Kasım 2026: "menü isimlerini küçük puntoyla
// geri ekle"); seçili sekmenin arkasında 75 × 50 açık kapsül katı hap gibi kayar. Kaydırma bağlantısı
// src/lib/tabBarScroll.ts; hareketi azalt açıkken ölçek ve kayma yok (renkler aynı). Klavye açıkken gizli. Pencere açmaz.
const WIDTH = '88%';
const MAX_WIDTH = 420;
const INSET = 5;            // kapsülün haptan uzaklığı
const BORDER = 1;
const CAPSULE_W = 75;       // 75 × 50, yarıçap 25
const CAPSULE_H = TAB_BAR_HEIGHT - INSET * 2;
const END_CENTER = 42.5;    // ilk ve son simgenin merkezi hapın uçlarından bu kadar içeride
const COMPACT_SCALE = 0.84;
const PRESS_SCALE = 1.047;
const ICON = '#FFFFFF';
const CAPSULE_REST = 0.17;
const CAPSULE_MOVING = 0.24;

function useReduceMotion() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (live) setOn(v); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v: boolean) => setOn(v));
    return () => { live = false; sub?.remove(); };
  }, []);
  return on;
}

function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => setOpen(e.endCoordinates.height > 0));
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return open;
}

export default function LiquidTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const reduce = useReduceMotion();
  const keyboard = useKeyboardOpen();

  // useBottomTabBarHeight() doğru değeri versin: ekranın altından çubuğun üstüne
  const space = insets.bottom + TAB_BAR_GAP + TAB_BAR_HEIGHT;
  const setHeight = useContext(BottomTabBarHeightCallbackContext);
  useEffect(() => { setHeight?.(space); }, [setHeight, space]);

  // Ölçek: basılıyken 1.047 (~150 ms), bırakınca 1.0 (~200 ms), aşağı kaydırırken 0.84 (~220 ms, taşma yok); yerel sürücüde
  const scale = useRef(new Animated.Value(1)).current;
  const compact = useRef(false);
  const pressed = useRef(false);
  const reduceRef = useRef(reduce);
  reduceRef.current = reduce;
  const settle = useCallback((from: 'press' | 'release' | 'scroll') => {
    if (reduceRef.current) { scale.stopAnimation(); scale.setValue(1); return; }
    const to = pressed.current ? PRESS_SCALE : compact.current ? COMPACT_SCALE : 1;
    const duration = from === 'press' ? 150 : from === 'release' ? 200 : 220;
    Animated.timing(scale, { toValue: to, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [scale]);
  useEffect(() => subscribeTabBarCompact((c) => { compact.current = c; settle('scroll'); }), [settle]);
  useEffect(() => { settle('scroll'); }, [reduce, settle]);
  // Sekme değişince tam boy
  useEffect(() => { setTabBarCompact(false); }, [state.index]);

  // Basılan simge hemen seçili görünür (dolu glif); bırakınca gezinme gerçek seçimi verir
  const [pressedIndex, setPressedIndex] = useState<number | null>(null);
  const pressIn = (i: number) => { pressed.current = true; setPressedIndex(i); settle('press'); };
  const pressOut = () => { pressed.current = false; setPressedIndex(null); settle('release'); };

  // Yerleşim: ilk ve son simgenin merkezi uçlardan 42,5 içeride, arası eşit (koordinatlar kenarlığın içinden)
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => { const w = e.nativeEvent.layout.width; if (Math.abs(w - width) > 0.5) setWidth(w); };
  const n = state.routes.length;
  const step = width > 0 && n > 1 ? (width - END_CENTER * 2) / (n - 1) : 0;
  const centerOf = (i: number) => END_CENTER + i * step - BORDER;
  const hit = Math.max(44, step);

  // Kapsül: katı hap gibi ~270 ms kayar; kayarken biraz açılır (0.24), varınca ~300 ms'de 0.17'ye döner
  const x = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(CAPSULE_REST)).current;
  const placedStep = useRef(0);
  useEffect(() => {
    if (!step) return;
    const to = centerOf(state.index) - CAPSULE_W / 2;
    if (placedStep.current !== step || reduce) { // ilk ölçüm, döndürme ya da hareket azaltma: anında
      x.stopAnimation(); x.setValue(to); glow.setValue(CAPSULE_REST); placedStep.current = step; return;
    }
    glow.setValue(CAPSULE_MOVING);
    Animated.timing(x, { toValue: to, duration: 270, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    Animated.timing(glow, { toValue: CAPSULE_REST, duration: 300, delay: 270, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [state.index, step, reduce, x, glow]);

  // Klavye: çubuk aşağı kayıp kaybolur
  const hide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(hide, { toValue: keyboard ? 1 : 0, duration: reduce ? 0 : 160, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [keyboard, reduce, hide]);

  return (
    <Animated.View
      pointerEvents={keyboard ? 'none' : 'box-none'}
      accessibilityElementsHidden={keyboard}
      importantForAccessibility={keyboard ? 'no-hide-descendants' : 'auto'}
      style={[styles.wrap, {
        bottom: insets.bottom + TAB_BAR_GAP,
        opacity: hide.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
        transform: [{ translateY: hide.interpolate({ inputRange: [0, 1], outputRange: [0, space] }) }],
      }]}
    >
      <Animated.View role="tablist" onLayout={onLayout} style={[styles.pill, glass, { transform: [{ scale }] }]}>
        {step > 0 && (
          <Animated.View pointerEvents="none" style={[styles.capsule, { opacity: glow, transform: [{ translateX: x }] }]} />
        )}
        {step > 0 && state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = index === state.index;
          const shown = pressedIndex !== null ? index === pressedIndex : focused;
          const title = typeof options.tabBarLabel === 'string' ? options.tabBarLabel : options.title ?? route.name;
          const badge = options.tabBarBadge;
          const badgeStyle = StyleSheet.flatten(options.tabBarBadgeStyle) as TextStyle | undefined;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
              data: { behavior: { scrollToTop: focused, popToTop: focused } },
            });
            if (!focused && !event.defaultPrevented) {
              navigation.dispatch({ ...CommonActions.navigate(route.name, route.params), target: state.key });
            }
          };
          const onLongPress = () => { navigation.emit({ type: 'tabLongPress', target: route.key }); };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={onLongPress}
              onPressIn={() => pressIn(index)}
              onPressOut={pressOut}
              style={[styles.tab, { left: centerOf(index) - hit / 2, width: hit }]}
              testID={options.tabBarButtonTestID}
              accessibilityRole={Platform.OS === 'ios' ? 'button' : 'tab'}
              aria-selected={focused}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? title}
              accessibilityValue={badge !== undefined ? { text: String(badge) } : undefined}
              accessibilityLargeContentTitle={title}
              accessibilityShowsLargeContentViewer
            >
              <View>
                {options.tabBarIcon?.({ focused: shown, color: ICON, size: 22 })}
                {badge !== undefined && (
                  <View style={[styles.badge, { backgroundColor: badgeStyle?.backgroundColor ?? colors.gold }]}>
                    <Text style={[styles.badgeText, { color: badgeStyle?.color ?? colors.navy }]} maxFontSizeMultiplier={1} numberOfLines={1}>
                      {typeof badge === 'number' && badge > 99 ? '99+' : badge}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.label, { fontWeight: shown ? '700' : '500' }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                {title}
              </Text>
            </Pressable>
          );
        })}
      </Animated.View>
    </Animated.View>
  );
}

// Koyu grafit cam; gölge neredeyse yok (renkli gölge yok). Web'de arkası hafif bulanık; iOS'ta ek paket gerekmesin diye
// düz yarı saydam (%85 opak olduğu için fark çok az).
const glass: ViewStyle = Platform.OS === 'web'
  ? ({ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', boxShadow: '0 4px 20px rgba(0,0,0,0.10)' } as unknown as ViewStyle)
  : { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20, shadowOffset: { width: 0, height: 4 }, elevation: 4 };

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: {
    width: WIDTH, maxWidth: MAX_WIDTH, height: TAB_BAR_HEIGHT, borderRadius: TAB_BAR_HEIGHT / 2,
    backgroundColor: 'rgba(22,24,27,0.85)', borderWidth: BORDER, borderColor: 'rgba(255,255,255,0.12)',
  },
  capsule: {
    position: 'absolute', left: 0, top: INSET - BORDER, width: CAPSULE_W, height: CAPSULE_H,
    borderRadius: CAPSULE_H / 2, backgroundColor: '#FFFFFF',
  },
  tab: { position: 'absolute', top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { color: ICON, fontSize: 10, lineHeight: 12, letterSpacing: 0.1 }, // küçük punto (kullanıcı, 19 Kasım 2026)
  badge: {
    position: 'absolute', top: -5, left: 14, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#16181B',
  },
  badgeText: { fontSize: 10, lineHeight: 12, fontWeight: '800' },
});
