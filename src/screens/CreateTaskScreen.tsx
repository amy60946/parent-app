import React, { useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, ScrollView, StyleSheet, LayoutAnimation, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { DifficultyBadge, IconButton } from '../components/ui';
import { categories, Category, TemplateAge, templateAges, categoryLabel, skillLabel } from '../data/templates';
import { useStore } from '../store';
import { routines, routineTasks } from '../data/routines';

// Akıllı öneri (smart recommendation) sonra eklenecek: ortak/DURUM.md hatırlatıcı
type Filter = 'all' | 'saved' | 'popular' | Category;

const POPULAR_COUNT = 20;

export default function CreateTaskScreen({ navigation, route }: any) {
  const date: string | undefined = route.params?.date;
  const { allTemplates, savedIds, toggleSaved } = useStore();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [age, setAge] = useState<TemplateAge | 'all'>('all');
  const [menu, setMenu] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const isCategory = filter !== 'all' && filter !== 'saved' && filter !== 'popular';
  const showAges = filter === 'all' || isCategory;

  const list = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    const found = allTemplates.filter((t) => {
      if (filter === 'saved' && !savedIds.includes(t.id)) return false;
      // Bir görev birden çok kategoride çıkabilir (categories etiketleri)
      if (isCategory && !t.categories.includes(filter as Category)) return false;
      if (showAges && age !== 'all' && t.ages && !t.ages.includes(age)) return false;
      return !q || t.title.toLocaleLowerCase('tr').includes(q);
    });
    // Katalog sırası (kendi görevlerin önce); Önerilenler: katalogdaki ilk 20
    // Kategoride: ana kategorisi o olanlar önce, etiketle gelenler sonra
    const main = (t: (typeof found)[number]) => (isCategory && t.category !== filter ? 1 : 0);
    const sorted = [...found].sort((a, b) => main(a) - main(b) || a.sort - b.sort);
    if (filter === 'popular') return sorted.filter((t) => !t.custom).slice(0, POPULAR_COUNT);
    return sorted;
  }, [allTemplates, savedIds, filter, isCategory, showAges, age, query]);

  const options: { id: Filter; label: string; icon?: keyof typeof Ionicons.glyphMap }[] = [
    { id: 'all', label: 'Tüm görevler', icon: 'apps-outline' },
    { id: 'popular', label: 'Önerilenler', icon: 'sparkles-outline' },
    { id: 'saved', label: 'Kaydedilenler', icon: 'bookmark-outline' },
    ...categories.map((c) => ({ id: c.id as Filter, label: c.label })),
  ];
  const current = options.find((o) => o.id === filter)!;
  const choose = (f: Filter) => { setFilter(f); setAge('all'); setMenu(false); };

  const savedCount = allTemplates.filter((t) => savedIds.includes(t.id)).length;

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  // Kaydırınca üst bölüm daralır (kullanıcı isteği 27 Ekim 2026; "quick return" düzeni, ör. Safari/Instagram üst çubuğu):
  // listede aşağı inerken rutin kartları yalnız başlığa iner, süzgeç ve yaş satırı gizlenir; yukarı doğru kaydırınca ya da
  // en üste dönünce geri açılır. Daralma/açılma sırasında liste yüksekliği değiştiği için kısa bir süre olaylar yok sayılır.
  const [compact, setCompactState] = useState(false);
  const compactRef = useRef(false);
  const lastY = useRef(0);
  const lockUntil = useRef(0);
  const setCompact = (v: boolean) => {
    if (compactRef.current === v) return;
    compactRef.current = v;
    lockUntil.current = Date.now() + 320;
    LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
    setCompactState(v);
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const y = contentOffset.y;
    const dy = y - lastY.current;
    lastY.current = y;
    if (Date.now() < lockUntil.current) return;
    if (y <= 8) return setCompact(false);
    const atBottom = y + layoutMeasurement.height >= contentSize.height - 4; // sonda geri sekme açmasın
    if (dy > 6 && y > 48) setCompact(true);
    else if (dy < -12 && !atBottom) setCompact(false);
  };
  const full = !compact || menu;

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
          style={{ flex: 1, fontSize: 15, color: colors.navy, letterSpacing: 0 }}
        />
      </View>

      {/* Hazır rutinler: birkaç görevi tek seferde ekler (kullanıcı isteği 27 Ekim 2026). Aramada ve menü açıkken gizli. */}
      {!query.trim() && !menu && (
        <View style={{ marginTop: full ? 14 : 10 }}>
          {full && <Text style={styles.section}>Hazır rutinler</Text>}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }}
            contentContainerStyle={{ gap: full ? 10 : 8, paddingHorizontal: 20, paddingTop: full ? 8 : 0 }}>
            {routines.map((r) => (
              <Pressable key={r.id} onPress={() => navigation.navigate('Routine', { id: r.id })}
                style={[full ? styles.routine : styles.routineMini, { backgroundColor: r.tint }]}
                accessibilityRole="button" accessibilityLabel={`Hazır rutin: ${r.title}`}>
                <Ionicons name={r.icon} size={full ? 22 : 15} color={colors.navy} />
                <Text style={full ? styles.routineTitle : styles.routineMiniTitle} numberOfLines={full ? 2 : 1}>{r.title}</Text>
                {full && <Text style={styles.routineSub}>{routineTasks(r).length} görev · {r.subtitle}</Text>}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Açılır filtre: bütün seçenekler tek bakışta (daralınca gizli) */}
      {full && <View style={{ paddingHorizontal: 20, marginTop: 12, zIndex: 2 }}>
        <Pressable onPress={() => setMenu((m) => !m)} style={styles.dropdown} accessibilityRole="button"
          accessibilityState={{ expanded: menu }} accessibilityLabel={`Filtre: ${current.label}`}>
          {current.icon && <Ionicons name={current.icon} size={18} color={colors.navy} />}
          <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: colors.navy }} numberOfLines={1}>
            {current.label}{filter === 'saved' && savedCount ? ` · ${savedCount}` : ''}
          </Text>
          <Ionicons name={menu ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
        </Pressable>
        {menu && (
          <View style={styles.menu}>
            {options.map((o, i) => (
              <Pressable key={o.id} onPress={() => choose(o.id)}
                style={[styles.menuRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line }]}>
                {o.icon ? <Ionicons name={o.icon} size={18} color={colors.navy} /> : null}
                <Text style={{ flex: 1, fontSize: 15, color: colors.navy, fontWeight: filter === o.id ? '700' : '400' }}>{o.label}</Text>
                {filter === o.id && <Ionicons name="checkmark" size={18} color={colors.navy} />}
              </Pressable>
            ))}
          </View>
        )}
      </View>}

      {/* Yaş grubu (Tüm görevler ve kategorilerde) */}
      {full && showAges && !menu && (
        // Yükseklik sabit: alttaki liste çipleri ezmesin (iOS'ta yatay kaydırma alanı küçülüp üst üste biniyordu)
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0, height: 44, marginTop: 12, marginBottom: 4 }}
          contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20 }}>
          <Chip label="Tüm yaşlar" active={age === 'all'} onPress={() => setAge('all')} />
          {templateAges.map((b) => (
            <Chip key={b.id} label={b.label} active={age === b.id} onPress={() => setAge(b.id)} />
          ))}
        </ScrollView>
      )}

      {full ? <Text style={styles.hint}>Birden fazla görev seçip tek seferde atayabilirsiniz.</Text> : <View style={{ height: 8 }} />}

      <FlatList
        data={list}
        keyExtractor={(t) => t.id}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ padding: 20, paddingBottom: 200, gap: 10 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListEmptyComponent={
          <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 40 }}>
            {filter === 'saved'
              ? 'Henüz kaydedilen görev yok.\nBir görevin sağındaki yer imi simgesine dokunarak kaydedebilirsin.'
              : 'Sonuç bulunamadı.'}
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
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{t.title}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <DifficultyBadge d={t.difficulty} coins={t.coins} />
                  <Text style={{ flexShrink: 1, fontSize: 12, color: colors.muted }} numberOfLines={1}>
                    {t.custom ? 'Senin görevin' : categoryLabel(t.category)} · {skillLabel(t.skill)}
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

