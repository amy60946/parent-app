import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert, TextInput, AppState } from 'react-native';
import { useNotifications } from '../notifications';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import Info from './Info';
import Sheet from './Sheet';
import { ClinicLink } from '../lib/clinic';
import {
  Session, Slot, familySessions, respondSession, respondOffer, bookingSlots, bookSlot, sessionError, syncSessionReminders,
  whenLabel, dayLabel, hhmm, placeLabel, STATUS_LABEL, sessionIcs,
} from '../lib/sessions';
import { shareCalendarFile } from '../lib/calendarFile';
import { track } from '../lib/track';
import { afterModal } from '../lib/modal';

// Uzmanım › <uzman> › Randevular (ortak akislar.md 20, ParentApp 1–9). Sunucuda işlev yoksa ya da gösterilecek randevu
// ve alınabilecek saat yoksa bölüm hiç görünmez. Not, gündem ve paket gelmez (aile görmez).
const INFO = 'Uzmanının planladığı seanslar. "Geleceğiz" ya da "Uygun değil" diyerek uzmanına haber verebilirsin. Seanstan önce telefonuna hatırlatma gelir (bildirimler açıksa).';

// Cihazdaki seans hatırlatmaları: açılışta, öne gelişte ve yeni seans bildiriminde yeniden kurulur; çıkışta silinir.
export function SessionReminderSync() {
  const { items } = useNotifications();
  const latest = items.find((n) => n.kind.startsWith('session_'))?.id;
  useEffect(() => { syncSessionReminders(); }, [latest]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') syncSessionReminders(); });
    return () => { sub.remove(); syncSessionReminders(null); };
  }, []);
  return null;
}

export function useSessions() {
  const [list, setList] = useState<Session[] | null | undefined>(undefined);
  const reload = useCallback(() => familySessions().then((l) => { setList(l); syncSessionReminders(l); }).catch(() => setList((x) => x ?? null)), []);
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  return { list, reload };
}

