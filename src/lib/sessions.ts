import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { isMissingRpc } from './clinic';
import { genitive } from './tr';

// Seans planlama, ebeveyn tarafı (ortak/sozlesme/akislar.md 20 ParentApp 1–9; öneri 20261105100000_sessions.sql, durumlar.md P18).
// Uzmanım › <uzman> › Randevular. Sunucuda işlev yoksa (öneri uygulanmadı) null: bölüm görünmez.

export type SessionStatus = 'planned' | 'done' | 'no_show' | 'late_cancel' | 'cancelled' | 'postponed' | 'offered';
export type Session = {
  id: string; linkId: string; childId: string; child: string; clinician: string; clinic: string;
  startsAt: string; durationMin: number; kind: string; kindLabel: string; mode: 'in_person' | 'online' | 'home' | string;
  room: string | null; location: string | null; status: SessionStatus;
  familyResponse: 'ok' | 'unavailable' | null; familyNote: string | null; bookedBy: 'clinic' | 'family' | null;
  offerExpiresAt: string | null; series: boolean; reminders: number[];
};
export type Slot = { startsAt: string; durationMin: number };

const toSession = (r: any): Session => ({
  id: r.id, linkId: r.link_id, childId: r.child_id, child: r.child ?? '', clinician: r.clinician ?? '', clinic: r.clinic ?? '',
  startsAt: r.starts_at, durationMin: r.duration_min ?? 45, kind: r.kind ?? 'individual', kindLabel: r.kind_label ?? 'Seans',
  mode: r.mode ?? 'in_person', room: r.room ?? null, location: r.location ?? null, status: r.status,
  familyResponse: r.family_response ?? null, familyNote: r.family_note ?? null, bookedBy: r.booked_by ?? null,
  offerExpiresAt: r.offer_expires_at ?? null, series: !!r.series, reminders: Array.isArray(r.reminders) ? r.reminders : [1440, 120],
});

export async function familySessions(): Promise<Session[] | null> {
  const { data, error } = await supabase.rpc('family_sessions');
  if (error) { if (isMissingRpc(error)) return null; throw new Error(error.message); }
  return ((data as any[]) ?? []).map(toSession);
}

export async function respondSession(id: string, response: 'ok' | 'unavailable', note?: string) {
  const { error } = await supabase.rpc('family_session_respond', { p_id: id, p_response: response, p_note: note ?? null });
  if (error) throw new Error(error.message);
}

