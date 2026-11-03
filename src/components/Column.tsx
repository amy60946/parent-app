import React from 'react';
import { View } from 'react-native';
import { colors } from '../theme';

// iPad ve geniş ekran (kullanıcı isteği 3 Kasım 2026): ekran içeriği ortada en çok COLUMN nokta genişlikte bir sütunda;
// telefonda etkisiz (ekran zaten dar). Ağaç her genişlikte aynı kalır: iPad döndürülünce ekran yeniden kurulmaz, durum kaybolmaz.
// Ana sayfa yatay iPad'de iki sütun kullanır (WIDE_COLUMN). Arka plan, ekranın kendi zemin rengiyle aynı.
export const COLUMN = 720;
export const WIDE_COLUMN = 1100;

export default function Column({ children, max = COLUMN, bg = colors.bg }: { children: React.ReactNode; max?: number; bg?: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: bg, alignItems: 'center' }}>
      <View style={{ flex: 1, width: '100%', maxWidth: max }}>{children}</View>
    </View>
  );
}

// Gezinme düzeni (screenLayout): ekran adına göre sütun genişliği ve zemin; FULL ekranlar tam genişlik (kendi düzenleri var)
const FULL = new Set(['Tabs', 'Welcome']); // Tabs: sekme çubuğu tam genişlik, sekmeler kendi sütununda
const WIDE = new Set(['Ben']);
const BG: Record<string, string> = { Paywall: '#fff', Chat: '#EEF0F5' };
export function columnLayout({ route, children }: { route: { name: string }; children: React.ReactElement }) {
  if (FULL.has(route.name)) return children;
  return <Column max={WIDE.has(route.name) ? WIDE_COLUMN : COLUMN} bg={BG[route.name]}>{children}</Column>;
}