export default function SessionsSection({ links, childName, highlight }: {
  links: ClinicLink[]; childName: (id: string) => string; highlight?: string;
}) {
  const { list, reload } = useSessions();
  const [slots, setSlots] = useState<Record<string, Slot[]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [noteFor, setNoteFor] = useState<Session | null>(null);
  const [note, setNote] = useState('');
  const [booking, setBooking] = useState<string | null>(null); // link
  const ids = links.map((l) => l.linkId).join(',');
  useFocusEffect(useCallback(() => {
    let live = true;
    Promise.all(links.map(async (l) => [l.linkId, await bookingSlots(l.linkId).catch(() => [])] as const))
      .then((r) => { if (live) setSlots(Object.fromEntries(r)); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]));

  const mine = useMemo(() => (list ?? []).filter((s) => links.some((l) => l.linkId === s.linkId)), [list, ids]); // eslint-disable-line react-hooks/exhaustive-deps
  const now = Date.now();
  const offers = mine.filter((s) => s.status === 'offered');
  const upcoming = mine.filter((s) => s.status !== 'offered' && new Date(s.startsAt).getTime() + s.durationMin * 60e3 > now).slice(0, 5);
  const past = mine.filter((s) => s.status !== 'offered' && new Date(s.startsAt).getTime() + s.durationMin * 60e3 <= now).reverse();
  const bookable = links.filter((l) => (slots[l.linkId]?.length ?? 0) > 0);
  const many = links.length > 1;

  if (!list || (mine.length === 0 && bookable.length === 0)) return null;

  const run = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key);
    try { await fn(); await reload(); if (ok) Alert.alert(ok); }
    catch (e) { Alert.alert('Olmadı', sessionError(e)); }
    setBusy(null);
  };
  const respond = (s: Session, r: 'ok' | 'unavailable', n?: string) =>
    run(`${s.id}:${r}`, async () => { await respondSession(s.id, r, n); track('session.respond', { response: r }); });
  const offer = (s: Session, accept: boolean) => {
    const go = () => run(`${s.id}:offer`, async () => { await respondOffer(s.id, accept); track('session.offer', { accept }); },
      accept ? 'Randevu senin. Uzmanına haber verildi.' : undefined);
    if (accept) go();
    else Alert.alert('Teklifi istemiyor musun?', 'Saat başka bir aileye açılabilir.', [{ text: 'Vazgeç', style: 'cancel' }, { text: 'İstemiyorum', onPress: go }]);
  };
  const ics = async (s: Session) => {
    try { await shareCalendarFile('randevu.ics', sessionIcs(s)); track('session.ics'); }
    catch { Alert.alert('Takvime eklenemedi', 'Bir süre sonra tekrar dene.'); }
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={styles.section}>Randevular</Text>
        <Info title="Randevular" text={INFO} />
      </View>

      {offers.map((s) => (
        <View key={s.id} style={[styles.card, styles.offer, highlight === s.id && styles.hl]}>
          <Text style={styles.kicker}>Boşalan saat · {many ? childName(s.childId) : s.clinician}</Text>
          <Text style={styles.when}>{whenLabel(s.startsAt)}</Text>
          <Text style={styles.cap}>{[`${s.durationMin} dk`, s.kindLabel, placeLabel(s)].join(' · ')}</Text>
          {!!s.offerExpiresAt && <Text style={styles.cap}>Yanıt için son: {whenLabel(s.offerExpiresAt)}</Text>}
          <View style={styles.btnRow}>
            <Pressable onPress={() => offer(s, true)} disabled={!!busy} style={[styles.small, styles.smallOn]} accessibilityRole="button">
              {busy === `${s.id}:offer` ? <ActivityIndicator size="small" color="#fff" /> : <Text style={[styles.smallText, { color: '#fff' }]}>Kabul et</Text>}
            </Pressable>
            <Pressable onPress={() => offer(s, false)} disabled={!!busy} style={styles.small} accessibilityRole="button">
              <Text style={styles.smallText}>İstemiyorum</Text>
            </Pressable>
          </View>
        </View>
      ))}

      {(upcoming.length > 0 || bookable.length > 0 || past.length > 0) && (
        <View style={styles.card}>
          {upcoming.length === 0 && <Text style={[styles.cap, { paddingVertical: 14 }]}>Yaklaşan randevu yok.</Text>}
          {upcoming.map((s, i) => {
            const open = s.status === 'planned' && new Date(s.startsAt).getTime() > now;
            return (
              <View key={s.id} style={[styles.item, i > 0 && styles.sep, highlight === s.id && styles.hlRow]}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    {many && <Text style={styles.kicker}>{childName(s.childId)}</Text>}
                    <Text style={styles.when}>{whenLabel(s.startsAt)}</Text>
                    <Text style={styles.cap}>{[`${s.durationMin} dk`, s.kindLabel, placeLabel(s)].join(' · ')}</Text>
                  </View>
                  {s.status !== 'planned' && <StatusChip s={s} />}
                </View>
                {open && (
                  s.familyResponse ? (
                    <View style={[styles.btnRow, { alignItems: 'center' }]}>
                      <Ionicons name={s.familyResponse === 'ok' ? 'checkmark-circle' : 'close-circle'} size={18}
                        color={s.familyResponse === 'ok' ? colors.easy.fg : colors.danger} />
                      <Text style={[styles.resp, { flex: 1 }]} numberOfLines={2}>
                        {s.familyResponse === 'ok' ? 'Geleceğiz' : `Uygun değil${s.familyNote ? ` · ${s.familyNote}` : ''}`}
                      </Text>
                      <Pressable onPress={() => (s.familyResponse === 'ok' ? (setNote(''), setNoteFor(s)) : respond(s, 'ok'))} hitSlop={12} style={styles.tap} disabled={!!busy} accessibilityRole="button">
                        <Text style={styles.link}>{s.familyResponse === 'ok' ? 'Uygun değil' : 'Geleceğiz'}</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.btnRow}>
                      <Pressable onPress={() => respond(s, 'ok')} disabled={!!busy} style={[styles.small, styles.smallSoft]} accessibilityRole="button">
                        {busy === `${s.id}:ok` ? <ActivityIndicator size="small" color={colors.navy} /> : <Text style={styles.smallText}>Geleceğiz</Text>}
                      </Pressable>
                      <Pressable onPress={() => { setNote(''); setNoteFor(s); }} disabled={!!busy} style={styles.small} accessibilityRole="button">
                        <Text style={styles.smallText}>Uygun değil</Text>
                      </Pressable>
                    </View>
                  )
                )}
                {open && (
                  <Pressable onPress={() => ics(s)} style={styles.ics} hitSlop={12} accessibilityRole="button" accessibilityLabel="Takvime ekle">
                    <Ionicons name="calendar-outline" size={15} color={colors.navy} />
                    <Text style={styles.link}>Takvime ekle</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
          {bookable.map((l) => (
            <Pressable key={l.linkId} onPress={() => { setBooking(l.linkId); track('session.list'); }} style={[styles.row, styles.sep]} accessibilityRole="button">
              <Ionicons name="add-circle-outline" size={20} color={colors.navy} />
              <Text style={[styles.rowTitle, { flex: 1 }]}>Randevu al{many ? ` · ${childName(l.childId)}` : ''}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.faint} />
            </Pressable>
          ))}
          {past.length > 0 && (
            <Pressable onPress={() => setShowPast((v) => !v)} style={[styles.row, styles.sep]} accessibilityRole="button">
              <Text style={[styles.cap, { flex: 1 }]}>Geçmiş randevular · {past.length}</Text>
              <Ionicons name={showPast ? 'chevron-up' : 'chevron-down'} size={16} color={colors.muted} />
            </Pressable>
          )}
          {showPast && past.map((s) => (
            <View key={s.id} style={[styles.row, styles.sep]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pastWhen}>{dayLabel(s.startsAt)} · {hhmm(s.startsAt)}{many ? ` · ${childName(s.childId)}` : ''}</Text>
                <Text style={styles.cap}>{s.kindLabel}</Text>
              </View>
              <StatusChip s={s} />
            </View>
          ))}
        </View>
      )}

      <Sheet visible={!!noteFor} title="Bu saat uygun değil" onClose={() => setNoteFor(null)}
        footer={(
          <View style={{ paddingTop: 12 }}>
            <Pressable style={styles.btn} disabled={!!busy} accessibilityRole="button" onPress={() => {
              const s = noteFor; if (!s) return;
              setNoteFor(null);
              afterModal(() => respond(s, 'unavailable', note.trim() || undefined));
            }}>
              <Text style={styles.btnText}>Uzmanıma haber ver</Text>
            </Pressable>
          </View>
        )}>
        <Text style={styles.cap}>{noteFor ? `${whenLabel(noteFor.startsAt)} · ${noteFor.kindLabel}` : ''}</Text>
        <TextInput value={note} onChangeText={(t) => setNote(t.slice(0, 300))} placeholder="Kısa not (isteğe bağlı): ör. o gün okulda gezi var"
          placeholderTextColor={colors.muted} multiline style={styles.input} accessibilityLabel="Kısa not" />
        <Text style={styles.cap}>Uzmanın yeni bir saat önerebilir.</Text>
      </Sheet>

      <BookingSheet linkId={booking} slots={booking ? slots[booking] ?? [] : []} onClose={() => setBooking(null)}
        onBooked={() => { setBooking(null); reload(); bookingSlots(booking!).then((s) => setSlots((x) => ({ ...x, [booking!]: s }))).catch(() => {}); }} />
    </View>
  );
}

function StatusChip({ s }: { s: Session }) {
  const tone = s.status === 'done' ? colors.easy : s.status === 'planned' ? { bg: colors.today, fg: colors.navy }
    : s.status === 'postponed' ? colors.medium : colors.hard;
  return <View style={[styles.chip, { backgroundColor: tone.bg }]}><Text style={[styles.chipText, { color: tone.fg }]}>{STATUS_LABEL[s.status]}</Text></View>;
}

// Randevu al: gün → saat → onay (akislar.md 20 ParentApp 7)
function BookingSheet({ linkId, slots, onClose, onBooked }: { linkId: string | null; slots: Slot[]; onClose: () => void; onBooked: () => void }) {
  const days = useMemo(() => [...new Set(slots.map((s) => new Date(s.startsAt).toDateString()))], [slots]);
  const [day, setDay] = useState<string | null>(null);
  const [pick, setPick] = useState<Slot | null>(null);
  const [busy, setBusy] = useState(false);
  const d = day && days.includes(day) ? day : days[0];
  const times = slots.filter((s) => new Date(s.startsAt).toDateString() === d);
  const close = () => { setPick(null); setDay(null); onClose(); };
  const book = async () => {
    if (!linkId || !pick) return;
    setBusy(true);
    try {
      await bookSlot(linkId, pick.startsAt);
      track('session.book');
      setPick(null); setDay(null);
      onBooked();
      afterModal(() => Alert.alert('Randevun alındı', `${whenLabel(pick.startsAt)}. Uzmanına haber verildi.`));
    } catch (e) { Alert.alert('Olmadı', sessionError(e)); }
    setBusy(false);
  };
  return (
    <Sheet visible={!!linkId} title="Randevu al" onClose={close}
      footer={(
        <View style={{ paddingTop: 12, gap: 8 }}>
          {pick && <Text style={[styles.cap, { textAlign: 'center' }]}>{whenLabel(pick.startsAt)} · {pick.durationMin} dk</Text>}
          <Pressable style={[styles.btn, !pick && styles.btnOff]} disabled={!pick || busy} onPress={book} accessibilityRole="button">
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={[styles.btnText, !pick && { color: '#5F6678' }]}>{pick ? 'Randevuyu al' : 'Bir saat seç'}</Text>}
          </Pressable>
        </View>
      )}>
      <Text style={styles.h}>Gün</Text>
      <View style={styles.chips}>
        {days.map((x) => (
          <Pressable key={x} onPress={() => { setDay(x); setPick(null); }} style={[styles.pick, x === d && styles.pickOn]} accessibilityRole="button">
            <Text style={[styles.pickText, x === d && { color: '#fff' }]}>{dayLabel(new Date(x).toISOString())}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={[styles.h, { marginTop: 12 }]}>Saat</Text>
      <View style={styles.chips}>
        {times.map((s) => (
          <Pressable key={s.startsAt} onPress={() => setPick(s)} style={[styles.pick, pick?.startsAt === s.startsAt && styles.pickOn]} accessibilityRole="button">
            <Text style={[styles.pickText, pick?.startsAt === s.startsAt && { color: '#fff' }]}>{hhmm(s.startsAt)}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={[styles.cap, { marginTop: 10 }]}>{times[0] ? `Seans ${times[0].durationMin} dakika.` : ''}</Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 16, fontWeight: '800', color: colors.navy },
  card: { backgroundColor: '#fff', borderRadius: radius.md, paddingHorizontal: 14 },
  offer: { paddingVertical: 14, gap: 4, borderWidth: 1.5, borderColor: colors.gold },
  hl: { borderColor: colors.navy },
  hlRow: { backgroundColor: '#F7F8FB', marginHorizontal: -14, paddingHorizontal: 14 },
  item: { paddingVertical: 13, gap: 10 },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.navy },
  kicker: { fontSize: 11, fontWeight: '700', color: '#5F6678', textTransform: 'uppercase', letterSpacing: 0.3 },
  when: { fontSize: 16, fontWeight: '700', color: colors.navy },
  pastWhen: { fontSize: 14, fontWeight: '600', color: colors.navy },
  cap: { fontSize: 12, lineHeight: 17, color: '#5F6678' },
  resp: { fontSize: 14, fontWeight: '600', color: colors.navy },
  link: { fontSize: 13, fontWeight: '600', color: colors.navy, textDecorationLine: 'underline' },
  ics: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6 },
  tap: { paddingVertical: 6 },
  btnOff: { backgroundColor: colors.line },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  btn: { height: 46, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  small: { flex: 1, height: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  smallOn: { backgroundColor: colors.navy },
  smallSoft: { backgroundColor: colors.today, borderColor: colors.today },
  smallText: { fontSize: 14, fontWeight: '700', color: colors.navy },
  chip: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  chipText: { fontSize: 11, fontWeight: '700' },
  input: { minHeight: 80, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, padding: 12, fontSize: 15, color: colors.navy, textAlignVertical: 'top', marginVertical: 10 },
  h: { fontSize: 13, fontWeight: '600', color: colors.navy, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pick: { minWidth: 64, height: 38, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  pickOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  pickText: { fontSize: 14, fontWeight: '600', color: colors.navy },
});
