import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, Alert, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
  TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import FairyScene from '../components/FairyScene';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { IconButton } from '../components/ui';
import { useAuth, authErrorText } from '../lib/auth';
import { clearPendingInvite, getPendingInvite, normalizeCode, setPendingInvite } from '../lib/pendingInvite';
import { getPendingClinicInvite, isInviteToken, setPendingClinicInvite } from '../lib/clinicInvite';
import { InviteInfo, inviteInfo } from '../lib/clinic';

const MIN_PASSWORD = 8;
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

/* ---------- Ortak parçalar ---------- */

function Layout({ title, subtitle, onBack, children }: {
  title: string; subtitle?: string; onBack?: () => void; children: React.ReactNode;
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={{ height: 36, justifyContent: 'center' }}>
            {onBack && <IconButton name="chevron-back" label="Geri" onPress={onBack} />}
          </View>
          <Text style={styles.brand}>ParentApp</Text>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          <View style={{ gap: 12, marginTop: 24 }}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Input({ secure, ...props }: TextInputProps & { secure?: boolean }) {
  const [hidden, setHidden] = useState(true);
  return (
    <View style={styles.inputWrap}>
      <TextInput
        {...props}
        secureTextEntry={secure && hidden}
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
      {secure && (
        <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10} accessibilityLabel={hidden ? 'Şifreyi göster' : 'Şifreyi gizle'}>
          <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={18} color={colors.muted} />
        </Pressable>
      )}
    </View>
  );
}

function Cta({ label, onPress, busy }: { label: string; onPress: () => void; busy?: boolean }) {
  return (
    <Pressable style={[styles.cta, busy && { opacity: 0.7 }]} onPress={onPress} disabled={busy}>
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>{label}</Text>}
    </Pressable>
  );
}

function LinkText({ children, onPress }: { children: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={{ alignSelf: 'center', paddingVertical: 6 }}>
      <Text style={styles.link}>{children}</Text>
    </Pressable>
  );
}

function Sent({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.sent}>
      <Ionicons name={icon} size={22} color={colors.navy} />
      <Text style={{ flex: 1, fontSize: 13, color: colors.navy, lineHeight: 19 }}>{text}</Text>
    </View>
  );
}

/* ---------- Çocuk oturumu açık kalmış cihaz ----------
   ParentApp yalnızca ebeveyn uygulamasıdır (16 Ekim 2026). Çocuk giriş kodunu Pofi Adası oyununa yazar.
   Eski sürümden kalan çocuk (anonim) oturumu varsa yalnızca bu cihazda kapatılır; çocuğun oyun bağlantısı silinmez. */

export function ChildHomeScreen() {
  const { signOutLocal } = useAuth();
  return (
    <View style={{ flex: 1, backgroundColor: '#0E0B2E' }}>
      <StatusBar style="light" />
      <FairyScene />
      <SafeAreaView style={[fairy.content, { justifyContent: 'center' }]}>
        <View style={[fairy.card, { alignItems: 'center', gap: 12 }]}>
          <Text style={fairy.cardTitle}>ParentApp ebeveyn uygulamasıdır</Text>
          <Text style={{ color: '#E9E3FF', fontSize: 15, textAlign: 'center', lineHeight: 21 }}>
            Çocuğunun giriş kodu Pofi Adası oyununda kullanılır. Ebeveyn olarak devam etmek için giriş yap.
          </Text>
          <Pressable onPress={signOutLocal} style={[fairy.cta, { alignSelf: 'stretch' }]}>
            <Text style={fairy.ctaText}>Ebeveyn girişine geç</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

/* ---------- Ebeveyn girişi ---------- */

export function LoginScreen({ navigation }: any) {
  const { signIn, resendConfirmation } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!isEmail(email)) return Alert.alert('Geçerli bir e-posta adresi yaz.');
    if (!password) return Alert.alert('Şifreni yaz.');
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'email_not_confirmed') {
        Alert.alert('E-posta doğrulanmadı', authErrorText(e), [
          { text: 'Vazgeç', style: 'cancel' },
          {
            text: 'Tekrar gönder',
            onPress: () => resendConfirmation(email)
              .then(() => Alert.alert('Gönderildi', 'Doğrulama bağlantısını tekrar gönderdik.'))
              .catch((err) => Alert.alert('Gönderilemedi', authErrorText(err))),
          },
        ]);
      } else {
        Alert.alert('Giriş yapılamadı', authErrorText(e));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout title="Ebeveyn girişi" subtitle="Ailenin görevlerine kaldığın yerden devam et.">
      <Input value={email} onChangeText={setEmail} placeholder="E-posta" keyboardType="email-address"
        autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
      <Input value={password} onChangeText={setPassword} placeholder="Şifre" secure
        autoComplete="current-password" textContentType="password" onSubmitEditing={submit} />
      <Pressable onPress={() => navigation.navigate('Forgot', { email })} hitSlop={8} style={{ alignSelf: 'flex-end' }}>
        <Text style={styles.small}>Şifremi unuttum</Text>
      </Pressable>
      <Cta label="Giriş yap" onPress={submit} busy={busy} />
      <LinkText onPress={() => navigation.navigate('SignUp')}>Hesabın yok mu? Kayıt ol</LinkText>
      <InviteCode onSaved={(code) => navigation.navigate('SignUp', { code })} />
    </Layout>
  );
}

