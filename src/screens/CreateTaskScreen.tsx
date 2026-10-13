import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { DifficultyBadge, IconButton } from '../components/ui';
import { categories, Category } from '../data/templates';
import { useStore } from '../store';

type Filter = 'all' | 'saved' | Category;

export default function CreateTaskScreen({ navigation, route }: any) {
  const date: string | undefined = route.params?.date;
  const { allTemplates, savedIds, toggleSaved } = useStore();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [picked, setPicked] = useState<string[]>([]);

  const list = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    return allTemplates.filter((t) => {
      if (filter === 'saved' && !savedIds.includes(t.id)) return false;
      if (filter !== 'all' && filter !== 'saved' && t.category !== filter) return false;
      return !q || t.title.toLocaleLowerCase('tr').includes(q);
    });
  }, [allTemplates, savedIds, filter, query]);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <IconButton name="chevron-back" label="Geri" onPress={() => navigation.goBack()} />
        <Text style={styles.topTitle}>Görev Oluştur</Text>
        <IconButton name="close" label="Kapat" onPress={() => navigation.goBack()} />
      </View>

      <View style={styles.search}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Şablon ara"
          placeholderTextColor={colors.muted}
          style={{ flex: 1, fontSize: 15, color: colors.navy }}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingVertical: 12 }}>
        <Chip label="Tümü" active={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label="Kaydedilenler" active={filter === 'saved'} onPress={() => setFilter('saved')} />
        {categories.map((c) => (
          <Chip key={c.id} label={`${c.emoji} ${c.label}`} active={filter === c.id} onPress={() => setFilter(c.id)} />
        ))}
      </ScrollView>

      <Text style={styles.hint}>Birden fazla görev seçip tek seferde atayabilirsiniz.</Text>

      <FlatList
        data={list}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 200, gap: 10 }}
        ListEmptyComponent={
          <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 40 }}>
            {filter === 'saved' ? 'Henüz kaydedilen görev yok.' : 'Sonuç bulunamadı.'}
          </Text>
        }
        renderItem={({ item: t }) => {
          const on = picked.includes(t.id);
          const saved = savedIds.includes(t.id);
          return (
            <Pressable onPress={() => toggle(t.id)} style={[styles.card, on && { borderColor: colors.navy }]}>
              <View style={[styles.radio, on && { backgroundColor: colors.navy, borderColor: colors.navy }]}>
                {on && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Text style={{ fontSize: 22 }}>{t.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{t.title}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <DifficultyBadge d={t.difficulty} coins={{ easy: 5, medium: 10, hard: 20 }[t.difficulty]} />
                  <Text style={{ fontSize: 12, color: colors.muted }}>{t.skill}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 }}>
                  <Ionicons name="people-outline" size={14} color={colors.navy} />
                  <Text style={styles.used}>
                    {t.custom ? 'Senin görevin' : `${t.usedBy.toLocaleString('tr-TR')} ebeveyn tarafından kullanıldı`}
                  </Text>
                </View>
              </View>
              <Pressable onPress={() => toggleSaved(t.id)} hitSlop={10} accessibilityLabel="Kaydet">
                <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={20} color={saved ? colors.gold : colors.faint} />
              </Pressable>
            </Pressable>
          );
        }}
      />

      <View style={styles.bottom}>
        {picked.length > 0 && (
          <Pressable
            style={[styles.cta, { marginBottom: 12 }]}
            onPress={() => navigation.navigate('TaskDetails', { templateIds: picked, date })}
          >
            <Text style={styles.ctaText}>Devam · {picked.length} görev</Text>
          </Pressable>
        )}
        <Text style={{ fontSize: 12, color: colors.muted, textAlign: 'center', marginBottom: 8 }}>
          Aradığını bulamadın mı?
        </Text>
        <Pressable
          style={[styles.cta, picked.length > 0 && { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line }]}
          onPress={() => navigation.navigate('TaskDetails', { custom: true, date })}
        >
          <Text style={[styles.ctaText, picked.length > 0 && { color: colors.navy }]}>
            <Text style={{ fontSize: 22, lineHeight: 22 }}>+ </Text>Yeni bir görev oluştur
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && { backgroundColor: colors.navy }]}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: active ? '#fff' : colors.muted }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 4 },
  topTitle: { fontSize: 16, fontWeight: '700', color: colors.navy },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: radius.md, marginHorizontal: 20, marginTop: 14, paddingHorizontal: 14, height: 46 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: '#fff' },
  hint: { fontSize: 12, color: colors.muted, paddingHorizontal: 20 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: radius.md, padding: 14, borderWidth: 1.5, borderColor: 'transparent' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.faint, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.navy },
  used: { fontSize: 13, fontWeight: '600', color: colors.navy },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 28 },
  cta: { height: 52, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
