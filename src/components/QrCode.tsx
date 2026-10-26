import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import qrcode from 'qrcode-generator';

// Kare QR: orta düzey hata düzeltme (M), çevresinde 4 modül beyaz kenar payı.
// Çizim tek Path: her satırdaki ardışık koyu modüller tek dikdörtgen (ince boşluk çizgisi kalmasın).
export function QrCode({ value, size = 220, label }: { value: string; size?: number; label?: string }) {
  const { count, d } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    let path = '';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!qr.isDark(r, c)) continue;
        let w = 1;
        while (c + w < n && qr.isDark(r, c + w)) w++;
        path += `M${c + 4} ${r + 4}h${w}v1h-${w}z`;
        c += w - 1;
      }
    }
    return { count: n + 8, d: path };
  }, [value]);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${count} ${count}`}>
        <Rect x={0} y={0} width={count} height={count} fill="#fff" />
        <Path d={d} fill="#000" />
      </Svg>
    </View>
  );
}
