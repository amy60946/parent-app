import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabase';
import { unregisterPush } from './notifications';
import { storeLogOut } from './purchases';
import { errorText } from './errors';
import { clearPendingInvite } from './pendingInvite';
import { clearPendingClinicInvite } from './clinicInvite';
import { clearPendingGuestCode } from './guestPass';

// E-postadaki bağlantılar uygulamayı bu adresle açar:
// geliştirmede exp://…/--/auth (Expo Go), derlenmiş uygulamada parentapp://auth.
// Web sürümünde (site /app/, 4 Kasım 2026) aynı sayfaya döner; Supabase Auth › Redirect URLs'e https://<alan adı>/app/** eklenir.
export const authRedirectUrl = () =>
  Platform.OS === 'web' && typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : Linking.createURL('auth');

// Yeni kayıt işareti: ilk oturumda bir kez okunur ve silinir
const SIGNUP_KEY = 'after-signup';
const markJustSignedUp = () => AsyncStorage.setItem(SIGNUP_KEY, '1').catch(() => {});
export async function takeJustSignedUp(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(SIGNUP_KEY);
    if (v) await AsyncStorage.removeItem(SIGNUP_KEY);
    return v === '1';
  } catch { return false; }
}

type Auth = {
  session: Session | null;
  loading: boolean;
  recovery: boolean; // şifre yenileme bağlantısıyla gelindi: yeni şifre ekranı gösterilir
  passwordChange: boolean; // girişte şifre zayıf çıktı, kişi "Yenile" dedi: yeni şifre ekranı, Geri oturumu kapatmaz
  cancelPasswordChange: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, clinicInvite?: string) => Promise<{ needsConfirmation: boolean }>;
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
    // Sızdırılmış şifre koruması (ortak akislar.md 28, 24 Kasım 2026): nedeni pwned ise ayrı metin
    case 'weak_password': return ((e as { reasons?: string[] }).reasons ?? []).includes('pwned')
      ? 'Bu şifre başka sitelerdeki sızıntı listelerinde var. Güvenliğin için başka bir şifre seç.'
      : 'Şifre en az 8 karakter olmalı, harf ve rakam içermeli.';
    case 'same_password': return 'Yeni şifre eskisinden farklı olmalı.';
    case 'email_address_invalid':
    case 'validation_failed': return 'Geçerli bir e-posta adresi yaz.';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit': return 'Çok fazla deneme yapıldı. Biraz sonra tekrar dene.';
    case 'otp_expired':
    case 'flow_state_not_found':
    case 'flow_state_expired':
    case 'bad_code_verifier': return 'Bağlantının süresi dolmuş ya da daha önce kullanılmış. Uygulamadan yeniden iste.';
    // PKCE: bağlantı, isteğin başlatıldığı cihazda açılmalı (doğrulayıcı orada saklı)
    case 'pkce_code_verifier_not_found': return 'Bu bağlantıyı, isteği yaptığın cihazda aç. Başka bir cihazdaysan bağlantıyı buradan yeniden iste.';
    case 'link_invalid':
    case 'access_denied': return 'Bağlantı açılamadı. Uygulamadan yeniden iste.';
    case 'anonymous_provider_disabled': return 'Çocuk girişi henüz açık değil. Ebeveyninden Supabase ayarlarında "Anonymous Sign-Ins" seçeneğini açmasını iste.';
  }
  if (err?.code === 'unexpected_failure' || err?.message?.includes('Database error')) {
    return 'Sunucu hesabı oluşturamadı. Biraz sonra tekrar dene; sürerse bize bildir.';
  }
  if (err?.message?.includes('Invalid API key')) return 'Uygulamanın sunucu anahtarı geçersiz. Yeni bir TestFlight derlemesi gerekiyor.';
  if (err?.status === 429) return 'Çok fazla deneme yapıldı. Biraz sonra tekrar dene.';
  if (err?.message?.toLowerCase().includes('network')) return 'İnternet bağlantını kontrol et.';
  return errorText(err); // bilinmeyen hata: ham sunucu metni gösterilmez (güvenlik denetimi 22 Kasım 2026)
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

