import React, { useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { DifficultyBadge, IconButton } from '../components/ui';
import { categories, Category, TemplateAge, templateAges, categoryLabel, skillLabel } from '../data/templates';
import { useStore } from '../store';
import { routineTasks } from '../data/routines';
import { familyAge, usePlan } from '../lib/plan';

// Akıllı öneri (smart recommendation) sonra eklenecek: ortak/DURUM.md hatırlatıcı
type Filter = 'all' | 'saved' | 'popular' | Category;

const POPULAR_COUNT = 20;

export default function CreateTaskScreen({ navigation, route }: any) {
  const date: string | undefined = route.params?.date;
  const { allTemplates, savedIds, toggleSaved, children } = useStore();
  const plan = usePlan(); // tanışma yanıtlarına göre rutin sırası (lib/plan.ts)
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [age, setAge] = useState<TemplateAge | 'all'>(() => familyAge(children)); // kişisel plan: çocukların yaş grubu
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
  const choose = (f: Filter) => { setFilter(f); setAge(familyAge(children)); setMenu(false); };

  const savedCount = allTemplates.filter((t) => savedIds.includes(t.id)).length;

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  // Kaydırınca üst bölüm (kullanıcı geri bildirimi 28 Ekim 2026: daralma takılıyordu): rutin kartları, süzgeç ve yaş satırı
  // listenin başında durur ve listeyle birlikte doğal kayar (yerleşim değişmez, takılma olmaz). Kartlar görünümden çıkınca
  // üstte rutin başlıklarından oluşan ince bir şerit belirir; geri kaydırınca kartlar yeniden görünür ve şerit kaybolur.
  // Şeridin görünürlüğü kaydırmaya bağlı yerel animasyondur (JS beklemez).
  const scrollY = useRef(new Animated.Value(0)).current;
  const [cardsEnd, setCardsEnd] = useState(170); // rutin kartlarının listedeki alt kenarı
  const [stripOn, setStripOn] = useState(false);
  const stripRef = useRef(false);
  const showRoutines = !query.trim() && !menu;
  const onScroll = useMemo(() => Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: true,
    listener: (e: any) => {
      const on = e.nativeEvent.contentOffset.y > cardsEnd - 12;
      if (on !== stripRef.current) { stripRef.current = on; setStripOn(on); } // yalnız eşik geçilince (dokunulabilirlik için)
    },
  }), [scrollY, cardsEnd]);
  const stripOpacity = scrollY.interpolate({ inputRange: [cardsEnd - 28, cardsEnd], outputRange: [0, 1], extrapolate: 'clamp' });
  const stripShift = scrollY.interpolate({ inputRange: [cardsEnd - 28, cardsEnd], outputRange: [-10, 0], extrapolate: 'clamp' });

  const header = (
    <View style={{ paddingBottom: 12 }}>
      {/* Hazır rutinler: birkaç görevi tek seferde ekler (kullanıcı isteği 27 Ekim 2026). Aramada ve menü açıkken gizli.
          Sıra ve "Sana önerilen" tanışma yanıtlarından (lib/plan.ts). */}
      {showRoutines && (
        <View style={{ marginTop: 14 }} onLayout={(e) => setCardsEnd(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}>
          <Text style={styles.section}>Hazır rutinler</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }}
            contentContainerStyle={{ gap: 10, paddingHorizontal: 20, paddingTop: 8 }}>
            {plan.routines.map((r) => (
              <Pressable key={r.id} onPress={() => navigation.navigate('Routine', { id: r.id })} style={[styles.routine, { backgroundColor: r.tint }]}
                accessibilityRole="button" accessibilityLabel={`Hazır rutin: ${r.title}${plan.recommended === r.id ? ', sana önerilen' : ''}`}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Ionicons name={r.icon} size={22} color={colors.navy} />
                  {plan.recommended === r.id && <Text style={styles.forYou}>Sana önerilen</Text>}
                </View>
                <Text style={styles.routineTitle} numberOfLines={2}>{r.title}</Text>
                <Text style={styles.routineSub}>{routineTasks(r).length} görev · {r.subtitle}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Açılır filtre: bütün seçenekler tek bakışta */}
      <View style={{ paddingHorizontal: 20, marginTop: 12 }}>
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
      </View>

      {/* Yaş grubu (Tüm görevler ve kategorilerde); başlangıçta çocukların yaş grubu (hepsi aynıysa) */}
      {showAges && !menu && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0, height: 44, marginTop: 12 }}
          contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20 }}>
          <Chip label="Tüm yaşlar" active={age === 'all'} onPress={() => setAge('all')} />
          {templateAges.map((b) => (
            <Chip key={b.id} label={b.label} active={age === b.id} onPress={() => setAge(b.id)} />
          ))}
        </ScrollView>
      )}

      <Text style={styles.hint}>Birden fazla görev seçip tek seferde atayabilirsiniz.</Text>
    </View>
  );

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

      <View style={{ flex: 1 }}>
      <Animated.FlatList
        data={list}
        keyExtractor={(t: any) => t.id}
        onScroll={onScroll}
        scrollEventThrottle={16}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: 200 }}
        ItemSeparatorComponent={Gap}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListEmptyComponent={
          <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 40 }}>
            {filter === 'saved'
              ? 'Henüz kaydedilen görev yok.\nBir görevin sağındaki yer imi simgesine dokunarak kaydedebilirsin.'
              : 'Sonuç bulunamadı.'}
          </Text>
        }
        renderItem={({ item: t }: { item: (typeof list)[number] }) => {
          const on = picked.includes(t.id);
          const saved = savedIds.includes(t.id);
          return (
            <Pressable onPress={() => toggle(t.id)} style={[styles.card, { marginHorizontal: 20 }, on && { borderColor: colors.navy }]}>
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
      {/* Rutin şeridi: kartlar yukarı kayıp gidince belirir (opaklık ve kayma kaydırmaya bağlı, yerel) */}
      {showRoutines && (
        <Animated.View pointerEvents={stripOn ? 'auto' : 'none'} style={[styles.strip, { opacity: stripOpacity, transform: [{ translateY: stripShift }] }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20, alignItems: 'center' }}>
            {plan.routines.map((r) => (
              <Pressable key={r.id} onPress={() => navigation.navigate('Routine', { id: r.id })} style={[styles.routineMini, { backgroundColor: r.tint }]}
                accessibilityRole="button" accessibilityLabel={`Hazır rutin: ${r.title}`}>
                <Ionicons name={r.icon} size={15} color={colors.navy} />
                <Text style={styles.routineMiniTitle} numberOfLines={1}>{r.title}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>
      )}
      </View>

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
  strip: { position: 'absolute', left: 0, right: 0, top: 0, height: 50, justifyContent: 'center', backgroundColor: colors.bg,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  forYou: { fontSize: 10, fontWeight: '800', color: colors.navy, backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, overflow: 'hidden' },
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

const Gap = () => <View style={{ height: 10 }} />;
