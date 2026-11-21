import { supabase } from './supabase';
import { isMissingRpc } from './clinic';

// Ebeveynin bildirim tercihleri (ortak akislar.md 25 "5a" ve "Sunucu motoru"; hukuk/50 §14.1; kullanıcı kararı 20 Kasım 2026).
// Ebeveyn başınadır, yalnız telefona giden anlık bildirimi etkiler; uygulama içi liste ve rozet aynı kalır.
export type NotifPrefs = { step_done: boolean; day_complete: boolean; tips: boolean };
export type NotifPrefKey = keyof NotifPrefs;

const DEFAULTS: NotifPrefs = { step_done: false, day_complete: true, tips: true };
const norm = (d: any): NotifPrefs => ({
  step_done: typeof d?.step_done === 'boolean' ? d.step_done : DEFAULTS.step_done,
  day_complete: typeof d?.day_complete === 'boolean' ? d.day_complete : DEFAULTS.day_complete,
  tips: typeof d?.tips === 'boolean' ? d.tips : DEFAULTS.tips,
});

// null: sunucuda işlev yok (öneri 20261120210000 uygulanmadı)
export async function loadNotifPrefs(): Promise<NotifPrefs | null> {
  const { data, error } = await supabase.rpc('parent_notification_prefs');
  if (error) { if (isMissingRpc(error)) return null; throw error; }
  return norm(data);
}

export async function saveNotifPref(key: NotifPrefKey, on: boolean): Promise<NotifPrefs> {
  const { data, error } = await supabase.rpc('parent_notification_prefs_set', { p_key: key, p_on: on });
  if (error) throw error;
  return norm(data);
}
