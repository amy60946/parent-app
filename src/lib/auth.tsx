import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import * as Linking from 'expo-linking';
import type { Session, EmailOtpType } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabase';
import { unregisterPush } from './notifications';

// E-postadaki bağlantılar uygulamayı bu adresle açar:
// geliştirmede exp://…/--/auth (Expo Go), derlenmiş uygulamada parentapp://auth
export const authRedirectUrl = () => Linking.createURL('auth');

type Auth = {
  session: Session | null;
  loading: boolean;
  recovery: boolean; // şifre yenileme bağlantısıyla gelindi: yeni şifre ekranı gösterilir
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<{ needsConfirmation: boolean }>;
  resendConfirmation: (email: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signOutLocal: () => Promise<void>; // hesap silindikten sonra (sunucuda oturum kalmadı)
  childSignIn: (code: string) => Promise<ChildProfile>; // çocuk: giriş koduyla (anonim oturum)
  childLinking: boolean; // çocuk kodu bağlanırken true
};

export type ChildProfile = { child_id: string; family_id: string; name: string; avatar: string };

const Ctx = createContext<Auth | null>(null);

// Supabase hata kodlarını sade Türkçe mesajlara çevir
export function authErrorText(e: unknown): string {
  const err = e as { code?: string; message?: string; status?: number };
  // Derlemede sunucu adresi/anahtarı uygulamaya girmediyse her istek ağ hatası gibi görünür
  if (!isSupabaseConfigured) return 'Uygulama sunucuya bağlanacak şekilde derlenmemiş (Supabase anahtarı eksik). Yeni bir TestFlight derlemesi gerekiyor.';
  switch (err?.code) {
    case 'invalid_credentials': return 'E-posta ya da şifre hatalı.';
    case 'email_not_confirmed': return 'E-posta adresin henüz doğrulanmadı. Gelen kutunu kontrol et.';
    case 'user_already_exists':
    case 'email_exists': return 'Bu e-postayla zaten bir hesap var.';
    case 'weak_password': return 'Şifre çok zayıf. En az 8 karakter, harf ve rakam kullan.';
    case 'same_password': return 'Yeni şifre eskisinden farklı olmalı.';
    case 'email_address_invalid':
    case 'validation_failed': return 'Geçerli bir e-posta adresi yaz.';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit': return 'Çok fazla deneme yapıldı. Biraz sonra tekrar dene.';
    case 'otp_expired': return 'Bağlantının süresi dolmuş. Yeniden iste.';
    case 'anonymous_provider_disabled': return 'Çocuk girişi henüz açık değil. Ebeveyninden Supabase ayarlarında "Anonymous Sign-Ins" seçeneğini açmasını iste.';
  }
  if (err?.code === 'unexpected_failure' || err?.message?.includes('Database error')) {
    return 'Sunucu hesabı oluşturamadı. Biraz sonra tekrar dene; sürerse bize bildir.';
  }
  if (err?.message?.includes('Invalid API key')) return 'Uygulamanın sunucu anahtarı geçersiz. Yeni bir TestFlight derlemesi gerekiyor.';
  if (err?.status === 429) return 'Çok fazla deneme yapıldı. Biraz sonra tekrar dene.';
  if (err?.message?.toLowerCase().includes('network')) return 'İnternet bağlantını kontrol et.';
  return err?.message || 'Bir şeyler ters gitti. Tekrar dene.';
}

// URL'nin hem ?sorgu hem #parça kısmındaki parametreleri oku
function urlParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const [beforeHash, hash = ''] = url.split('#');
  const query = beforeHash.split('?')[1] ?? '';
  [query, hash].forEach((part) =>
    part.split('&').forEach((kv) => {
      if (!kv) return;
      const [k, v = ''] = kv.split('=');
      out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
    }),
  );
  return out;
}

// Bağlantıdaki erişim anahtarının e-postası (yalnız göstermek için; doğrulamayı sunucu yapar)
function tokenEmail(token: string): string | undefined {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(globalThis.atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), '='))).email;
  } catch {
    return undefined;
  }
}

