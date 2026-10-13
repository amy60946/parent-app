import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { Avatar } from '../components/ui';
import { useStore } from '../store';
import { formatTR } from '../dates';

export default function ReviewScreen() {
  const { tasks, children, completions, review } = useStore();
  const [filter, setFilter] = useState<string | 'all'>('all');

  const pending = Object.entries(completions)
    .filter(([, s]) => s === 'pending')
    .map(([key]) => {
      const [taskId, childId, date] = key.split('|');
      return { key, task: tasks.find((t) => t.id === taskId), child: children.find((c) => c.id === childId), date };
    })
    .filter((x) => x.task && x.child && (filter === 'all' || x.child.id === filter));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Pressable onPress={() => setFilter('all')} style={{ alignItems: 'center', gap: 4 }}>
          <View style={[styles.all, filter === 'all' && { borderWidth: 2, borderColor: colors.navy }]}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Tümü</Text>
          </View>
        </Pressable>
        {children.map((c) => (
          <Pressable key={c.id} onPress={() => setFilter(c.id)} style={{ alignItems: 'center', gap: 4, opacity: filter === 'all' || filter === c.id ? 1 : 0.5 }}>
            <Avatar id={c.avatar} size={48} ring={filter === c.id} />
            <Text style={{ fontSize: 11, color: colors.navy, fontWeight: '600' }}>{c.name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.title}>İnceleme</Text>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 10 }}>
        {pending.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ color: colors.muted, textAlign: 'center', fontSize: 13 }}>
              Onay bekleyen görev yok. Çocuğunuz bir görevi tamamladığında burada görünecek.
            </Text>
          </View>
        ) : (
          pending.map((x) => (
            <View key={x.key} style={styles.row}>
              <Avatar id={x.child!.avatar} size={36} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '600', color: colors.navy }}>
                  {x.task!.emoji} {x.task!.title}
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                  {x.child!.name} · {formatTR(x.date)}
                </Text>
              </View>
              <Pressable onPress={() => review(x.key, false)} style={styles.btn} accessibilityLabel="Reddet" hitSlop={6}>
                <Ionicons name="close" size={20} color={colors.danger} />
              </Pressable>
              <Pressable onPress={() => review(x.key, true)} style={[styles.btn, { backgroundColor: colors.navy }]} accessibilityLabel="Onayla" hitSlop={6}>
                <Ionicons name="checkmark" size={20} color="#fff" />
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  all: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '700', color: colors.navy, paddingHorizontal: 20 },
  empty: { backgroundColor: '#fff', borderRadius: radius.lg, padding: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: radius.md, padding: 14 },
  btn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1F2F6', alignItems: 'center', justifyContent: 'center' },
});
