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
      title="Bir dahaki sefere haber verelim mi?"
      text={`${childName ?? 'Çocuğun'} bir görevi bitirince bildirim gönderelim. Onayı gecikmeden verirsin, ödülü de hemen ulaşır.`}
      primary="Evet, haber ver"
      onPrimary={() => answer(true)}
      secondary="Şimdi değil"
      onSecondary={() => answer(false)}
    />
  );
}
