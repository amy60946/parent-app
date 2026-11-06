import { supabase } from './supabase';
import { PlanId } from '../data/plans';
import { storePurchase, storeRestore, StoreResult } from './purchases';

// Aile aboneliğinin durumu: sunucuda family_access() (ortak/supabase/migrations/20261022110000_subscriptions.sql).
// Satın alma ve geri yükleme App Store'da (RevenueCat, lib/purchases.ts); RevenueCat olayı billing-webhook'a iletir,
// sunucu aile durumunu günceller. Mağaza anahtarı yoksa purchase/restore 'not_connected' döner (bugünkü davranış).
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

export type PurchaseResult = StoreResult;

export const purchase = (plan: PlanId): Promise<PurchaseResult> => storePurchase(plan);
export const restorePurchases = (): Promise<PurchaseResult> => storeRestore();

// Ücretsiz planda kapalı bir şeye dokunulunca (ya da sunucu premium_required dönünce) üyelik ekranı açılır.
type Listener = (reason?: string) => void;
const listeners = new Set<Listener>();
export const onPremiumRequired = (fn: Listener) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const requestPremium = (reason?: string) => listeners.forEach((fn) => fn(reason));
