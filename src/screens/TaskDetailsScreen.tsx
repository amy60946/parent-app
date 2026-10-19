import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, Difficulty, difficultyMeta, MAX_TASK_COINS } from '../theme';
import { Avatar, IconButton, Segmented, Toggle, Label } from '../components/ui';
import DateField from '../components/DateField';
import { useStore, Assignment, RepeatKind } from '../store';
import { DAY_SHORT, fromISO, todayISO } from '../dates';
import { TaskDayPart, dayPartLabel, taskDayPartOf } from '../data/dayParts';

type Row = { on: boolean; difficulty: Difficulty; coins: string };

export default function TaskDetailsScreen({ navigation, route }: any) {
  const { taskId, templateIds, custom, date } = route.params ?? {};
  const { tasks, children, allTemplates, addTasks, updateTask, deleteTask, addCustomTemplate } = useStore();

  const editing = taskId ? tasks.find((t) => t.id === taskId) : undefined;
  const picked = useMemo(
    () => (templateIds ?? []).map((id: string) => allTemplates.find((t) => t.id === id)!).filter(Boolean),
    [templateIds, allTemplates],
  );

  const initialDifficulty: Difficulty = picked[0]?.difficulty ?? 'easy';
  const [title, setTitle] = useState(editing?.title ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [rows, setRows] = useState<Record<string, Row>>(() => {
    const r: Record<string, Row> = {};
    children.forEach((c) => {
      const a = editing?.assignments.find((x) => x.childId === c.id);
      r[c.id] = a
        ? { on: true, difficulty: a.difficulty, coins: String(a.coins) }
        : { on: !editing, difficulty: initialDifficulty, coins: String(difficultyMeta[initialDifficulty].coins) };
    });
    return r;
  });
  const [startDate, setStartDate] = useState<string>(editing?.startDate ?? date ?? todayISO());
  const [recurring, setRecurring] = useState(editing?.recurring ?? false);
  const [repeatKind, setRepeatKind] = useState<RepeatKind>(editing?.repeatKind ?? 'daily');
  const [repeatDays, setRepeatDays] = useState<number[]>(editing?.repeatDays ?? []);
  const [endDate, setEndDate] = useState<string | undefined>(editing?.endDate);
  const [reminder, setReminder] = useState<string | undefined>(editing?.reminder);
  const [dayPart, setDayPart] = useState<TaskDayPart | 'any'>(editing?.dayPart ?? (editing?.reminder ? taskDayPartOf(editing.reminder) : 'any'));
  // Hatırlatma saati seçilince gün bölümü kendiliğinden dolar (sonra değiştirilebilir)
  const pickReminder = (v?: string) => { setReminder(v); if (v) setDayPart(taskDayPartOf(v)); };
  const [requiresReview, setRequiresReview] = useState(editing?.requiresReview ?? true);
  const [saveTemplate, setSaveTemplate] = useState(false);

  const isPast = startDate < todayISO();
  const isCustom = !!custom;
  const canTitle = editing || isCustom;

  // Haftalık/aylık seçilince gün seçili değilse başlangıç tarihinin gününü öner
  const chooseKind = (k: RepeatKind) => {
    setRepeatKind(k);
    const d = fromISO(startDate);
    if (k === 'weekly') setRepeatDays(repeatKind === 'weekly' && repeatDays.length ? repeatDays : [((d.getDay() + 6) % 7) + 1]);
    else if (k === 'monthly') setRepeatDays(repeatKind === 'monthly' && repeatDays.length ? repeatDays : [d.getDate()]);
    else setRepeatDays([]);
  };
  const toggleDay = (n: number) =>
    setRepeatDays((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n].sort((a, b) => a - b)));

  const setRow = (id: string, patch: Partial<Row>) => setRows((p) => ({ ...p, [id]: { ...p[id], ...patch } }));

  const submit = () => {
    const assignments: Assignment[] = children
      .filter((c) => rows[c.id].on)
      .map((c) => ({
        childId: c.id,
        difficulty: rows[c.id].difficulty,
        coins: Math.min(MAX_TASK_COINS, Math.max(0, parseInt(rows[c.id].coins || '0', 10) || 0)),
      }));
    if (assignments.length === 0) return Alert.alert('En az bir çocuk seçin');
    if (canTitle && !title.trim()) return Alert.alert('Görev adı gerekli');
    if (recurring && endDate && endDate < startDate) return Alert.alert('Son tarih başlangıçtan önce olamaz');
    if (recurring && repeatKind !== 'daily' && repeatDays.length === 0) {
      return Alert.alert(repeatKind === 'weekly' ? 'Haftanın en az bir gününü seç' : 'Ayın en az bir gününü seç');
    }

    const common = {
      description: description.trim(),
      assignments,
      startDate,
      recurring,
      repeatKind: recurring ? repeatKind : 'daily' as RepeatKind,
      repeatDays: recurring && repeatKind !== 'daily' ? repeatDays : [],
      endDate: recurring ? endDate : undefined,
      reminder,
      dayPart: dayPart === 'any' ? undefined : dayPart,
      requiresReview,
    };

    if (editing) {
      // Tekrarlayan görevde tek kayıt güncellenir; her güne yansır.
      updateTask(editing.id, { ...common, title: title.trim() });
    } else if (isCustom) {
      if (saveTemplate) {
        addCustomTemplate({
          title: title.trim(), emoji: '⭐', category: 'home',
          difficulty: assignments[0].difficulty, skill: 'Özel',
        });
      }
      addTasks([{ ...common, title: title.trim(), emoji: '⭐', skill: 'Özel' }]);
    } else {
      addTasks(picked.map((t: any) => ({ ...common, title: t.title, emoji: t.emoji, skill: t.skill })));
    }
    navigation.popToTop();
  };

  const confirmDelete = () => {
    if (!editing) return;
    Alert.alert(
      'Görev silinsin mi?',
      editing.recurring ? 'Tekrarlayan görev tüm günlerden silinir.' : 'Bu işlem geri alınamaz.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Sil', style: 'destructive', onPress: () => { deleteTask(editing.id); navigation.goBack(); } },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <IconButton name="chevron-back" label="Geri" onPress={() => navigation.goBack()} />
        <Text style={styles.topTitle}>{editing ? 'Görevi düzenle' : 'Görev ayrıntıları'}</Text>
        <IconButton name="close" label="Kapat" onPress={() => navigation.popToTop()} />
      </View>

      {isPast && (
        <View style={styles.banner}>
          <Ionicons name="information-circle" size={18} color={colors.medium.fg} />
          <Text style={{ flex: 1, fontSize: 13, color: colors.medium.fg }}>
            Geçmiş bir güne göre atama yapıyorsunuz.
          </Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 140 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        {canTitle ? (
          <>
            <Label>Görev adı</Label>
            <TextInput value={title} onChangeText={setTitle} placeholder="Örn. Çantanı hazırla" placeholderTextColor={colors.muted} style={styles.input} />
          </>
        ) : (
          <>
            <Label>Seçilen görevler</Label>
            {picked.map((t: any) => (
              <Text key={t.id} style={{ fontSize: 15, color: colors.navy, marginBottom: 4 }}>{t.emoji}  {t.title}</Text>
            ))}
          </>
        )}

        <Label>Açıklama (isteğe bağlı)</Label>
        <TextInput
          value={description} onChangeText={setDescription} multiline
          placeholder="Çocuğunuza kısa bir ipucu yazın" placeholderTextColor={colors.muted}
          style={[styles.input, { minHeight: 76, textAlignVertical: 'top' }]}
        />

        <Label>Atanan çocuklar ve ödül</Label>
        <View style={{ backgroundColor: '#fff', borderRadius: radius.md }}>
          {children.map((c, i) => {
            const r = rows[c.id];
            return (
              <View key={c.id} style={[{ padding: 14, gap: 10 }, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Avatar id={c.avatar} size={36} />
                  <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: colors.navy }}>{c.name}</Text>
                  <Toggle value={r.on} onChange={(v) => setRow(c.id, { on: v })} />
                </View>
                {r.on && (
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Segmented
                        options={(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => ({ id: d, label: difficultyMeta[d].label }))}
                        value={r.difficulty}
                        onChange={(d) => setRow(c.id, { difficulty: d, coins: String(difficultyMeta[d].coins) })}
                      />
                    </View>
                    <View style={styles.coinBox}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gold }} />
                      <TextInput
                        value={r.coins} keyboardType="number-pad" maxLength={2}
                        onChangeText={(v) => {
                          const digits = v.replace(/[^0-9]/g, '');
                          setRow(c.id, { coins: digits && Number(digits) > MAX_TASK_COINS ? String(MAX_TASK_COINS) : digits });
                        }}
                        style={{ width: 36, fontSize: 14, fontWeight: '700', color: colors.navy, padding: 0 }}
                      />
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <Label>Başlangıç tarihi</Label>
        <DateField mode="date" value={startDate} onChange={(v) => v && setStartDate(v)} placeholder="Tarih seç" />

        <Label>Program</Label>
        <Segmented
          options={[{ id: 'once', label: 'Tek seferlik' }, { id: 'repeat', label: 'Tekrarlayan' }]}
          value={recurring ? 'repeat' : 'once'}
          onChange={(v) => setRecurring(v === 'repeat')}
        />
        {recurring && (
          <View style={styles.repeatBox}>
            <Segmented
              options={[{ id: 'daily', label: 'Her gün' }, { id: 'weekly', label: 'Haftalık' }, { id: 'monthly', label: 'Aylık' }]}
              value={repeatKind}
              onChange={chooseKind}
            />
            {repeatKind === 'weekly' && (
              <>
                <Text style={styles.repeatHint}>Hangi günler? (birden fazla seçebilirsin)</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  {DAY_SHORT.map((d, i) => (
                    <DayDot key={d} label={d} on={repeatDays.includes(i + 1)} onPress={() => toggleDay(i + 1)} size={40} />
                  ))}
                </View>
              </>
            )}
            {repeatKind === 'monthly' && (
              <>
                <Text style={styles.repeatHint}>Ayın hangi günleri? (birden fazla seçebilirsin)</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {Array.from({ length: 31 }, (_, i) => (
                    <DayDot key={i} label={String(i + 1)} on={repeatDays.includes(i + 1)} onPress={() => toggleDay(i + 1)} size={38} />
                  ))}
                </View>
                {repeatDays.some((x) => x > 28) && (
                  <Text style={styles.sub}>29, 30 ve 31 olmayan aylarda görev ayın son gününe atanır.</Text>
                )}
              </>
            )}
            <View style={styles.summary}>
              <Ionicons name="repeat" size={16} color={colors.navy} />
              <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: colors.navy }}>
                {repeatSummary(repeatKind, repeatDays)}
              </Text>
            </View>
            <Text style={[styles.sub, { marginTop: 4 }]}>Son tarih (isteğe bağlı · boş bırakırsan sürekli tekrar eder)</Text>
            <DateField mode="date" value={endDate} onChange={setEndDate} placeholder="Son tarih seç" clearable />
          </View>
        )}

        <Label>Hatırlatma saati (isteğe bağlı)</Label>
        <Text style={[styles.sub, { marginTop: -2, marginBottom: 8 }]}>
          Bir saat seçersen görev günü o saatte çocuğuna hatırlatma gider. Boş bırakırsan hatırlatma gönderilmez.
        </Text>
        <DateField mode="time" value={reminder} onChange={pickReminder} placeholder="Saat seç (ör. 19:00)" clearable />

        <Label>Günün bölümü</Label>
        <Text style={[styles.sub, { marginTop: -2, marginBottom: 8 }]}>
          Görevler ekranında Sabah / Öğlen / Akşam süzgeci için. Belli bir saati yoksa "Herhangi" kalsın.
        </Text>
        <Segmented<TaskDayPart | 'any'>
          options={[
            { id: 'morning', label: dayPartLabel.morning }, { id: 'noon', label: dayPartLabel.noon },
            { id: 'evening', label: dayPartLabel.evening }, { id: 'any', label: 'Herhangi' },
          ]}
          value={dayPart}
          onChange={setDayPart}
        />

        <View style={[styles.switchRow, { marginTop: 20 }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.navy }}>İnceleme gerekli</Text>
            <Text style={styles.sub}>Kapalıysa tamamlanınca otomatik onaylanır</Text>
          </View>
          <Toggle value={requiresReview} onChange={setRequiresReview} />
        </View>

        {isCustom && !editing && (
          <View style={[styles.switchRow, { marginTop: 10 }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.navy }}>Şablon olarak kaydet</Text>
              <Text style={styles.sub}>Daha sonra Kaydedilenler'den bulabilirsiniz</Text>
            </View>
            <Toggle value={saveTemplate} onChange={setSaveTemplate} />
          </View>
        )}

        {editing && (
          <Pressable onPress={confirmDelete} style={{ marginTop: 32, alignItems: 'center', padding: 12 }}>
            <Text style={{ color: colors.danger, fontWeight: '600' }}>Görevi sil</Text>
          </Pressable>
        )}
      </ScrollView>

      <View style={styles.bottom}>
        <Pressable style={styles.cta} onPress={submit}>
          <Text style={styles.ctaText}>{editing ? 'Kaydet' : 'Görevi ata'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function DayDot({ label, on, onPress, size }: { label: string; on: boolean; onPress: () => void; size: number }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      style={{
        width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center',
        backgroundColor: on ? colors.navy : '#F1F2F6',
      }}
    >
      <Text style={{ fontSize: label.length > 2 ? 11 : 13, fontWeight: '700', color: on ? '#fff' : colors.navy }}>{label}</Text>
    </Pressable>
  );
}

function repeatSummary(kind: RepeatKind, days: number[]) {
  if (kind === 'daily') return 'Her gün tekrar eder';
  if (!days.length) return 'Gün seçilmedi';
  if (kind === 'weekly') {
    if (days.length === 7) return 'Haftada 7 gün (her gün)';
    return `Haftada ${days.length} gün: ${days.map((d) => DAY_SHORT[d - 1]).join(', ')}`;
  }
  return `Ayda ${days.length} kez: her ayın ${days.join(', ')}. günü`;
}

const styles = StyleSheet.create({
  repeatBox: { backgroundColor: '#fff', borderRadius: radius.md, padding: 14, marginTop: 10, gap: 10 },
  repeatHint: { fontSize: 12, color: colors.muted },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.today, borderRadius: radius.sm, padding: 10 },
  safe: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 4 },
  topTitle: { fontSize: 16, fontWeight: '700', color: colors.navy },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.medium.bg, marginHorizontal: 20, marginTop: 12, padding: 12, borderRadius: radius.sm },
  input: { backgroundColor: '#fff', borderRadius: radius.md, padding: 14, fontSize: 15, color: colors.navy },
  coinBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ECEEF3', borderRadius: radius.sm, paddingHorizontal: 12, height: 40 },
  sub: { fontSize: 12, color: colors.muted, marginTop: 6, marginBottom: 6 },
  switchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.md, padding: 14 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.bg, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28 },
  cta: { height: 52, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
