import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Access, fetchAccess, onPremiumRequired, requestPremium } from './lib/billing';
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
  abc: 'Zor an kaydı Premium üyelikte.',
};

type Billing = {
  access: Access | null;
  refresh: () => Promise<void>;
  // İzin varsa true; yoksa üyelik ekranını açar ve false döner
  allow: (f: Feature) => boolean;
};

const Ctx = createContext<Billing | null>(null);
const SHOWN_KEY = 'paywall-shown';

export const activeTaskCount = (tasks: ReturnType<typeof useStore>['tasks']) => {
  const today = todayISO();
  return tasks.filter((t) => (!t.endDate || t.endDate >= today) && (t.recurring || t.startDate >= today)).length;
};

export function BillingProvider({ children, onPaywall }: { children: React.ReactNode; onPaywall: (reason?: string) => void }) {
  const { familyId, tasks, children: kids } = useStore();
  const [access, setAccess] = useState<Access | null>(null);

  const refresh = useCallback(async () => { setAccess(await fetchAccess()); }, []);

  useEffect(() => { if (familyId) refresh(); }, [familyId, refresh]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') refresh(); });
    return () => sub.remove();
  }, [refresh]);
  useEffect(() => onPremiumRequired(onPaywall), [onPaywall]);

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

  const value = useMemo(() => ({ access, refresh, allow }), [access, refresh, allow]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useBilling = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('BillingProvider eksik');
  return v;
};
