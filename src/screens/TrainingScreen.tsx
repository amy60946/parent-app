import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { IconButton } from '../components/ui';
import { Bar, Check, TRAINING_NOTE } from '../components/TrainingParts';
import { Training, TYPE_WORD, moduleItems, trainingPct, useTrainings } from '../lib/trainings';

// Eğitim sayfası (ortak akislar.md 23 adım 4; rakibin aile uygulamasına sadık, ClinicApp training/ParentPreview.tsx ile aynı düzen):
// başlık kartı · Öğrenme modülleri (tür + ad + işaret, %) · Uygulama görevleri · Tek seferlik görevler · altta "Başla".
// `list: 'tasks'` ile açılınca "Görevlerin": bana atanmış etkin eğitimlerin uygulama görevleri ve tek seferlik görevleri.
// Aile içindeki öteki ebeveyne atanmış eğitim görünür ama işlem yapılmaz (sunucu da izin vermez).
export default function TrainingScreen({ navigation, route }: any) {
  const list = useTrainings();
  const insets = useSafeAreaInsets();
  const trainingId: string | undefined = route.params?.trainingId;
  const t = list?.find((x) => x.id === trainingId);
  const back = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Tabs', { screen: 'Ben' }));

  const header = (
    <View style={styles.header}>
      <IconButton name="chevron-back" label="Geri" onPress={back} />
    </View>
  );

  if (route.params?.list === 'tasks') {
    const mine = (list ?? []).filter((x) => x.mine && x.status === 'active' && (x.tasks.length || x.todos.some((d) => !d.doneAt)));
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        {header}
        <ScrollView contentContainerStyle={styles.pad}>
          <Text style={styles.big} accessibilityRole="header">Görevlerin</Text>
          {list === undefined && <ActivityIndicator color={colors.navy} />}
          {list !== undefined && !mine.length && <Text style={styles.cap}>Şu an uzmanından bekleyen görev yok.</Text>}
          {mine.map((x) => (
            <View key={x.id} style={{ gap: 8 }}>
              <Text style={styles.sec}>{x.title}</Text>
              <TaskRows t={x} navigation={navigation} hideDone />
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!t) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        {header}
        {list === undefined ? <ActivityIndicator color={colors.navy} style={{ marginTop: 40 }} />
          : <Text style={[styles.cap, { textAlign: 'center', padding: 24 }]}>Bu eğitim şu an açılamıyor. Uzmanın eğitimi kapatmış ya da paylaşım bitmiş olabilir.</Text>}
      </SafeAreaView>
    );
  }

  const items = moduleItems(t);
  const pct = trainingPct(t);
  const firstOpen = Math.max(0, items.findIndex((x) => !x.m.completedAt));
  const play = (index: number) => navigation.navigate('TrainingPlayer', { trainingId: t.id, index });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {header}
      <ScrollView contentContainerStyle={[styles.pad, { paddingBottom: items.length ? 110 : 40 }]}>
        <View style={styles.titleCard}>
          <Text style={styles.big} accessibilityRole="header">{t.title}</Text>
          {!!t.childName && <Text style={styles.cap}>{t.childName}</Text>}
          {t.status === 'mastered' && <View style={styles.chip}><Text style={styles.chipText}>Tamamlandı</Text></View>}
        </View>
        {!t.mine && <Text style={styles.cap}>Bu eğitim {t.parentName || 'ailedeki öteki ebeveyn'} için. Görebilirsin; işaretleri o yapar.</Text>}

        {items.length > 0 && (
          <View style={{ gap: 8 }}>
            <View style={styles.secRow}>
              <Text style={[styles.sec, { flexShrink: 1 }]}>Öğrenme modülleri</Text>
              <Text style={styles.pct}>%{pct}</Text>
            </View>
            <Bar pct={pct} />
            {items.map(({ m, it }, i) => (
              <Pressable key={m.id} onPress={() => play(i)} style={styles.row} accessibilityRole="button"
                accessibilityLabel={`${TYPE_WORD[it.type]}: ${it.title}${m.completedAt ? ', tamamlandı' : ''}`}>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={styles.tiny}>{TYPE_WORD[it.type]}</Text>
                  <Text style={styles.rowText}>{it.title}</Text>
                </View>
                <Check on={!!m.completedAt} />
              </Pressable>
            ))}
          </View>
        )}

        <TaskRows t={t} navigation={navigation} sections />
        <Text style={styles.note}>{TRAINING_NOTE}</Text>
      </ScrollView>
      {items.length > 0 && (
        <View style={[styles.sticky, { paddingBottom: 14 + insets.bottom }]}>
          <Pressable onPress={() => play(firstOpen)} style={styles.primary} accessibilityRole="button">
            <Text style={styles.primaryText}>{pct === 100 || !t.mine || t.status !== 'active' ? 'Göz at' : pct > 0 ? 'Devam et' : 'Başla'}</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

// Uygulama görevleri + tek seferlik görevler (eğitim sayfasında başlıklı, "Görevlerin"de eğitim başına)
function TaskRows({ t, navigation, sections, hideDone }: { t: Training; navigation: any; sections?: boolean; hideDone?: boolean }) {
  const todos = hideDone ? t.todos.filter((d) => !d.doneAt) : t.todos;
  return (
    <>
      {t.tasks.length > 0 && (
        <View style={{ gap: 8 }}>
          {sections && <Text style={styles.sec}>Uygulama görevleri</Text>}
          {t.tasks.map((k) => (
            <Pressable key={k.id} onPress={() => navigation.navigate('TrainingTask', { trainingId: t.id, taskId: k.id })} style={styles.row}
              accessibilityRole="button" accessibilityLabel={`Uygulama görevi: ${k.title}`}>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                {!sections && <Text style={styles.tiny}>Uygulama görevi</Text>}
                <Text style={[styles.rowText, styles.upper]}>{k.title}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.faint} />
            </Pressable>
          ))}
        </View>
      )}
      {todos.length > 0 && (
        <View style={{ gap: 8 }}>
          {sections && <Text style={styles.sec}>Tek seferlik görevler</Text>}
          {todos.map((d) => (
            <Pressable key={d.id} onPress={() => navigation.navigate('TrainingTodo', { trainingId: t.id, todoId: d.id })} style={styles.row}
              accessibilityRole="button" accessibilityLabel={`Tek seferlik görev: ${d.title}${d.doneAt ? ', tamamlandı' : ''}`}>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text style={styles.tiny}>Tek seferlik görev</Text>
                <Text style={[styles.rowText, styles.upper]}>{d.title}</Text>
              </View>
              <Check on={!!d.doneAt} />
            </Pressable>
          ))}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 6, paddingBottom: 2 },
  pad: { padding: 20, paddingTop: 8, gap: 16 },
  big: { fontSize: 22, fontWeight: '800', color: colors.navy, flexShrink: 1 },
  cap: { fontSize: 13, lineHeight: 18, color: '#5F6678' },
  titleCard: { backgroundColor: colors.today, borderRadius: radius.md, padding: 16, gap: 6 },
  chip: { alignSelf: 'flex-start', backgroundColor: '#EEE8F7', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  chipText: { fontSize: 12, fontWeight: '700', color: '#5B3F99' },
  sec: { fontSize: 14, fontWeight: '800', color: colors.navy },
  secRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  pct: { fontSize: 14, fontWeight: '800', color: colors.navy, flexShrink: 0, minWidth: 44, textAlign: 'right' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13 },
  rowText: { fontSize: 15, color: colors.navy, flexShrink: 1 },
  upper: { textTransform: 'uppercase', fontWeight: '700', letterSpacing: 0.3, fontSize: 14 },
  tiny: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  note: { fontSize: 11, lineHeight: 16, color: colors.muted, textAlign: 'center', marginTop: 4 },
  sticky: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, backgroundColor: colors.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  primary: { height: 52, borderRadius: radius.pill, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