const ask = (title: string, message: string) => new Promise<boolean>((resolve) =>
  Alert.alert(title, message, [
    { text: 'Vazgeç', style: 'cancel', onPress: () => resolve(false) },
    { text: 'Devam et', onPress: () => resolve(true) },
  ], { cancelable: true, onDismiss: () => resolve(false) }));

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState(false);
  const [passwordChange, setPasswordChange] = useState(false);
  const [childLinking, setChildLinking] = useState(false);

  // E-posta bağlantısından gelen oturumu kur. Güvenlik (denetim 22 Kasım 2026): yalnız PKCE kodu (?code=) kabul edilir;
  // kod, isteği bu cihazda başlatırken saklanan doğrulayıcı olmadan oturuma çevrilemez. Başkasının hazırladığı bağlantı
  // (hazır access_token / refresh_token ya da token_hash) oturum açmaz. Bağlantıdaki hata açıklaması gösterilmez.
  const handleUrl = useCallback(async (url: string | null) => {
    if (!url) return;
    const p = urlParams(url);
    const isAuthLink = p.access_token || p.refresh_token || p.code || p.token_hash || p.error || p.error_code || p.error_description;
    if (!isAuthLink) return;
    // Web: bağlantıdaki anahtarlar adres çubuğunda ve geçmişte kalmasın
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.history.replaceState(null, '', window.location.pathname);

    if (p.error || p.error_code || p.error_description) {
      Alert.alert('Bağlantı açılamadı', authErrorText({ code: p.error_code || 'link_invalid' }));
      return;
    }
    if (!p.code) {
      Alert.alert('Bağlantı açılamadı', 'Bu bağlantı artık geçerli değil. Uygulamadan yeniden iste.');
      return;
    }
    // Açık bir hesap varken gelen bağlantı oturumu sessizce başka hesaba geçirmesin
    const before = (await supabase.auth.getSession()).data.session?.user;
    if (before && !before.is_anonymous) {
      const ok = await ask('Hesap değişsin mi?',
        `Şu an ${before.email} ile girişlisin. Bu bağlantı başka bir hesapla oturum açabilir. Bağlantıyı sen istemediysen Vazgeç'e dokun.`);
      if (!ok) return;
    }
    let redirect: string | null = null;
    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(p.code);
      if (error) throw error;
      if ((data as { redirectType?: string | null }).redirectType === 'recovery') redirect = 'recovery'; // PKCE akışında tür bağlantıda yazmaz
      const isRecovery = p.type === 'recovery' || redirect === 'recovery';
      if (isRecovery) setRecovery(true);
      // Önceden oturum yoksa kimin hesabına girildiğini göster; tanımıyorsa hemen çıkabilsin. Şifre yenilemede pencere
      // çıkmaz (kullanıcı geri bildirimi 10 Kasım 2026: "Yeni şifre belirle" ekranının üstünde anlamsız geliyordu):
      // kişi bağlantıyı kendisi istedi; hesap adresi yeni şifre ekranında yazar, "Geri" oturumu kapatır.
      if (!before && !isRecovery) {
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
      // Çıkışta mağaza (RevenueCat) kimliği de bırakılır; girişte BillingProvider logIn yapar
      // Bekleyen davet kodları da silinir: aynı cihazda sonra giren hesap öncekinin kodunu kullanmasın (güvenlik denetimi 22 Kasım 2026)
      if (event === 'SIGNED_OUT') { setRecovery(false); storeLogOut(); clearPendingInvite().catch(() => {}); clearPendingClinicInvite(); clearPendingGuestCode(); }
    });
    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => {
      data.subscription.unsubscribe();
      sub.remove();
    };
  }, [handleUrl]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    // Şifre bugünkü kurala uymuyorsa (sızıntı listesi, kısa) girişten sonra bir kez yenileme önerisi (akislar.md 28)
    if ((data as { weakPassword?: unknown } | null)?.weakPassword) {
      setTimeout(() => Alert.alert('Şifren güvenli değil', 'Şifren güvenli değil; yenilemek ister misin?', [
        { text: 'Şimdi değil', style: 'cancel' },
        { text: 'Yenile', onPress: () => setPasswordChange(true) },
      ]), 600);
    }
  }, []);

  // clinicInvite: uzman davet bağlantısı anahtarı ya da kodu; sunucu kayıtta daveti aileye bağlar (akislar.md 10 adım 5)
  const signUp = useCallback(async (email: string, password: string, name: string, clinicInvite?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name: name.trim(), ...(clinicInvite ? { clinic_invite: clinicInvite } : {}) }, emailRedirectTo: authRedirectUrl() },
    });
    if (error) throw error;
    // Kayıttan hemen sonra "Kodun var mı?" ekranı açılır (App.tsx → Main); onaylı e-postada bağlantıyla açılan ilk oturumda
    await markJustSignedUp();
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
    setPasswordChange(false);
  }, []);

  const signOut = useCallback(async () => {
    setRecovery(false);
    setPasswordChange(false);
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
    <Ctx.Provider value={{ session, loading, recovery, passwordChange, cancelPasswordChange: () => setPasswordChange(false), signIn, signUp, resendConfirmation, sendPasswordReset, updatePassword, signOut, signOutLocal, childSignIn, childLinking }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('AuthProvider eksik');
  return v;
};
