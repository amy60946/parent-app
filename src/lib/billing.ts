import { supabase } from './supabase';
import { PlanId } from '../data/plans';

// Aile aboneliğinin durumu: sunucuda family_access() (ortak/supabase/proposed/20261021140000_subscriptions.sql).
// Ödeme altyapısı henüz bağlı değil: satın alma düğmesi bilgi verir. Bağlanınca purchase/restore burada
// ödeme sağlayıcısına (öneri: RevenueCat) gider; sunucu durumu billing-webhook ile güncellenir.
export type AccessState = 'pending' | 'trial' | 'premium' | 'clinic' | 'expired' | 'unknown';
export type Access = {
  state: AccessState;
  full: boolean; // kısıt uygulanmıyor
  enforced: boolean; // ödeme açıldı mı (app_config.billing.enforce)
  trialEndsAt?: string;
  daysLeft?: number;
  plan?: PlanId;
  periodEnd?: string;
  autoRenew?: boolean;
  limits: { maxTasks: number; maxChildren: number };
};

const UNKNOWN: Access = { state: 'unknown', full: true, enforced: false, limits: { maxTasks: 3, maxChildren: 1 } };

export async function fetchAccess(): Promise<Access> {
  const { data, error } = await supabase.rpc('family_access');
  // Sunucu güncellemesi henüz uygulanmadıysa (fonksiyon yok) kimseyi kısıtlama
  if (error || !data) return UNKNOWN;
  const r = data as any;
  return {
    state: r.state ?? 'unknown',
    full: r.full !== false,
    enforced: !!r.enforced,
    trialEndsAt: r.trial_ends_at ?? undefined,
    daysLeft: r.days_left ?? undefined,
    plan: r.plan ?? undefined,
    periodEnd: r.period_end ?? undefined,
    autoRenew: r.auto_renew ?? undefined,
    limits: { maxTasks: r.limits?.max_tasks ?? 3, maxChildren: r.limits?.max_children ?? 1 },
  };
}

export type PurchaseResult = { ok: true } | { ok: false; reason: 'not_connected' | 'canceled' | 'failed'; message?: string };

export async function purchase(_plan: PlanId): Promise<PurchaseResult> {
  return { ok: false, reason: 'not_connected' };
}

export async function restorePurchases(): Promise<PurchaseResult> {
  return { ok: false, reason: 'not_connected' };
}

// Ücretsiz planda kapalı bir şeye dokunulunca (ya da sunucu premium_required dönünce) üyelik ekranı açılır.
type Listener = (reason?: string) => void;
const listeners = new Set<Listener>();
export const onPremiumRequired = (fn: Listener) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const requestPremium = (reason?: string) => listeners.forEach((fn) => fn(reason));
