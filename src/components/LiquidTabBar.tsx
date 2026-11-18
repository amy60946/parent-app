import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo, Animated, Easing, Keyboard, Platform, Pressable, StyleSheet, Text, View,
  type LayoutChangeEvent, type TextStyle, type ViewStyle,
} from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { BottomTabBarHeightCallbackContext, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors } from '../theme';
import { TAB_BAR_GAP, TAB_BAR_HEIGHT, setTabBarCompact, subscribeTabBarCompact } from '../lib/tabBarScroll';

// Yüzen "liquid" sekme çubuğu (kullanıcı isteği 18 Kasım 2026: "instagram gibi liquid menü; ekran kullanımı yapılınca küçülsün
// hafif, kullanım durunca büyüsün"). Ölçüler Instagram iOS ekran kaydından: kenardan kenara değil, ortada yuvarlak hap
// (genişliğin %88'i, iPad'de en çok 420), alt güvenli alanın 22 nokta üstünde, koyu yarı saydam zemin. Seçili sekmenin
// arkasında tek açık kapsül sekmeler arasında kayar. Kaydırma bağlantısı src/lib/tabBarScroll.ts; hareketi azalt açıkken
// ölçek ve kayma yok. Klavye açıkken çubuk gizlenir. Pencere (Modal) açmaz.
const WIDTH = '88%';
const MAX_WIDTH = 420;
const INSET = 5; // kapsülün haptan uzaklığı
const COMPACT_SCALE = 0.84;
const PRESS_SCALE = 1.045;
const ACTIVE = '#fff';
const INACTIVE = 'rgba(255,255,255,0.72)';

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

  // Ölçek: basılıyken 1.045, kaydırırken 0.84, yoksa 1 (yerel sürücüde)
  const scale = useRef(new Animated.Value(1)).current;
  const compact = useRef(false);
  const pressed = useRef(false);
  const reduceRef = useRef(reduce);
  reduceRef.current = reduce;
  const settle = useCallback(() => {
    if (reduceRef.current) { scale.stopAnimation(); scale.setValue(1); return; }
    if (pressed.current) {
      Animated.timing(scale, { toValue: PRESS_SCALE, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    } else {
      Animated.spring(scale, { toValue: compact.current ? COMPACT_SCALE : 1, stiffness: 300, damping: 24, mass: 1, useNativeDriver: true }).start();
    }
  }, [scale]);
  useEffect(() => subscribeTabBarCompact((c) => { compact.current = c; settle(); }), [settle]);
  useEffect(() => { settle(); }, [reduce, settle]);
  // Sekme değişince tam boy
  useEffect(() => { setTabBarCompact(false); }, [state.index]);
  const pressIn = useCallback(() => { pressed.current = true; settle(); }, [settle]);
  const pressOut = useCallback(() => { pressed.current = false; settle(); }, [settle]);

  // Kapsül: seçili sekmenin arkasında, sekme değişince ~230 ms kayar
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => { const w = e.nativeEvent.layout.width; if (Math.abs(w - width) > 0.5) setWidth(w); };
  const slot = width > 0 ? (width - INSET * 2 - 2) / state.routes.length : 0; // -2: 1 nokta kenarlık iki yanda
  const x = useRef(new Animated.Value(0)).current;
  const placedSlot = useRef(0);
  useEffect(() => {
    if (!slot) return;
    const to = state.index * slot;
    if (placedSlot.current !== slot || reduce) { x.stopAnimation(); x.setValue(to); placedSlot.current = slot; return; } // ilk ölçüm, döndürme
    Animated.timing(x, { toValue: to, duration: 230, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [state.index, slot, reduce, x]);

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
        {slot > 0 && (
          <Animated.View pointerEvents="none" style={[styles.capsule, { width: slot, transform: [{ translateX: x }] }]} />
        )}
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = index === state.index;
          const color = focused ? options.tabBarActiveTintColor ?? ACTIVE : options.tabBarInactiveTintColor ?? INACTIVE;
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
              onPressIn={pressIn}
              onPressOut={pressOut}
              style={styles.tab}
              testID={options.tabBarButtonTestID}
              accessibilityRole={Platform.OS === 'ios' ? 'button' : 'tab'}
              aria-selected={focused}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? title}
              accessibilityValue={badge !== undefined ? { text: String(badge) } : undefined}
              accessibilityLargeContentTitle={title}
              accessibilityShowsLargeContentViewer
            >
              <View>
                {options.tabBarIcon?.({ focused, color, size: 22 })}
                {badge !== undefined && (
                  <View style={[styles.badge, { backgroundColor: badgeStyle?.backgroundColor ?? colors.gold }]}>
                    <Text style={[styles.badgeText, { color: badgeStyle?.color ?? colors.navy }]} maxFontSizeMultiplier={1} numberOfLines={1}>
                      {typeof badge === 'number' && badge > 99 ? '99+' : badge}
                    </Text>
                  </View>
                )}
              </View>
              {typeof options.tabBarLabel === 'function'
                ? options.tabBarLabel({ focused, color, position: 'below-icon', children: title })
                : (
                  <Text style={[styles.label, { color, fontWeight: focused ? '700' : '600' }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                    {title}
                  </Text>
                )}
            </Pressable>
          );
        })}
      </Animated.View>
    </Animated.View>
  );
}

// Yarı saydam koyu cam; web'de arkası bulanık (yalnız tarayıcıda; iOS'ta ek paket gerekmesin diye düz yarı saydam)
const glass: ViewStyle = Platform.OS === 'web'
  ? ({ backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', boxShadow: '0 8px 24px rgba(15,27,61,0.28)' } as unknown as ViewStyle)
  : { shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 12 };

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: {
    width: WIDTH, maxWidth: MAX_WIDTH, height: TAB_BAR_HEIGHT, borderRadius: TAB_BAR_HEIGHT / 2,
    flexDirection: 'row', alignItems: 'stretch', paddingHorizontal: INSET, paddingVertical: INSET,
    backgroundColor: 'rgba(15,27,61,0.86)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  capsule: {
    position: 'absolute', left: INSET, top: INSET - 1, bottom: INSET - 1,
    borderRadius: (TAB_BAR_HEIGHT - INSET * 2) / 2, backgroundColor: 'rgba(255,255,255,0.16)',
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { fontSize: 10, lineHeight: 13, letterSpacing: 0.1 },
  badge: {
    position: 'absolute', top: -5, left: 14, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.navy,
  },
  badgeText: { fontSize: 10, lineHeight: 12, fontWeight: '800' },
});
