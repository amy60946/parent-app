import { Linking, Platform } from 'react-native';
import Purchases, { LOG_LEVEL, PURCHASES_ERROR_CODE, type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';
import type { PlanId } from '../data/plans';

// App Store aboneliği (RevenueCat; ortak CANLIYA_ALMA.md 1.8, sozlesme/akislar.md P12). Mağazayla konuşan tek dosya.
// Web önizlemede preview/demo-purchases.ts bu dosyanın yerine geçer (aynı dışa aktarımlar).
// Anahtar: EXPO_PUBLIC_REVENUECAT_IOS_KEY = RevenueCat'in herkese açık iOS anahtarı (appl_…), GitHub Secrets → CI .env.
// Gizli anahtar (sk_…) uygulamaya ve depoya asla girmez. Anahtar yoksa mağaza kapalı: üyelik ekranı "henüz açık değil" der.
// Kimlik: RevenueCat app_user_id = Supabase kullanıcı kimliği (billing-webhook bununla aileyi bulur).
const KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';
export const ENTITLEMENT = 'premium';
const OFFERING = 'default';
const PRODUCT: Record<PlanId, string> = { monthly: 'parentapp.premium.monthly', yearly: 'parentapp.premium.yearly' };
export const MANAGE_URL = 'https://apps.apple.com/account/subscriptions';

export const storeEnabled = Platform.OS === 'ios' && KEY.startsWith('appl_');

export type StorePrice = { price: number; priceString: string; perMonth?: string; currency: string };
export type StorePrices = Partial<Record<PlanId, StorePrice>>;
export type StoreResult =
  | { ok: true }
  | { ok: false; reason: 'not_connected' | 'unavailable' | 'canceled' | 'pending' | 'none' | 'failed'; message?: string };

let configured = false;
let current: string | null = null;
let queue: Promise<unknown> = Promise.resolve();
const pkgs: Partial<Record<PlanId, PurchasesPackage>> = {};

// Kimlik değişimleri sırayla: aynı anda giriş ve çıkış karışmasın
const serial = (fn: () => Promise<void>) => {
  const p = queue.then(fn, fn);
  queue = p.catch(() => {});
  return p.catch(() => {});
};
const ready = async () => { if (!storeEnabled) return false; await queue; return configured; };
const entitled = (ci: CustomerInfo) => !!ci.entitlements.active[ENTITLEMENT];

// Oturum açılınca: ilk seferde configure(appUserID), sonra kullanıcı değiştiyse logIn
export function storeIdentify(userId: string): Promise<void> {
  if (!storeEnabled) return Promise.resolve();
  return serial(async () => {
    if (!configured) {
      if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG).catch(() => {});
      Purchases.configure({ apiKey: KEY, appUserID: userId });
      configured = true;
      current = userId;
    } else if (current !== userId) {
      await Purchases.logIn(userId);
      current = userId;
    }
  });
}

// Çıkışta: mağaza kimliği bırakılır (anonim kullanıcıda logOut hata verir, atlanır)
export function storeLogOut(): Promise<void> {
  if (!storeEnabled || !configured) return Promise.resolve();
  return serial(async () => {
    current = null;
    if (!(await Purchases.isAnonymous())) await Purchases.logOut();
  });
}

// Fiyatlar mağazadan, kullanıcının para biriminde. Offering boşsa (ürünler henüz onaylı değil) null.
export async function storePrices(): Promise<StorePrices | null> {
  if (!(await ready())) return null;
  try {
    const o = await Purchases.getOfferings();
    const off = o.all[OFFERING] ?? o.current;
    if (!off) return null;
    const out: StorePrices = {};
    (Object.keys(PRODUCT) as PlanId[]).forEach((plan) => {
      const p = off.availablePackages.find((x) => x.product.identifier === PRODUCT[plan])
        ?? (plan === 'monthly' ? off.monthly : off.annual);
      if (!p) return;
      pkgs[plan] = p;
      out[plan] = { price: p.product.price, priceString: p.product.priceString, perMonth: p.product.pricePerMonthString ?? undefined, currency: p.product.currencyCode };
    });
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

const fail = (e: any): StoreResult => {
  if (e?.userCancelled || e?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return { ok: false, reason: 'canceled' };
  if (e?.code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) return { ok: false, reason: 'pending' };
  return { ok: false, reason: 'failed', message: e?.message };
};

export async function storePurchase(plan: PlanId): Promise<StoreResult> {
  if (!(await ready())) return { ok: false, reason: 'not_connected' };
  if (!pkgs[plan]) await storePrices();
  const pkg = pkgs[plan];
  if (!pkg) return { ok: false, reason: 'unavailable' };
  try {
    const r = await Purchases.purchasePackage(pkg);
    return entitled(r.customerInfo) ? { ok: true } : { ok: false, reason: 'pending' };
  } catch (e) {
    return fail(e);
  }
}

export async function storeRestore(): Promise<StoreResult> {
  if (!(await ready())) return { ok: false, reason: 'not_connected' };
  try {
    return entitled(await Purchases.restorePurchases()) ? { ok: true } : { ok: false, reason: 'none' };
  } catch (e) {
    return fail(e);
  }
}

// Bu Apple Kimliği'nde etkin abonelik var mı (hesap silmeden önce uyarı için)
export async function storeSubscription(): Promise<{ active: boolean; willRenew: boolean } | null> {
  if (!(await ready())) return null;
  try {
    const e = (await Purchases.getCustomerInfo()).entitlements.active[ENTITLEMENT];
    return { active: !!e, willRenew: !!e?.willRenew };
  } catch {
    return null;
  }
}

// Aboneliği yönet: uygulama içinde Apple'ın abonelik sayfası; olmazsa Ayarlar bağlantısı
export async function storeManage(): Promise<void> {
  if (await ready()) {
    try { await Purchases.showManageSubscriptions(); return; } catch { /* bağlantıya düş */ }
  }
  Linking.openURL(MANAGE_URL).catch(() => {});
}

// Apple hediye kodu (offer code; davet ödülü, App Store'dan ödeyen aileye): Apple'ın kod kullanma sayfası açılır.
// Kod yapıştırılabilsin diye ekran önce panoya kopyalar. Mağaza kapalıysa false (ekran yönergeyi gösterir).
export async function storeRedeemCode(): Promise<boolean> {
  if (!(await ready())) return false;
  try { await Purchases.presentCodeRedemptionSheet(); return true; } catch { return false; }
}

// Mağazada durum değişince (satın alma, yenileme, iptal) haber ver
export function onStoreChange(fn: (entitled: boolean) => void): () => void {
  if (!storeEnabled) return () => {};
  const l = (ci: CustomerInfo) => fn(entitled(ci));
  let on = true;
  let added = false;
  ready().then((ok) => { if (ok && on) { Purchases.addCustomerInfoUpdateListener(l); added = true; } });
  return () => { on = false; if (added) Purchases.removeCustomerInfoUpdateListener(l); };
}
