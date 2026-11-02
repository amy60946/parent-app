import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Access, fetchAccess, onPremiumRequired, requestPremium } from './lib/billing';
import { onStoreChange, storeEnabled, storeIdentify, storePrices, StorePrices } from './lib/purchases';
import { useAuth } from './lib/auth';
import { useStore } from './store';
import { todayISO } from './dates';

// Abonelik durumu + ücretsiz plan sınırları. Sınırlar sunucuda da var; burada önceden uyarıp üyelik ekranını açar.
export type Feature = 'task' | 'child' | 'reward' | 'stones' | 'message' | 'abc';

const featureText: Record<Feature, string> = {
  task: 'Ücretsiz planda en çok 3 etkin görev olabilir.',
  child: 'Ücretsiz planda 1 çocuk eklenebilir.',
  reward: 'Ödüller Premium üyelikte.',
  stones: 'Güneş Taşı düşme Premium üyelikte.',
  message: 'Çocuğuna mesaj göndermek Premium üyelikte.',
  abc: 'Davranış kayıtları Premium üyelikte.',
};

type Billing = {
  access: Access | null;
  refresh: () => Promise<void>;
  // Satın alma / geri yüklemeden sonra: sunucu (billing-webhook) güncellenene kadar birkaç kez family_access()
  refreshAfterPurchase: () => Promise<void>;
  storeOn: boolean; // mağaza anahtarı var (iOS)
  prices: StorePrices | null; // mağaza fiyatları; null ise plans.ts yer tutucuları
  // İzin varsa true; yoksa üyelik ekranını açar ve false döner
  allow: (f: Feature) => boolean;
};

const Ctx = createContext<Billing | null>(null);
const SHOWN_KEY = 'paywall-shown';

export const activeTaskCount = (tasks: ReturnType<typeof useStore>['tasks']) => {
  const today = todayISO();
  return tasks.filter((t) => (!t.endDate || t.endDate >= today) && (t.recurring || t.startDate >= today)).length;
};

const member = (a: Access | null) => a?.state === 'premium' || a?.state === 'clinic';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function BillingProvider({ children, onPaywall }: { children: React.ReactNode; onPaywall: (reason?: string) => void }) {
  const { familyId, tasks, children: kids } = useStore();
  const { session } = useAuth();
  const uid = session?.user.id;
  const [server, setServer] = useState<Access | null>(null);
  const [entitled, setEntitled] = useState(false);
  const [prices, setPrices] = useState<StorePrices | null>(null);

  const refresh = useCallback(async () => { setServer(await fetchAccess()); }, []);
  const refreshAfterPurchase = useCallback(async () => {
    for (const ms of [0, 1500, 3000, 6000]) {
      await wait(ms);
      const a = await fetchAccess();
      setServer(a);
      if (member(a)) return;
    }
  }, []);

  useEffect(() => { if (familyId) refresh(); }, [familyId, refresh]);
  // RevenueCat'e Supabase kullanıcı kimliğiyle giriş (configure / logIn), sonra fiyatlar ve mağaza durumu
  useEffect(() => {
    if (!uid || !storeEnabled) return;
    let off = () => {};
    let live = true;
    storeIdentify(uid).then(() => {
      if (!live) return;
      storePrices().then((p) => { if (live) setPrices(p); });
      off = onStoreChange((e) => { if (!live) return; setEntitled(e); if (e) refresh(); });
    });
    return () => { live = false; off(); };
  }, [uid, refresh]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') refresh(); });
    return () => sub.remove();
  }, [refresh]);
  useEffect(() => onPremiumRequired(onPaywall), [onPaywall]);

  // Mağazada üyelik etkin ama sunucu henüz güncellenmedi (webhook birkaç saniye sürer): kısıt gösterme
  const access = useMemo<Access | null>(() => (server && entitled && !member(server) && server.state !== 'unknown'
    ? { ...server, state: 'premium', full: true } : server), [server, entitled]);

  // Deneme bitti ve ödeme açık: günde bir kez açılışta üyelik ekranı
  useEffect(() => {
    if (access?.state !== 'expired' || !access.enforced) return;
    const today = todayISO();
    AsyncStorage.getItem(SHOWN_KEY).then((d) => {
      if (d === today) return;
      AsyncStorage.setItem(SHOWN_KEY, today).catch(() => {});
      onPaywall();
    }).catch(() => {});
  }, [access, onPaywall]);

  const allow = useCallback((f: Feature) => {
    if (!access || access.full) return true;
    if (f === 'task' && activeTaskCount(tasks) < access.limits.maxTasks) return true;
    if (f === 'child' && kids.length < access.limits.maxChildren) return true;
    requestPremium(featureText[f]);
    return false;
  }, [access, tasks, kids.length]);

  const value = useMemo(() => ({ access, refresh, refreshAfterPurchase, storeOn: storeEnabled, prices, allow }),
    [access, refresh, refreshAfterPurchase, prices, allow]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useBilling = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('BillingProvider eksik');
  return v;
};
