import { useEffect } from 'react';

// iOS'ta bir pencere (Modal ya da modal ekran) kapanma animasyonu bitmeden ikincisi açılırsa açılmaz ya da ekranın
// üstünde görünmez bir katman kalır ve hiçbir dokunuş çalışmaz (uygulama kapatılıp açılana dek). Ardışık pencereler
// arasında bu kadar beklenir. RN Modal kapanışı ~0,3 sn, modal ekran (native-stack) kapanışı ~0,5 sn.
export const MODAL_GAP = 450;
export const SCREEN_MODAL_GAP = 750;
export const afterModal = (fn: () => void, ms = MODAL_GAP) => { setTimeout(fn, ms); };

// Açık RN pencerelerinin (Modal) sayısı. iOS'ta bir Modal açıkken modal EKRAN (ör. Üyelik) açılamaz: istek sessizce
// yok sayılır ve kullanıcı "hiçbir şey olmadı" görür (geri bildirim 5 Kasım 2026, iPad: Aile › Çocuk ekle). Ekran açan
// her şey `whenNoModal` ile açık pencere kapanana (ve kapanma animasyonu bitene) kadar bekler.
let openModals = 0;
let waiting: (() => void)[] = [];
export function whenNoModal(fn: () => void) {
  if (openModals === 0) fn();
  else waiting.push(fn);
}
export function useModalOpen(visible: boolean) {
  useEffect(() => {
    if (!visible) return;
    openModals++;
    return () => {
      openModals = Math.max(0, openModals - 1);
      if (openModals === 0 && waiting.length) {
        const run = waiting; waiting = [];
        setTimeout(() => run.forEach((f) => f()), MODAL_GAP);
      }
    };
  }, [visible]);
}
