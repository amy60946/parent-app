import React from 'react';
import Dialog from './Dialog';
import { notePushAsked, registerForPush } from '../lib/notifications';
import { track } from '../lib/track';

// Bildirim izni ön sorusu (kullanıcı isteği 27 Ekim 2026): sistem penceresinden önce, bağlamıyla.
// "Evet" → sistem izni sorulur; "Şimdi değil" → 3 gün sonra bir kez daha (lib/notifications shouldAskPush).
export default function PushAsk({ visible, childName, onDone }: { visible: boolean; childName?: string; onDone: () => void }) {
  const answer = async (yes: boolean) => {
    onDone();
    track('push.ask', { yes });
    await notePushAsked();
    if (yes) await registerForPush(true);
  };
  return (
    <Dialog
      visible={visible}
      icon="phone-portrait-outline"
      badge="notifications"
      // Kısa metin (kullanıcı isteği 3 Kasım 2026; ana fikir aynı)
      title="Haber verelim mi?"
      text={`${childName ?? 'Çocuğun'} görevi bitirince bildirim gelsin; hemen onayla, ödülü gecikmesin.`}
      primary="Evet, haber ver"
      onPrimary={() => answer(true)}
      secondary="Şimdi değil"
      onSecondary={() => answer(false)}
    />
  );
}
