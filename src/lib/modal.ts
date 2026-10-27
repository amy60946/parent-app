// iOS'ta bir pencere (Modal ya da modal ekran) kapanma animasyonu bitmeden ikincisi açılırsa açılmaz ya da ekranın
// üstünde görünmez bir katman kalır ve hiçbir dokunuş çalışmaz (uygulama kapatılıp açılana dek). Ardışık pencereler
// arasında bu kadar beklenir. RN Modal kapanışı ~0,3 sn, modal ekran (native-stack) kapanışı ~0,5 sn.
export const MODAL_GAP = 450;
export const SCREEN_MODAL_GAP = 750;
export const afterModal = (fn: () => void, ms = MODAL_GAP) => { setTimeout(fn, ms); };
