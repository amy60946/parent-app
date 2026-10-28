import 'react-native-gesture-handler';
import React from 'react';
import { Alert, AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import './src/lib/webAlert';
import { NavigationContainer, DefaultTheme, createNavigationContainerRef } from '@react-navigation/native';
import { startTracking, trackScreen } from './src/lib/track';
import { ClientConfigProvider } from './src/clientConfig';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { StoreProvider, useStore } from './src/store';
import { AuthProvider, useAuth, takeJustSignedUp } from './src/lib/auth';
import { colors } from './src/theme';
import TasksScreen from './src/screens/TasksScreen';
import ReviewScreen from './src/screens/ReviewScreen';
import MeScreen from './src/screens/MeScreen';
import CareScreen from './src/screens/CareScreen';
import ClinicianScreen from './src/screens/ClinicianScreen';
import GuestPassScreen from './src/screens/GuestPassScreen';
import IntakeScreen from './src/screens/IntakeScreen';
import Splash from './src/components/Splash';
import { guestRedeemedText } from './src/lib/guestPass';
import ProgressScreen from './src/screens/ProgressScreen';
import FamilyScreen from './src/screens/FamilyScreen';
import CreateTaskScreen from './src/screens/CreateTaskScreen';
import TaskDetailsScreen from './src/screens/TaskDetailsScreen';
import RoutineScreen from './src/screens/RoutineScreen';
import StonesScreen from './src/screens/StonesScreen';
import GiftShopScreen from './src/screens/GiftShopScreen';
import LegalUpdateScreen from './src/screens/LegalUpdateScreen';
import LegalDocsScreen from './src/screens/LegalDocsScreen';
import KvkkScreen from './src/screens/KvkkScreen';
import DeleteAccountScreen from './src/screens/DeleteAccountScreen';
import LegalTextScreen from './src/screens/LegalTextScreen';
import { afterModal, SCREEN_MODAL_GAP } from './src/lib/modal';
import { resetPlan } from './src/lib/plan';
import { acceptSignupConsent, legalPending } from './src/lib/legal';
import ChatScreen from './src/screens/ChatScreen';
import NotificationsScreen, { openNotification } from './src/screens/NotificationsScreen';
import AbcScreen from './src/screens/AbcScreen';
import PaywallScreen from './src/screens/PaywallScreen';
import RewardsScreen from './src/screens/RewardsScreen';
import InviteScreen from './src/screens/InviteScreen';
import CarePlanScreen from './src/screens/CarePlanScreen';
import * as Linking from 'expo-linking';
import { INVITE_FINAL, inviteErrorTitle, openInvite } from './src/lib/clinic';
import { hintOf } from './src/lib/errors';
import { clearPendingClinicInvite, getPendingClinicInvite, onClinicInvite, parseInviteUrl, setPendingClinicInvite } from './src/lib/clinicInvite';
import { BillingProvider } from './src/billing';
import Onboarding, { markOnboardingSeen, shouldShowOnboarding } from './src/components/Onboarding';
import CodeStep from './src/components/CodeStep';
import SetupScreen from './src/screens/SetupScreen';
import DeviceSetupScreen from './src/screens/DeviceSetupScreen';
import { SetupCtx, SetupEnd } from './src/setupContext';
import { completeSetup, setupDone } from './src/lib/intake';
import { track } from './src/lib/track';
import type { CodeResult } from './src/components/CodeEntry';
import { NotificationsProvider } from './src/notifications';
import { ParentTasksProvider } from './src/parentTasks';
import { onNotificationTap, shouldAskPush } from './src/lib/notifications';
import PushAsk from './src/components/PushAsk';
import { clearPendingInvite } from './src/lib/pendingInvite';
import {
  LoginScreen, SignUpScreen, ForgotPasswordScreen, NewPasswordScreen, ChildHomeScreen, WelcomeScreen, ExpertAskScreen, ExpertCodeScreen,
} from './src/screens/AuthScreens';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const navRef = createNavigationContainerRef<any>();

const navTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.bg } };

// Sekmeler (kullanıcı isteği 28 Ekim 2026, Joon "Me / Care" örneği): Ben (ana sayfa; İnceleme içinde) · Uzmanım · Görevler · Gelişim · Aile
const icons: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  Ben: ['home-outline', 'home'],
  Uzmanım: ['medkit-outline', 'medkit'],
  Görevler: ['list-outline', 'list'],
  Gelişim: ['stats-chart-outline', 'stats-chart'],
  Aile: ['people-outline', 'people'],
};

