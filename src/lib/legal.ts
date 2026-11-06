import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

// Yasal metinler, onay kaydı, KVKK başvurusu (ortak proposed/20261027200000_legal.sql; metinler ortak/hukuk/,
// ekran metinleri hukuk/50-uygulama-ici-metinler.md). Sunucuda işlev yoksa (öneri uygulanmadı) null döner: uygulama bugünkü gibi sürer.
export type LegalApp = 'parent' | 'child';
export type LegalDoc = {
  key: string; version: string; title: string; status: 'draft' | 'published' | 'retired'; summary?: string | null;
  requires_acceptance: boolean; published_at?: string | null; accepted_at?: string | null;
};
export type KvkkKind = 'info' | 'access' | 'correct' | 'delete' | 'object' | 'third_parties' | 'damages' | 'other';
export type KvkkRequest = { id: string; app: string; kind: KvkkKind; child_id?: string | null; status: 'received' | 'in_progress' | 'answered' | 'rejected';
  received_at: string; due_at: string; answered_at?: string | null };

const missing = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === 'PGRST202' || e.code === '42883' || /Could not find the function/i.test(e.message ?? ''));

// Aydınlatma metinleri onay değil bilgilendirmedir: kutu yok, "gösterildi" kaydı (50 §1.1, §2)
export const isNotice = (key: string) => key.startsWith('aydinlatma-');

const BASE = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
export const legalUrl = (key: string, version?: string) =>
  `${BASE}/functions/v1/legal?doc=${encodeURIComponent(key)}${version ? `&v=${encodeURIComponent(version)}` : ''}`;
// Metin uygulamanın içinde gösterilir (LegalText ekranı): *.supabase.co, işlevin HTML yanıtını text/plain'e çevirdiği için
// tarayıcıda ham kod görünür. format=json → { key, version, title, status, published_at, body_md }.
export type LegalBody = { key: string; version: string; title: string; status: LegalDoc['status']; published_at?: string | null; body_md: string };
export async function legalJson(key: string, version?: string): Promise<LegalBody> {
  const r = await fetch(`${legalUrl(key, version)}&format=json`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function legalDocs(app: LegalApp | 'web'): Promise<LegalDoc[] | null> {
  const { data, error } = await supabase.rpc('legal_documents_for', { p_app: app });
  if (missing(error)) return null;
  if (error) throw new Error(error.message);
  return (data ?? []) as LegalDoc[];
}

export async function legalPending(app: LegalApp): Promise<LegalDoc[] | null> {
  const { data, error } = await supabase.rpc('legal_pending', { p_app: app });
  if (missing(error)) return null;
  if (error) throw new Error(error.message);
  return (data ?? []) as LegalDoc[];
}

export async function legalAccept(app: LegalApp, docs: Pick<LegalDoc, 'key' | 'version'>[]) {
  if (!docs.length) return;
  const { error } = await supabase.rpc('legal_accept', { p_app: app, p_docs: docs.map((d) => ({ key: d.key, version: d.version })) });
  if (error && !missing(error)) throw new Error(error.message);
}

// Kayıt ekranında işaretlenen Kullanım Koşulları + gösterilen Aydınlatma: oturum açılınca yazılır (50 §0 "Kayıt sırasında")
const SIGNUP_KEY = 'legal-signup';
const SIGNUP_DOCS = ['kosullar-parentapp', 'aydinlatma-ebeveyn'];
export const markSignupConsent = () => AsyncStorage.setItem(SIGNUP_KEY, new Date().toISOString()).catch(() => {});
export async function acceptSignupConsent() {
  if (!(await AsyncStorage.getItem(SIGNUP_KEY).catch(() => null))) return;
  try {
    const pending = await legalPending('parent');
    if (pending) await legalAccept('parent', pending.filter((d) => SIGNUP_DOCS.includes(d.key)));
    await AsyncStorage.removeItem(SIGNUP_KEY);
  } catch { /* bir sonraki açılışta yeniden denenir */ }
}

export async function kvkkCreate(kind: KvkkKind, detail: string, childId?: string) {
  const { data, error } = await supabase.rpc('kvkk_request_create', { p_app: 'parent', p_kind: kind, p_detail: detail, p_child: childId ?? null });
  if (missing(error)) throw new Error('KVKK başvurusu sunucu güncellenince açılır. Şimdilik e-postayla başvurabilirsin.');
  if (error) throw new Error(error.message);
  return data as { id: string; status: string; received_at: string; due_at: string };
}

export async function myKvkk(): Promise<KvkkRequest[] | null> {
  const { data, error } = await supabase.rpc('my_kvkk_requests');
  if (missing(error)) return null;
  if (error) throw new Error(error.message);
  return (data ?? []) as KvkkRequest[];
}

export const kvkkKinds: { kind: KvkkKind; label: string; hint?: string; needsDetail?: boolean }[] = [
  { kind: 'info', label: 'Hakkımda hangi verileri, neden işlediğinizi öğrenmek' },
  { kind: 'access', label: 'Verilerimin bir kopyasını almak' },
  { kind: 'correct', label: 'Yanlış ya da eksik bir bilginin düzeltilmesi', hint: 'Profil ve çocuk bilgilerini kendin de düzenleyebilirsin.', needsDetail: true },
  { kind: 'delete', label: 'Verilerimin silinmesi', hint: 'Hesabının tamamını silmek için Aile › Hesap › Hesabı yönet daha hızlıdır.' },
  { kind: 'third_parties', label: 'Verilerimin kimlere aktarıldığını öğrenmek' },
  { kind: 'object', label: 'Bir işlemeye itiraz etmek', needsDetail: true },
  { kind: 'damages', label: 'Uğradığım bir zararın giderilmesi', needsDetail: true },
  { kind: 'other', label: 'Başka bir talep', hint: 'Uzmanının notlarıyla ilgili talepler uzmanın kliniğine iletilebilir.', needsDetail: true },
];
export const kvkkStatus: Record<KvkkRequest['status'], string> = {
  received: 'Alındı', in_progress: 'İnceleniyor', answered: 'Yanıtlandı', rejected: 'Gerekçeli yanıt verildi (e-postana bak)',
};
