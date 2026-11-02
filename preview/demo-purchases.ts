import { Alert } from 'react-native';
import type { PlanId } from '../data/plans';

// Web önizleme: src/lib/purchases.ts (RevenueCat) yerine bu taklit kopyalanır (preview/build.sh).
// Gerçek mağazaya bağlanmaz; fiyatlar örnek, satın alma 1 saniye sonra başarılı sayılır (yalnız bu sekmede).
export const ENTITLEMENT = 'premium';
export const MANAGE_URL = 'https://apps.apple.com/account/subscriptions';
export const storeEnabled = true;

export type StorePrice = { price: number; priceString: string; perMonth?: string; currency: string };
export type StorePrices = Partial<Record<PlanId, StorePrice>>;
export type StoreResult =
  | { ok: true }
  | { ok: false; reason: 'not_connected' | 'unavailable' | 'canceled' | 'pending' | 'none' | 'failed'; message?: string };

let bought = false;
const listeners = new Set<(entitled: boolean) => void>();
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function storeIdentify(_userId: string): Promise<void> {}
export async function storeLogOut(): Promise<void> { bought = false; }

export async function storePrices(): Promise<StorePrices | null> {
  return {
    monthly: { price: 149.99, priceString: '₺149,99', perMonth: '₺149,99', currency: 'TRY' },
    yearly: { price: 1199.99, priceString: '₺1.199,99', perMonth: '₺100,00', currency: 'TRY' },
  };
}

export async function storePurchase(_plan: PlanId): Promise<StoreResult> {
  await wait(1000);
  bought = true;
  listeners.forEach((fn) => fn(true));
  return { ok: true };
}

export async function storeRestore(): Promise<StoreResult> {
  await wait(600);
  return bought ? { ok: true } : { ok: false, reason: 'none' };
}

export async function storeSubscription(): Promise<{ active: boolean; willRenew: boolean } | null> {
  return { active: bought, willRenew: bought };
}

export async function storeManage(): Promise<void> {
  Alert.alert('Aboneliği yönet', 'iPhone\'da burada Apple\'ın abonelik sayfası açılır (önizlemede yok).');
}

export function onStoreChange(fn: (entitled: boolean) => void): () => void {
  listeners.add(fn);
  fn(bought);
  return () => { listeners.delete(fn); };
}
