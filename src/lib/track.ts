import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';
import { uuid } from './uuid';

// Birinci taraf kullanım kaydı (ortak/sozlesme/akislar.md 9): oturum + olay adı ve küçük, kimlik dışı alanlar.
// Kişisel veri ya da serbest metin (ad, not, mesaj, gözlem içeriği) asla gönderilmez. Hata kullanıcıya gösterilmez.
const APP = 'parent';
const version = Constants.expoConfig?.version ?? undefined;
const platform = Platform.OS;
let sessionId = uuid();
let queue: { event: string; props: Record<string, string | number | boolean>; session_id: string; at: string }[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
let lastSession = 0;

const NAME = /^[a-z][a-z0-9_.]{1,59}$/;
type Props = Record<string, string | number | boolean | undefined>;

// Olay: "alan.eylem" (ör. reward.give). Props yalnız sayı, doğru/yanlış ya da kısa sabit değer (tür, sekme adı).
export function track(event: string, props: Props = {}) {
  if (!NAME.test(event)) return;
  const clean: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || !/^[a-z][a-z0-9_]{0,29}$/.test(k)) continue;
    clean[k] = typeof v === 'string' ? v.slice(0, 40) : v;
  }
  queue.push({ event, props: clean, session_id: sessionId, at: new Date().toISOString() });
  if (queue.length >= 20) flush();
  else if (!timer) timer = setTimeout(flush, 15000);
}

export async function flush() {
  clearTimeout(timer); timer = undefined;
  if (!queue.length) return;
  const batch = queue.splice(0, 50);
  try {
    const { error } = await supabase.rpc('track_events', { p_app: APP, p_events: batch, p_platform: platform, p_version: version });
    if (error) throw error;
  } catch {
    // Ağ yoksa bir sonraki gönderimde yeniden dene (birikmeyi sınırla)
    queue = [...batch, ...queue].slice(0, 200);
  }
  if (queue.length) timer = setTimeout(flush, 15000);
}

// Açılışta ve öne gelişte oturum (sunucu dakikada en çok bir oturum sayar)
export async function trackSession() {
  if (Date.now() - lastSession < 60000) return;
  lastSession = Date.now();
  try { await supabase.rpc('track_session', { p_app: APP, p_platform: platform, p_version: version }); } catch {}
  track('app.open');
}

// Oturum açıkken bir kez çağrılır: öne gelişte oturum, arka plana geçişte gönderim
export function startTracking() {
  sessionId = uuid();
  trackSession();
  const sub = AppState.addEventListener('change', (s) => {
    if (s === 'active') { sessionId = uuid(); trackSession(); }
    else if (s === 'background') flush();
  });
  return () => { sub.remove(); flush(); };
}

// Ekran adları (sekme adları Türkçe; olay adında ASCII)
const screenName: Record<string, string> = {
  Görevler: 'tasks', İnceleme: 'review', Gelişim: 'progress', Aile: 'family',
  CreateTask: 'create_task', TaskDetails: 'task_details', Chat: 'chat', Notifications: 'notifications',
  Abc: 'observation', Rewards: 'rewards', Paywall: 'paywall',
};
let lastScreen = '';
export function trackScreen(route?: string) {
  const name = route && screenName[route];
  if (!name || name === lastScreen) return;
  lastScreen = name;
  track(`screen.${name}`);
}
