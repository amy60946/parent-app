import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from './lib/supabase';
import { AppNotification, registerForPush, setBadge, toNotification } from './lib/notifications';

// Uygulama içi bildirim kutusu: sunucunun yazdığı satırlar (notifications) + Realtime ile anında yenileri
type Ctx = {
  items: AppNotification[];
  unread: number;
  markRead: (ids?: number[]) => void;
  remove: (id: number) => void;
  reload: () => Promise<void>;
};

const NotifCtx = createContext<Ctx | null>(null);

export function NotificationsProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const [items, setItems] = useState<AppNotification[]>([]);

  const reload = useCallback(async () => {
    const { data, error } = await supabase.from('notifications').select('*')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(100);
    if (!error && data) setItems(data.map(toNotification));
  }, [userId]);

  useEffect(() => {
    setItems([]);
    reload();
    registerForPush();
    const channel = supabase
      .channel(`notif:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (p) => {
        const n = toNotification(p.new);
        setItems((prev) => (prev.some((x) => x.id === n.id) ? prev : [n, ...prev]));
      })
      .subscribe();
    // Ön plana dönünce eşitle (arka plandayken kaçan olaylar)
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') reload(); });
    return () => { supabase.removeChannel(channel); sub.remove(); };
  }, [userId, reload]);

  const unread = useMemo(() => items.filter((n) => !n.readAt).length, [items]);
  useEffect(() => { setBadge(unread); }, [unread]);

  const markRead = useCallback((ids?: number[]) => {
    const at = new Date().toISOString();
    setItems((prev) => prev.map((n) => (!n.readAt && (!ids || ids.includes(n.id)) ? { ...n, readAt: at } : n)));
    supabase.rpc('mark_notifications_read', { p_ids: ids ?? null }).then(({ error }) => { if (error) reload(); });
  }, [reload]);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
    supabase.from('notifications').delete().eq('id', id).then(({ error }) => { if (error) reload(); });
  }, [reload]);

  return <NotifCtx.Provider value={{ items, unread, markRead, remove, reload }}>{children}</NotifCtx.Provider>;
}

export const useNotifications = () => {
  const v = useContext(NotifCtx);
  if (!v) throw new Error('NotificationsProvider eksik');
  return v;
};