const ask = (title: string, message: string) => new Promise<boolean>((resolve) =>
  Alert.alert(title, message, [
    { text: 'Vazgeç', style: 'cancel', onPress: () => resolve(false) },
    { text: 'Devam et', onPress: () => resolve(true) },
  ], { cancelable: true, onDismiss: () => resolve(false) }));

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState(false);
  const [childLinking, setChildLinking] = useState(false);

  // E-posta bağlantısından gelen oturumu kur
  const handleUrl = useCallback(async (url: string | null) => {
    if (!url) return;
    const p = urlParams(url);
    const isAuthLink = p.access_token || p.code || p.token_hash || p.error || p.error_description;
    if (!isAuthLink) return;

    if (p.error || p.error_description) {
      Alert.alert('Bağlantı açılamadı', p.error_code === 'otp_expired'
        ? 'Bağlantının süresi dolmuş ya da daha önce kullanılmış. Yeniden iste.'
        : p.error_description || 'Bağlantı geçersiz.');
      return;
    }
    // Güvenlik: başkasının gönderdiği bir bağlantı oturumu sessizce başka hesaba geçirmesin
    const before = (await supabase.auth.getSession()).data.session?.user;
    const target = p.access_token ? tokenEmail(p.access_token) : undefined;
    if (before && !before.is_anonymous && (!target || target.toLowerCase() !== (before.email ?? '').toLowerCase())) {
      const ok = await ask('Hesap değişsin mi?',
        `Şu an ${before.email} ile girişlisin. Bu bağlantı ${target ?? 'başka bir hesapla'} oturum açar. Bağlantıyı sen istemediysen Vazgeç'e dokun.`);
      if (!ok) return;
    }
    try {
      if (p.access_token && p.refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token: p.access_token, refresh_token: p.refresh_token });
        if (error) throw error;
      } else if (p.token_hash && p.type) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: p.token_hash, type: p.type as EmailOtpType });
        if (error) throw error;
      } else if (p.code) {
        const { error } = await supabase.auth.exchangeCodeForSession(p.code);
        if (error) throw error;
      }
      if (p.type === 'recovery') setRecovery(true);
      // Önceden oturum yoksa kimin hesabına girildiğini göster; tanımıyorsa hemen çıkabilsin
      if (!before) {
        const email = (await supabase.auth.getSession()).data.session?.user.email;
        if (email) {
          Alert.alert('Giriş yapıldı', `${email} hesabıyla giriş yapıldı.`, [
            { text: 'Bu ben değilim', style: 'destructive', onPress: () => { supabase.auth.signOut(); } },
            { text: 'Tamam' },
          ]);
        }
      }
    } catch (e) {
      Alert.alert('Bağlantı açılamadı', authErrorText(e));
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') setRecovery(false);
    });
    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => {
      data.subscription.unsubscribe();
      sub.remove();
    };
  }, [handleUrl]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name: name.trim() }, emailRedirectTo: authRedirectUrl() },
    });
    if (error) throw error;
    // E-posta onayı açıkken (önerilen) oturum, hoş geldin e-postasındaki bağlantıyla açılır.
    return { needsConfirmation: !data.session };
  }, []);

  const resendConfirmation = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup', email: email.trim(), options: { emailRedirectTo: authRedirectUrl() },
    });
    if (error) throw error;
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: authRedirectUrl() });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    setRecovery(false);
  }, []);

  const signOut = useCallback(async () => {
    setRecovery(false);
    await unregisterPush().catch(() => {}); // bu telefona artık bu hesabın bildirimi gitmesin
    const { error } = await supabase.auth.signOut();
    // Ağ yoksa bile yerel oturumu kapat
    if (error) await supabase.auth.signOut({ scope: 'local' });
  }, []);

  const signOutLocal = useCallback(async () => {
    setRecovery(false);
    await supabase.auth.signOut({ scope: 'local' });
  }, []);

  // Çocuk girişi: anonim oturum aç, sonra kodu bu oturuma bağla. Kod geçersizse
  // oturum kapatılır; ebeveyn uygulaması hiçbir zaman anonim oturumla açılmaz.
  const childSignIn = useCallback(async (code: string) => {
    setChildLinking(true);
    try {
      const { data: current } = await supabase.auth.getSession();
      if (!current.session) {
        const { error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
      }
      const { data, error } = await supabase.rpc('redeem_child_code', { p_code: code.trim().toUpperCase() });
      if (error) {
        await supabase.auth.signOut({ scope: 'local' });
        throw new Error(error.message.includes('geçersiz') ? 'Bu kod geçersiz ya da süresi dolmuş. Ebeveyninden yeni kod iste.' : error.message);
      }
      return data as ChildProfile;
    } finally {
      setChildLinking(false);
    }
  }, []);

  return (
    <Ctx.Provider value={{ session, loading, recovery, signIn, signUp, resendConfirmation, sendPasswordReset, updatePassword, signOut, signOutLocal, childSignIn, childLinking }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('AuthProvider eksik');
  return v;
};
