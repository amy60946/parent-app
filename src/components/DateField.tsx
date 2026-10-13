import React, { useState } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { formatTR, fromISO, toISO } from '../dates';

type Props = {
  mode: 'date' | 'time';
  value?: string; // date: ISO, time: HH:MM
  onChange: (v: string | undefined) => void;
  placeholder: string;
  clearable?: boolean;
};

const box = {
  backgroundColor: '#fff', borderRadius: radius.md, paddingHorizontal: 14, minHeight: 48,
  flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const,
};

export default function DateField({ mode, value, onChange, placeholder, clearable }: Props) {
  const [show, setShow] = useState(false);

  const toDate = (): Date => {
    if (!value) return new Date();
    if (mode === 'date') return fromISO(value);
    const [h, m] = value.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  };
  const fromDate = (d: Date) =>
    mode === 'date'
      ? toISO(d)
      : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  const label = value ? (mode === 'date' ? formatTR(value) : value) : placeholder;

  return (
    <View style={box}>
      <Pressable style={{ flex: 1, paddingVertical: 14 }} onPress={() => setShow(true)}>
        <Text style={{ fontSize: 15, color: value ? colors.navy : colors.muted }}>{label}</Text>
      </Pressable>
      {clearable && !!value && (
        <Pressable onPress={() => onChange(undefined)} hitSlop={10} accessibilityLabel="Temizle">
          <Ionicons name="close-circle" size={20} color={colors.faint} />
        </Pressable>
      )}
      {!value && <Ionicons name={mode === 'date' ? 'calendar-outline' : 'time-outline'} size={18} color={colors.muted} />}
      {show && (
        <DateTimePicker
          value={toDate()}
          mode={mode}
          is24Hour
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(e, d) => {
            if (Platform.OS === 'android') setShow(false);
            if (e.type === 'set' && d) onChange(fromDate(d));
            if (Platform.OS === 'ios' && d) onChange(fromDate(d));
          }}
        />
      )}
    </View>
  );
}