// Davet kodu: küçük bir bağlantı; dokununca tek satırlık kod kutusu açılır. Kod saklanır, kayıt ya da girişten sonra
// aileye otomatik katılınır (App.tsx → Main).
function InviteCode({ onSaved }: { onSaved: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  useEffect(() => { getPendingInvite().then((c) => { if (c) setCode(c); }); }, []);
  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)} hitSlop={8} style={{ alignSelf: 'center', paddingVertical: 4 }}>
        <Text style={styles.small}>Davet kodum var</Text>
      </Pressable>
    );
  }
  const save = async () => {
    if (code.length !== 6) return Alert.alert('Kod 6 karakter olmalı');
    await setPendingInvite(code);
    onSaved(code);
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center' }}>
      <TextInput value={code} onChangeText={(v) => setCode(normalizeCode(v))} placeholder="Davet kodu" autoCapitalize="characters"
        autoCorrect={false} placeholderTextColor={colors.muted} style={styles.codeInput} onSubmitEditing={save} />
      <Pressable onPress={save} hitSlop={8}><Text style={styles.link}>Devam</Text></Pressable>
    </View>
  );
}

/* ---------- Kayıt ---------- */

export function SignUpScreen({ navigation, route }: any) {
  const { signUp, resendConfirmation } = useAuth();
  const [invite, setInvite] = useState<string | undefined>(route.params?.code);
  useEffect(() => { if (!invite) getPendingInvite().then((c) => c && setInvite(c)); }, [invite]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | undefined>();
  // Uzman daveti: bağlantıdan gelen anahtar (bant) ya da elle yazılan uzman kodu (akislar.md 10 adım 5)
  const [clinicKey, setClinicKey] = useState<string | undefined>();
  const [clinic, setClinic] = useState<InviteInfo | null>(null);
  const [codeOpen, setCodeOpen] = useState(false);
  const [clinicCode, setClinicCode] = useState('');
  useEffect(() => {
    getPendingClinicInvite().then(async (k) => {
      if (!k) return;
      setClinicKey(k);
      if (isInviteToken(k)) setClinic(await inviteInfo(k));
    });
  }, []);

  const submit = async () => {
    if (!name.trim()) return Alert.alert('Adını yaz.');
    if (!isEmail(email)) return Alert.alert('Geçerli bir e-posta adresi yaz.');
    if (password.length < MIN_PASSWORD) return Alert.alert(`Şifre en az ${MIN_PASSWORD} karakter olmalı.`);
    if (codeOpen && clinicCode && clinicCode.length !== 6) return Alert.alert('Uzman kodu 6 karakter olmalı.');
    const key = clinicKey ?? (clinicCode.length === 6 ? clinicCode : undefined);
    setBusy(true);
    try {
      // Kayıttan sonra uygulama daveti yeniden bağlamayı dener (aynı aile için zararsız), sonra davet ekranını açar
      if (key) await setPendingClinicInvite(key);
      const { needsConfirmation } = await signUp(email, password, name, key);
      if (needsConfirmation) setSentTo(email.trim());
    } catch (e) {
      Alert.alert('Kayıt olunamadı', authErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (sentTo) {
    return (
      <Layout title="E-postanı kontrol et" onBack={() => navigation.navigate('Login')}>
        <Sent icon="mail-open-outline" text={`${sentTo} adresine hoş geldin e-postası gönderdik. İçindeki bağlantıya bu telefondan dokununca hesabın açılır.`} />
        <LinkText
          onPress={() => resendConfirmation(sentTo)
            .then(() => Alert.alert('Gönderildi', 'E-postayı tekrar gönderdik.'))
            .catch((e) => Alert.alert('Gönderilemedi', authErrorText(e)))}
        >
          E-posta gelmedi mi? Tekrar gönder
        </LinkText>
      </Layout>
    );
  }

  return (
    <Layout title="Kayıt ol" subtitle="Çocuklarına görev ata, gelişimlerini birlikte izleyin." onBack={() => navigation.goBack()}>
      {clinic?.status === 'open' && (
        <View style={styles.inviteBand} accessibilityRole="summary">
          <Ionicons name="medkit-outline" size={20} color={colors.navy} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.navy }}>{clinic.clinician || clinic.clinic} seni davet etti</Text>
            <Text style={styles.small}>{[clinic.title, clinic.clinic].filter(Boolean).join(' · ') || 'Kayıt olunca davet hazır olacak.'}</Text>
          </View>
        </View>
      )}
      {!!clinic && clinic.status !== 'open' && clinic.status !== 'error' && (
        <Text style={[styles.small, { color: colors.danger }]}>
          {clinic.status === 'expired' ? 'Davetin süresi doldu (48 saat). Kayıt olabilirsin; uzmanından yeni davet iste.'
            : clinic.status === 'not_found' ? 'Davet bulunamadı. Kayıt olabilirsin; uzmanından yeni davet iste.'
            : 'Bu davet kullanılmış. Kayıt olabilirsin; uzmanından yeni davet iste.'}
        </Text>
      )}
      <Input value={name} onChangeText={setName} placeholder="Adın" autoComplete="name" textContentType="name" />
      <Input value={email} onChangeText={setEmail} placeholder="E-posta" keyboardType="email-address"
        autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
      <Input value={password} onChangeText={setPassword} placeholder={`Şifre (en az ${MIN_PASSWORD} karakter)`} secure
        autoComplete="new-password" textContentType="newPassword" onSubmitEditing={submit} />
      {!!invite && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center' }}>
          <Text style={styles.small}>Davet kodu {invite} · kayıttan sonra aileye katılacaksın</Text>
          <Pressable onPress={() => { clearPendingInvite(); setInvite(undefined); }} hitSlop={8} accessibilityLabel="Davet kodunu kaldır">
            <Ionicons name="close-circle" size={16} color={colors.muted} />
          </Pressable>
        </View>
      )}
      {!clinicKey && (codeOpen ? (
        <Input value={clinicCode} onChangeText={(v) => setClinicCode(normalizeCode(v))} placeholder="Uzman kodu (6 karakter)"
          autoCapitalize="characters" autoCorrect={false} accessibilityLabel="Uzman kodu" />
      ) : (
        <LinkText onPress={() => setCodeOpen(true)}>Uzman kodum var</LinkText>
      ))}
      <Cta label="Kayıt ol" onPress={submit} busy={busy} />
      <LinkText onPress={() => navigation.navigate('Login')}>Zaten hesabın var mı? Giriş yap</LinkText>
    </Layout>
  );
}

/* ---------- Şifremi unuttum ---------- */

export function ForgotPasswordScreen({ navigation, route }: any) {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState<string>(route.params?.email ?? '');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!isEmail(email)) return Alert.alert('Geçerli bir e-posta adresi yaz.');
    setBusy(true);
    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch (e) {
      Alert.alert('Gönderilemedi', authErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout title="Şifremi unuttum" subtitle="E-posta adresine şifre yenileme bağlantısı gönderelim." onBack={() => navigation.goBack()}>
      {sent ? (
        <Sent icon="mail-open-outline" text={`${email.trim()} adresine bir bağlantı gönderdik. Bu telefondan bağlantıya dokun; uygulama açılınca yeni şifreni belirle.`} />
      ) : (
        <>
          <Input value={email} onChangeText={setEmail} placeholder="E-posta" keyboardType="email-address"
            autoCapitalize="none" autoComplete="email" textContentType="emailAddress" onSubmitEditing={submit} />
          <Cta label="Bağlantı gönder" onPress={submit} busy={busy} />
        </>
      )}
    </Layout>
  );
}

/* ---------- Yeni şifre (e-postadaki bağlantıdan gelinir) ---------- */

export function NewPasswordScreen() {
  const { updatePassword, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (password.length < MIN_PASSWORD) return Alert.alert(`Şifre en az ${MIN_PASSWORD} karakter olmalı.`);
    if (password !== again) return Alert.alert('Şifreler aynı değil.');
    setBusy(true);
    try {
      await updatePassword(password);
      Alert.alert('Şifren güncellendi');
    } catch (e) {
      Alert.alert('Şifre güncellenemedi', authErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout title="Yeni şifre belirle" subtitle="Hesabın için yeni bir şifre seç." onBack={signOut}>
      <Input value={password} onChangeText={setPassword} placeholder={`Yeni şifre (en az ${MIN_PASSWORD} karakter)`} secure
        autoComplete="new-password" textContentType="newPassword" />
      <Input value={again} onChangeText={setAgain} placeholder="Yeni şifre (tekrar)" secure
        autoComplete="new-password" textContentType="newPassword" onSubmitEditing={submit} />
      <Cta label="Şifreyi kaydet" onPress={submit} busy={busy} />
    </Layout>
  );
}

const fairy = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: 24 },
  brand: {
    fontSize: 54, fontWeight: '800', color: '#FFE6A3', letterSpacing: 1,
    textShadowColor: 'rgba(255,214,120,0.6)', textShadowRadius: 18, textShadowOffset: { width: 0, height: 0 },
  },
  tagline: { fontSize: 15, color: '#EDE6FF', marginTop: 6, opacity: 0.9 },
  card: {
    backgroundColor: 'rgba(22,16,58,0.55)', borderRadius: 28, padding: 22,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  cardTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
  boxes: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 18 },
  box: {
    width: 44, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)',
  },
  boxFilled: { backgroundColor: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,230,163,0.7)' },
  boxFocus: { borderColor: '#FFE6A3', borderWidth: 2 },
  boxText: { fontSize: 26, fontWeight: '800', color: '#FFFFFF' },
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  cta: {
    height: 56, borderRadius: 18, backgroundColor: '#FFD36E', alignItems: 'center', justifyContent: 'center', marginTop: 20,
    shadowColor: '#FFD36E', shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 4 },
  },
  ctaText: { fontSize: 17, fontWeight: '800', color: '#3B2300' },
  parent: { fontSize: 12, color: '#EDE6FF', opacity: 0.85, textAlign: 'center' },
});

const styles = StyleSheet.create({
  inviteBand: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: radius.md, padding: 14, borderWidth: 1, borderColor: colors.gold },
  codeInput: { width: 130, height: 38, borderRadius: radius.sm, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, paddingHorizontal: 10, fontSize: 15, fontWeight: '700', color: colors.navy, letterSpacing: 0, textAlign: 'center' },
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 24, paddingTop: 8, flexGrow: 1 },
  brand: { fontSize: 13, fontWeight: '700', color: colors.muted, letterSpacing: 1, marginTop: 28 },
  title: { fontSize: 24, fontWeight: '700', color: colors.navy, marginTop: 6 },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 6, lineHeight: 19 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: radius.sm,
    paddingHorizontal: 14,
  },
  input: { letterSpacing: 0, flex: 1, paddingVertical: 14, fontSize: 15, color: colors.navy },
  cta: { height: 52, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  link: { fontSize: 13, fontWeight: '600', color: colors.navy },
  small: { fontSize: 12, color: colors.muted },
  sent: { flexDirection: 'row', gap: 12, backgroundColor: '#fff', borderRadius: radius.md, padding: 16, alignItems: 'center' },
});