export async function respondOffer(id: string, accept: boolean): Promise<string> {
  const { data, error } = await supabase.rpc('family_offer_respond', { p_id: id, p_accept: accept });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function bookingSlots(linkId: string): Promise<Slot[]> {
  const { data, error } = await supabase.rpc('family_booking_slots', { p_link_id: linkId });
  if (error) { if (isMissingRpc(error)) return []; throw new Error(error.message); }
  return ((data as any[]) ?? []).map((s) => ({ startsAt: s.starts_at, durationMin: s.duration_min ?? 45 }));
}

export async function bookSlot(linkId: string, startsAt: string): Promise<string> {
  const { data, error } = await supabase.rpc('family_book_slot', { p_link_id: linkId, p_starts_at: startsAt });
  if (error) throw new Error(error.message);
  return data as string;
}

// Sunucu hata kodu iletide (durumlar.md P18 "Hatalar")
export function sessionError(e: unknown): string {
  const m = (e as Error | undefined)?.message ?? '';
  if (m.includes('slot_not_available')) return 'Bu saat az önce doldu. Başka bir saat seç.';
  if (m.includes('too_many_bookings')) return 'En çok 2 randevu alabilirsin. Önce yaklaşan randevunu bekle ya da uzmanınla konuş.';
  if (m.includes('offer_expired')) return 'Bu teklifin süresi doldu.';
  if (m.includes('offer_not_found') || m.includes('session_not_found')) return 'Bu randevu artık yok.';
  if (m.includes('session_closed')) return 'Bu randevu için artık yanıt verilemiyor.';
  if (m.includes('link_not_active')) return 'Bu uzmanla paylaşım kapalı.';
  return 'Şu an kaydedilemedi. İnternet bağlantını kontrol edip tekrar dene.';
}

/* ---------- Gösterim ---------- */
const DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const pad = (n: number) => String(n).padStart(2, '0');
export const hhmm = (iso: string) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
export function dayLabel(iso: string, now = new Date()) {
  const d = new Date(iso);
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  if (sameDay(d, now)) return 'Bugün';
  if (sameDay(d, tomorrow)) return 'Yarın';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${DAYS[d.getDay()]}`;
}
export const whenLabel = (iso: string) => `${dayLabel(iso)} · ${hhmm(iso)}`;
export const placeLabel = (s: Pick<Session, 'mode' | 'room' | 'location'>) =>
  s.mode === 'online' ? 'Online' : s.mode === 'home' ? 'Ev ziyareti' : [s.room, s.location].filter(Boolean).join(' · ') || 'Yüz yüze';

export const STATUS_LABEL: Record<SessionStatus, string> = {
  planned: 'Planlandı', done: 'Yapıldı', no_show: 'Gelmedi', late_cancel: 'Geç iptal', cancelled: 'İptal', postponed: 'Ertelendi', offered: 'Teklif',
};

/* ---------- Cihazda hatırlatma (akislar.md 20 ParentApp 3) ---------- */
const PREFIX = 'session-reminder:';
const OFF_KEY = 'push-off'; // lib/notifications ile aynı: kullanıcı bildirimi kapattıysa hatırlatma da kurulmaz

function reminderText(s: Session, minutes: number) {
  const lead = minutes % 1440 === 0 ? (minutes === 1440 ? 'Yarın' : `${minutes / 1440} gün sonra`)
    : minutes % 60 === 0 ? `${minutes / 60} saat sonra` : `${minutes} dakika sonra`;
  const who = s.child ? `${genitive(s.child)} seansı` : 'Seans';
  return { title: `${lead} ${hhmm(s.startsAt)} ${who}`, body: [s.kindLabel, s.clinician || s.clinic, placeLabel(s)].filter(Boolean).join(' · ') };
}

// Eski hatırlatmaları silip gelecekteki planlı seanslar için yeniden kurar. Web'de yok.
export async function syncSessionReminders(list?: Session[] | null) {
  if (Platform.OS === 'web') return;
  try {
    const sessions = list === undefined ? await familySessions() : list;
    const all = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(all.filter((n) => n.identifier.startsWith(PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
    if (!sessions || (await AsyncStorage.getItem(OFF_KEY)) === '1') return;
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return;
    const now = Date.now();
    for (const s of sessions) {
      if (s.status !== 'planned' || s.familyResponse === 'unavailable') continue;
      for (const m of s.reminders) {
        const at = new Date(s.startsAt).getTime() - m * 60e3;
        if (at <= now + 60e3) continue;
        const t = reminderText(s, m);
        await Notifications.scheduleNotificationAsync({
          identifier: `${PREFIX}${s.id}:${m}`,
          content: { title: t.title, body: t.body, data: { kind: 'session_reminder', session_id: s.id } },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(at) },
        });
      }
    }
  } catch { /* hatırlatma kurulamazsa uygulama akışı sürer */ }
}

/* ---------- Takvime ekle (.ics; akislar.md 20 ParentApp 4) ---------- */
const icsDate = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
const icsText = (t: string) => t.replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\n/g, '\\n');
export function sessionIcs(s: Session) {
  const start = new Date(s.startsAt);
  const end = new Date(start.getTime() + s.durationMin * 60e3);
  const title = `${s.kindLabel}${s.child ? ` · ${s.child}` : ''}`;
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Moyo//Randevu//TR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${s.id}@parentapp`, `DTSTAMP:${icsDate(new Date())}`, `DTSTART:${icsDate(start)}`, `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(title)}`, `DESCRIPTION:${icsText([s.clinician, s.clinic].filter(Boolean).join(' · '))}`,
    `LOCATION:${icsText(placeLabel(s))}`, 'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');
}
