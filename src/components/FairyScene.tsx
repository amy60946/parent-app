import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect, Circle, Path, G, Ellipse } from 'react-native-svg';

// Masal dünyası arka planı: alacakaranlık gökyüzü, ay, yıldızlar, uzak şato,
// katmanlı tepeler ve tepede parlayan küçük bir fidan. Tamamen vektör; her ekran
// boyutunda keskin görünür, ek görsel dosyası gerekmez.

const W = 390;
const H = 844;

// Sabit "rastgele" yıldızlar (her açılışta aynı yerde dursun)
const stars = Array.from({ length: 70 }, (_, i) => {
  const r = (n: number) => {
    const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  return { x: r(1) * W, y: r(2) * H * 0.55, s: 0.6 + r(3) * 1.6, o: 0.35 + r(4) * 0.65 };
});

const fireflies = [
  { x: 70, y: 600 }, { x: 128, y: 652 }, { x: 300, y: 590 }, { x: 338, y: 668 },
  { x: 214, y: 560 }, { x: 40, y: 700 }, { x: 260, y: 700 },
];

export default function FairyScene() {
  const { width, height } = useWindowDimensions();
  const twinkle = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = (v: Animated.Value, ms: number) =>
      Animated.loop(Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]));
    const a = loop(twinkle, 2200);
    const b = loop(float, 3400);
    a.start(); b.start();
    return () => { a.stop(); b.stop(); };
  }, [twinkle, float]);

  // Ekranı tamamen kapla (kenarlardan taşan kısım kırpılır)
  const scale = Math.max(width / W, height / H);
  const sw = W * scale;
  const sh = H * scale;
  const left = (width - sw) / 2;
  const top = (height - sh) / 2;

  const bright = useMemo(() => stars.filter((_, i) => i % 5 === 0), []);
  const dim = useMemo(() => stars.filter((_, i) => i % 5 !== 0), []);

  const svgBox = { position: 'absolute' as const, left, top, width: sw, height: sh };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg style={svgBox} viewBox={`0 0 ${W} ${H}`}>
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0E0B2E" />
            <Stop offset="0.35" stopColor="#2A1B5C" />
            <Stop offset="0.62" stopColor="#6B3F8E" />
            <Stop offset="0.8" stopColor="#E28B8B" />
            <Stop offset="1" stopColor="#F6C38A" />
          </LinearGradient>
          <RadialGradient id="moonGlow" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#FFF4D6" stopOpacity="0.55" />
            <Stop offset="1" stopColor="#FFF4D6" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="moon" cx="0.4" cy="0.4" r="0.6">
            <Stop offset="0" stopColor="#FFFBEA" />
            <Stop offset="1" stopColor="#F5DFA0" />
          </RadialGradient>
          <RadialGradient id="sprout" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#FFE99A" stopOpacity="0.9" />
            <Stop offset="1" stopColor="#FFE99A" stopOpacity="0" />
          </RadialGradient>
          <LinearGradient id="hill1" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#5B4B8A" />
            <Stop offset="1" stopColor="#3B2F6B" />
          </LinearGradient>
          <LinearGradient id="hill2" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#2F5E6E" />
            <Stop offset="1" stopColor="#1D3D52" />
          </LinearGradient>
          <LinearGradient id="hill3" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#1F4A44" />
            <Stop offset="1" stopColor="#0F2A2E" />
          </LinearGradient>
        </Defs>

        <Rect x="0" y="0" width={W} height={H} fill="url(#sky)" />

        {dim.map((s, i) => (
          <Circle key={i} cx={s.x} cy={s.y} r={s.s * 0.7} fill="#FFFFFF" opacity={s.o * 0.7} />
        ))}

        {/* Ay */}
        <Circle cx="300" cy="225" r="90" fill="url(#moonGlow)" />
        <Circle cx="300" cy="225" r="40" fill="url(#moon)" />
        <Circle cx="288" cy="214" r="6" fill="#EBD08A" opacity="0.5" />
        <Circle cx="310" cy="239" r="9" fill="#EBD08A" opacity="0.4" />
        <Circle cx="315" cy="210" r="3.5" fill="#EBD08A" opacity="0.5" />

        {/* Bulutlar */}
        <G opacity="0.35" fill="#FBE3F0">
          <Ellipse cx="80" cy="250" rx="70" ry="14" />
          <Ellipse cx="120" cy="240" rx="40" ry="14" />
          <Ellipse cx="320" cy="300" rx="80" ry="12" />
          <Ellipse cx="290" cy="292" rx="36" ry="12" />
        </G>

        {/* Uzak şato */}
        <G fill="#3E2B6E" opacity="0.9">
          <Rect x="236" y="430" width="70" height="90" />
          <Rect x="226" y="400" width="20" height="120" />
          <Rect x="296" y="404" width="20" height="116" />
          <Rect x="258" y="380" width="26" height="140" />
          <Path d="M222 402 L236 372 L250 402 Z" />
          <Path d="M292 406 L306 376 L320 406 Z" />
          <Path d="M254 382 L271 340 L288 382 Z" />
          <Rect x="236" y="424" width="70" height="8" />
        </G>
        <G fill="#FFD98A" opacity="0.85">
          <Rect x="267" y="400" width="7" height="11" rx="3.5" />
          <Rect x="232" y="430" width="6" height="9" rx="3" />
          <Rect x="303" y="434" width="6" height="9" rx="3" />
          <Rect x="264" y="470" width="14" height="22" rx="7" />
        </G>

        {/* Tepeler */}
        <Path d="M0 520 C 80 470, 170 500, 240 515 C 300 528, 350 500, 390 490 L390 844 L0 844 Z" fill="url(#hill1)" />
        <Path d="M0 600 C 90 560, 160 580, 230 600 C 300 620, 350 585, 390 575 L390 844 L0 844 Z" fill="url(#hill2)" />

        {/* Ağaçlar */}
        <G fill="#16343F">
          <Path d="M30 600 L48 540 L66 600 Z" />
          <Path d="M52 606 L66 560 L80 606 Z" />
          <Path d="M330 590 L348 528 L366 590 Z" />
          <Path d="M355 596 L368 556 L381 596 Z" />
        </G>

        <Path d="M0 690 C 110 640, 200 650, 270 668 C 330 684, 360 670, 390 662 L390 844 L0 844 Z" fill="url(#hill3)" />

        {/* Tepedeki fidan */}
        <Circle cx="196" cy="640" r="46" fill="url(#sprout)" />
        <Path d="M196 662 C 196 650, 195 640, 196 628" stroke="#7FD18B" strokeWidth="4" strokeLinecap="round" fill="none" />
        <Path d="M196 640 C 184 626, 170 628, 166 634 C 176 642, 188 644, 196 640 Z" fill="#8EE29A" />
        <Path d="M196 632 C 206 616, 222 616, 228 622 C 218 632, 206 636, 196 632 Z" fill="#A6F0AE" />
      </Svg>

      {/* Parlayan yıldızlar */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: twinkle.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) }]}>
        <Svg style={svgBox} viewBox={`0 0 ${W} ${H}`}>
          {bright.map((s, i) => (
            <G key={i}>
              <Circle cx={s.x} cy={s.y} r={s.s + 0.6} fill="#FFFFFF" />
              <Path d={`M${s.x - 5} ${s.y} L${s.x + 5} ${s.y} M${s.x} ${s.y - 5} L${s.x} ${s.y + 5}`} stroke="#FFFFFF" strokeWidth="0.6" opacity="0.7" />
            </G>
          ))}
        </Svg>
      </Animated.View>

      {/* Ateş böcekleri */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: float.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
            transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -10 * scale] }) }],
          },
        ]}
      >
        <Svg style={svgBox} viewBox={`0 0 ${W} ${H}`}>
          {fireflies.map((f, i) => (
            <G key={i}>
              <Circle cx={f.x} cy={f.y} r="7" fill="#FFE99A" opacity="0.25" />
              <Circle cx={f.x} cy={f.y} r="2" fill="#FFF6C8" />
            </G>
          ))}
        </Svg>
      </Animated.View>
    </View>
  );
}
