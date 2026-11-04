import type { PlanId } from '../data/plans';

// Web sürümü (parent-app/site, /app/; kullanıcı isteği 4 Kasım 2026): web'de satın alma yok, ClinicApp web paneli gibi.
// Üyelik iPhone/iPad'deki ParentApp'ten (App Store) başlatılır; aynı hesapla web'de de açılır (aile durumu sunucudan okunur).
// Metro web derlemesinde purchases.ts yerine bu dosyayı seçer; preview/build.sh bunun üstüne mağaza taklidini kopyalar.
export const ENTITLEMENT = 'premium';
export const MANAGE_URL = 'https://apps.apple.com/account/subscriptions';
export const storeEnabled = false;
export const WEB_NO_STORE = 'Üyeliği iPhone ya da iPad\'deki ParentApp\'ten başlat; aynı hesapla burada da açılır.';

export type StorePrice = { price: number; priceString: string; perMonth?: string; currency: string };
export type StorePrices = Partial<Record<PlanId, StorePrice>>;
export type StoreResult =
  | { ok: true }
  | { ok: false; reason: 'not_connected' | 'unavailable' | 'canceled' | 'pending' | 'none' | 'failed'; message?: string };

export const storeIdentify = (_userId: string) => Promise.resolve();
export const storeLogOut = () => Promise.resolve();
export const storePrices = async (): Promise<StorePrices | null> => null;
export const storePurchase = async (_plan: PlanId): Promise<StoreResult> => ({ ok: false, reason: 'not_connected', message: WEB_NO_STORE });
export const storeRestore = async (): Promise<StoreResult> => ({ ok: false, reason: 'not_connected', message: WEB_NO_STORE });
export const storeSubscription = async () => null;
export const storeManage = async () => { if (typeof window !== 'undefined') window.open(MANAGE_URL, '_blank'); };
export const storeRedeemCode = async () => false;
export const onStoreChange = (_fn: (entitled: boolean) => void) => () => {};