function Tabs() {
  const { completions, messages } = useStore();
  const { signOut } = useAuth();
  const pending = Object.values(completions).filter((s) => s === 'pending').length;
  const unread = messages.filter((m) => m.sender === 'child' && !m.readAt).length;
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.navy,
        tabBarInactiveTintColor: colors.faint,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarStyle: { borderTopColor: colors.line, borderTopWidth: 0.5, backgroundColor: '#fff' },
        tabBarIcon: ({ focused, color, size }) => (
          <Ionicons name={icons[route.name][focused ? 1 : 0]} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen
        name="Ben"
        component={MeScreen}
        options={{ tabBarBadge: pending || undefined, tabBarBadgeStyle: { backgroundColor: colors.gold, color: colors.navy } }}
      />
      <Tab.Screen name="Uzmanım" component={CareScreen} />
      <Tab.Screen name="Görevler" component={TasksScreen} />
      <Tab.Screen name="Gelişim" component={ProgressScreen} />
      <Tab.Screen name="Aile" options={{ tabBarBadge: unread || undefined, tabBarBadgeStyle: { backgroundColor: colors.gold, color: colors.navy } }}>
        {() => <FamilyScreen onLogout={signOut} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

// Yükleme: açılış ekranıyla aynı görünüm (yerel açılış görselinden fark edilmeden geçer)
const Loading = Splash;

function Main() {
  const { ready, children } = useStore();
  const { session } = useAuth();
  // İlk kurulum (kullanıcı kararları 27 Ekim 2026; ortak/sozlesme/akislar.md 16): bitmemişse uygulama "Setup" ile açılır.
  // Sunucuda kurulum alanı yoksa (öneri uygulanmadı) bitmiş sayılır ve aşağıdaki "Kodun var mı?" akışı sürer.
  const [setup, setSetup] = React.useState<'loading' | 'needed' | 'done'>('loading');
  const afterDevice = React.useRef(false);
  React.useEffect(() => {
    if (!ready || !session) return;
    setupDone(session.user.id).then((d) => setSetup(d ? 'done' : 'needed')).catch(() => setSetup('done'));
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps
  // Yasal metinler (hukuk/50 §1.1, §2; ortak proposed/20261027200000_legal.sql): kayıtta işaretlenen koşullar oturum açılınca
  // yazılır; ilk kurulum bittiyse açılışta ve öne gelişte güncellenen metin varsa yeniden onay ekranı. Pofi Adası metinleri
  // yalnız oyuna bağlı çocuğu olan veliye sorulur. Sunucuda işlev yoksa (null) hiçbir şey olmaz.
  const setupRef = React.useRef(setup);
  setupRef.current = setup;
  const kidsRef = React.useRef(children);
  kidsRef.current = children;
  React.useEffect(() => {
    if (!ready || !session) return;
    let live = true;
    const check = async () => {
      await acceptSignupConsent();
      if (!live || setupRef.current !== 'done' || !navRef.isReady() || navRef.getRootState()?.routes.some((r) => r.name === 'LegalUpdate')) return;
      const linked = kidsRef.current.filter((c) => c.linked);
      try {
        const [parent, child] = await Promise.all([legalPending('parent'), linked.length ? legalPending('child') : Promise.resolve([])]);
        if (!live || (!parent?.length && !child?.length)) return;
        navRef.navigate('LegalUpdate', { parent: parent ?? [], child: child ?? [], kids: linked.map((c) => c.name).join(', ') });
      } catch { /* ağ: bir sonraki açılışta */ }
    };
    check();
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') check(); });
    return () => { live = false; sub.remove(); };
  }, [ready, setup]); // eslint-disable-line react-hooks/exhaustive-deps
  const finishSetup = React.useCallback(async (how: SetupEnd) => {
    try { await completeSetup(); } catch (e) { Alert.alert('Kaydedilemedi', (e as Error).message); return; }
    await takeJustSignedUp(); // kurulum bitti: "Kodun var mı?" artık gösterilmez
    resetPlan(); // tanışma yanıtları kişisel plana yeniden okunur
    markOnboardingSeen();
    track('setup.done', { how });
    setSetup('done');
    if (!navRef.isReady()) return;
    if (how === 'children') {
      afterDevice.current = true;
      navRef.reset({ index: 1, routes: [{ name: 'Tabs' }, { name: 'DeviceSetup' }] });
    } else {
      navRef.reset({ index: 0, routes: [{ name: 'Tabs' }] });
    }
  }, []);
  // Yeni aile (bu cihazda ilk kez, henüz çocuk yok): önce "Kodun var mı?" (kullanıcı kararı 26 Ekim 2026, "B"),
  // sonra ilk kullanım rehberi. Uzman davetiyle gelen davetten dönünce kısa rehberi görür (oyun kodu · görev · onay);
  // eşinin ailesine katılan rehber görmez. Rehber Aile › Hesap › Nasıl kullanılır? ile yeniden açılır.
  const [guide, setGuide] = React.useState<false | 'full' | 'clinic' | 'short'>(false);
  // Rehber bitince bildirim ön sorusu (izin hiç sorulmadıysa); yoksa ilk incelemede sorulur
  const [pushAsk, setPushAsk] = React.useState(false);
  const endGuide = () => { setGuide(false); shouldAskPush().then((v) => v && afterModal(() => setPushAsk(true))); };
  const [codeStep, setCodeStep] = React.useState(false);
  const afterInvite = React.useRef(false);
  const childCount = React.useRef(children.length);
  childCount.current = children.length;
  React.useEffect(() => {
    if (!ready || setup !== 'done') return;
    let busy = false;
    // Uzman davet bağlantısı: daveti bu aileye bağla, hâlâ bekliyorsa davet ekranını aç (akislar.md 10 adım 5b)
    const claim = async (): Promise<boolean> => {
      const key = await getPendingClinicInvite();
      if (!key || busy) return false;
      busy = true;
      try {
        const r = await openInvite(key);
        await clearPendingClinicInvite();
        // Gezinme hazır olana kadar bekle (açılışta bağlantıyla gelindiyse); hazır olmazsa Görevler'deki bant hatırlatır
        for (let i = 0; i < 20 && !navRef.isReady(); i++) await new Promise((res) => setTimeout(res, 150));
        if (r.kind === 'pending' && navRef.isReady()) { navRef.navigate('Invite', { invite: r.invite }); return true; }
        if (r.kind === 'done') {
          Alert.alert('Bu daveti zaten kabul ettin', `${r.invite.clinician || r.invite.clinic} ile paylaşım Uzmanım sekmesinde.`);
        }
      } catch (e) {
        const hint = hintOf(e);
        if (hint && INVITE_FINAL.includes(hint)) await clearPendingClinicInvite();
        Alert.alert(hint ? inviteErrorTitle(hint) : 'Davet açılamadı', (e as Error).message);
      } finally {
        busy = false;
      }
      return false;
    };
    let fresh = false;
    (async () => {
      clearPendingInvite(); // eski sürümün giriş ekranındaki kod kutusu kalktı; kod artık "Kodun var mı?" ekranında
      const [signedUp, show] = await Promise.all([takeJustSignedUp(), shouldShowOnboarding()]);
      fresh = (signedUp || show) && childCount.current === 0;
      if (show && childCount.current > 0) markOnboardingSeen();
      const opened = await claim();
      if (!fresh) return;
      if (opened) afterInvite.current = true;
      else if (signedUp) setCodeStep(true); // kayıttan hemen sonra: "Kodun var mı?"
      else setGuide('full'); // kayıtlı hesap, bu cihazda ilk kez ve henüz çocuk yok
    })();
    return onClinicInvite(() => { claim().then((opened) => { if (opened && fresh) afterInvite.current = true; }); });
  }, [ready, setup === 'done']); // eslint-disable-line react-hooks/exhaustive-deps
  // Davet ekranından dönünce: çocuk eklendiyse kısa rehber, davet reddedildiyse tam rehber
  React.useEffect(() => navRef.addListener('state', () => {
    // Kurulumdan sonra cihaz ekranı kapanınca kısa rehber: görev ver · onayla
    // Rehber modal ekran kapanma animasyonu bitince açılır: kapanırken açılan pencere iOS'ta dokunuşları kilitleyebilir
    if (afterDevice.current && navRef.getCurrentRoute()?.name === 'Ben') {
      afterDevice.current = false;
      afterModal(() => setGuide('short'), SCREEN_MODAL_GAP);
      return;
    }
    if (!afterInvite.current) return;
    const route = navRef.getCurrentRoute()?.name;
    if (!route || route === 'Invite') return;
    afterInvite.current = false;
    afterModal(() => setGuide(childCount.current > 0 ? 'clinic' : 'full'), SCREEN_MODAL_GAP);
  }), []);
  const onCode = (r: CodeResult) => {
    setCodeStep(false);
    if (r.kind === 'invite') {
      afterInvite.current = true;
      afterModal(() => { if (navRef.isReady()) navRef.navigate('Invite', { invite: r.invite }); });
    } else if (r.kind === 'family') {
      markOnboardingSeen();
      Alert.alert('Aileye katıldın', 'Ailenin çocuklarını, görevlerini ve bildirimlerini artık görüyorsun.');
    } else if (r.kind === 'guest') {
      Alert.alert('Hediye kartı kullanıldı', guestRedeemedText(r.trialEndsAt));
      afterModal(() => setGuide('full'));
    } else {
      Alert.alert('Bu daveti zaten kabul ettin', `${r.invite.clinician || r.invite.clinic} ile paylaşım Uzmanım sekmesinde.`);
      afterModal(() => setGuide('full'));
    }
  };
  // Telefon bildirimine dokununca ilgili ekranı aç (uygulama kapalıyken açıldıysa da)
  React.useEffect(() => {
    if (!ready) return;
    return onNotificationTap((data) => {
      if (navRef.isReady()) openNotification(navRef, { kind: data.kind, data });
    });
  }, [ready]);
  const paywall = React.useCallback((reason?: string) => {
    if (navRef.isReady()) navRef.navigate('Paywall', { reason });
  }, []);
  if (!ready || setup === 'loading') return <Loading />;
  return (
    <BillingProvider onPaywall={paywall}>
    <SetupCtx.Provider value={{ finish: finishSetup }}>
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={setup === 'needed' ? 'Setup' : 'Tabs'}>
      <Stack.Screen name="Setup" component={SetupScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="DeviceSetup" component={DeviceSetupScreen} options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="Tabs" component={Tabs} />
      <Stack.Screen name="CreateTask" component={CreateTaskScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="TaskDetails" component={TaskDetailsScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Routine" component={RoutineScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Stones" component={StonesScreen} />
      <Stack.Screen name="GiftShop" component={GiftShopScreen} />
      <Stack.Screen name="LegalUpdate" component={LegalUpdateScreen} options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
      <Stack.Screen name="LegalDocs" component={LegalDocsScreen} />
      <Stack.Screen name="LegalText" component={LegalTextScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Kvkk" component={KvkkScreen} />
      <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Abc" component={AbcScreen} />
      <Stack.Screen name="Rewards" component={RewardsScreen} />
      <Stack.Screen name="Paywall" component={PaywallScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Invite" component={InviteScreen} options={{ presentation: 'modal', gestureEnabled: false }} />
      <Stack.Screen name="CarePlan" component={CarePlanScreen} />
      <Stack.Screen name="Review" component={ReviewScreen} />
      <Stack.Screen name="Clinician" component={ClinicianScreen} />
      <Stack.Screen name="GuestPass" component={GuestPassScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Intake" component={IntakeScreen} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
    <CodeStep visible={codeStep} onResult={onCode} onSkip={() => { setCodeStep(false); afterModal(() => setGuide('full')); }} />
    <Onboarding visible={!!guide} steps={guide === 'clinic' ? [1, 2, 3, 4] : guide === 'short' ? [2, 3, 4] : undefined} onClose={endGuide} />
    <PushAsk visible={pushAsk} onDone={() => setPushAsk(false)} />
    </SetupCtx.Provider>
    </BillingProvider>
  );
}

function AuthFlow() {
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {/* ParentApp yalnızca ebeveyn uygulaması (çocuk girişi Pofi Adası oyununda). Açılış: Başla / Hesabım var (27 Ekim 2026) */}
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="ExpertAsk" component={ExpertAskScreen} />
        <Stack.Screen name="ExpertCode" component={ExpertCodeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen name="Forgot" component={ForgotPasswordScreen} />
        <Stack.Screen name="LegalText" component={LegalTextScreen} options={{ presentation: 'modal' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// Kullanım kaydı: oturum açıkken başlar (kişisel veri yok; ortak/sozlesme/akislar.md 9)
function Tracking({ userId }: { userId: string }) {
  React.useEffect(() => startTracking(), [userId]);
  return null;
}

function Root() {
  const { session, loading, recovery, childLinking } = useAuth();
  if (loading) return <Loading />;
  // Eski sürümden kalan çocuk (anonim) oturumu ebeveyn paneline giremez; bilgi ekranı + ebeveyn girişine geçiş
  if (session?.user.is_anonymous) return childLinking ? <Loading /> : <ChildHomeScreen />;
  if (recovery && session) return <NewPasswordScreen />;
  if (!session) return <AuthFlow />;
  return (
    <ClientConfigProvider>
    <StoreProvider userId={session?.user.id ?? null}>
      <ParentTasksProvider>
      <NotificationsProvider userId={session.user.id}>
        <NavigationContainer theme={navTheme} ref={navRef}
          onReady={() => trackScreen(navRef.getCurrentRoute()?.name)}
          onStateChange={() => trackScreen(navRef.getCurrentRoute()?.name)}>
          <StatusBar style="dark" />
          <Tracking userId={session.user.id} />
          <Main />
        </NavigationContainer>
      </NotificationsProvider>
      </ParentTasksProvider>
    </StoreProvider>
    </ClientConfigProvider>
  );
}

export default function App() {
  // Uzman davet bağlantısı oturumdan bağımsız yakalanır: kayıt/giriş bitince Main bağlar
  React.useEffect(() => {
    const take = (url: string | null) => { const k = parseInviteUrl(url); if (k) setPendingClinicInvite(k); };
    Linking.getInitialURL().then(take);
    const sub = Linking.addEventListener('url', ({ url }) => take(url));
    return () => sub.remove();
  }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <Root />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