function Chip({ label, active, onPress, icon, iconColor }: {
  label: string; active: boolean; onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap; iconColor?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && { backgroundColor: colors.navy, borderColor: colors.navy }]}
    >
      {icon && <Ionicons name={icon} size={16} color={iconColor ?? (active ? '#fff' : colors.navy)} />}
      <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '600', color: active ? '#fff' : colors.navy }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  // Alttan açılan pencerede (modal) üst güvenli alan yok: başlık kenara yapışmasın
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 18, paddingBottom: 6 },
  topTitle: { fontSize: 16, fontWeight: '700', color: colors.navy },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: radius.md, marginHorizontal: 20, marginTop: 14, paddingHorizontal: 14, height: 46 },
  dropdown: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line },
  menu: { marginTop: 6, borderRadius: radius.md, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, height: 46 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 16,
    borderRadius: radius.pill, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line,
  },
  hint: { fontSize: 12, color: colors.muted, paddingHorizontal: 20, marginTop: 10, marginBottom: 2 },
  section: { fontSize: 13, fontWeight: '700', color: colors.navy, paddingHorizontal: 20 },
  routine: { width: 140, height: 104, borderRadius: radius.md, padding: 12, gap: 4, justifyContent: 'space-between' },
  routineTitle: { fontSize: 14, fontWeight: '700', color: colors.navy },
  routineSub: { fontSize: 11, color: '#4A5165' },
  routineMini: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, borderRadius: radius.pill, paddingHorizontal: 12 },
  routineMiniTitle: { fontSize: 13, fontWeight: '700', color: colors.navy },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: radius.md, padding: 14, borderWidth: 1.5, borderColor: 'transparent' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.faint, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.navy },
  used: { fontSize: 13, fontWeight: '600', color: colors.navy },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 28 },
  cta: { height: 52, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
