import React, { useEffect, useRef } from 'react';
import { View, Text, Image, Animated, Easing, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../theme';

// Açılış ekranı (kullanıcı isteği 28 Ekim 2026: "bizim görsellerimizle, ParentApp olduğu için çocukça olmasın"):
// yerel açılış görseliyle birebir aynı yerleşim (lacivert zemin, filiz + güneş, ParentApp yazısı; assets/splash-icon.png,
// app.json imageWidth 260), geçiş fark edilmesin diye. Yükleme sürerken altta kısa bir söz ve ince ilerleme çizgisi belirir.
const SIZE = 260;

export default function Splash() {
  const fade = useRef(new Animated.Value(0)).current;
  const line = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 500, delay: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    Animated.loop(Animated.timing(line, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.cubic), useNativeDriver: true })).start();
  }, [fade, line]);
  return (
    <View style={styles.root} accessibilityLabel="ParentApp açılıyor">
      <StatusBar style="light" />
      <Image source={require('../../assets/splash-icon.png')} style={{ width: SIZE, height: SIZE }} resizeMode="contain" accessibilityIgnoresInvertColors />
      <Animated.View style={[styles.foot, { opacity: fade }]}>
        <Text style={styles.tagline}>Rutinler kolaylaşsın, evde huzur artsın.</Text>
        <View style={styles.track}>
          <Animated.View style={[styles.bar, { transform: [{ translateX: line.interpolate({ inputRange: [0, 1], outputRange: [-48, 120] }) }] }]} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  foot: { position: 'absolute', bottom: 72, alignItems: 'center', gap: 18 },
  tagline: { fontSize: 14, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.2 },
  track: { width: 120, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  bar: { width: 48, height: 3, borderRadius: 2, backgroundColor: colors.gold },
});
