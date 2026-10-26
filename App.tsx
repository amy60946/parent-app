import 'react-native-gesture-handler';
import React from 'react';
import { View, ActivityIndicator, Alert } from 'react-native';
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
import { AuthProvider, useAuth } from './src/lib/auth';
import { colors } from './src/theme';
import TasksScreen from './src/screens/TasksScreen';
import ReviewScreen from './src/screens/ReviewScreen';
import ProgressScreen from './src/screens/ProgressScreen';
import FamilyScreen from './src/screens/FamilyScreen';
import CreateTaskScreen from './src/screens/CreateTaskScreen';
import TaskDetailsScreen from './src/screens/TaskDetailsScreen';
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
import { NotificationsProvider } from './src/notifications';
import { onNotificationTap } from './src/lib/notifications';
import { clearPendingInvite, getPendingInvite } from './src/lib/pendingInvite';
import {
  LoginScreen, SignUpScreen, ForgotPasswordScreen, NewPasswordScreen, ChildHomeScreen,
} from './src/screens/AuthScreens';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const navRef = createNavigationContainerRef<any>();

const navTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.bg } };

const icons: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  Görevler: ['list-outline', 'list'],
  İnceleme: ['checkmark-circle-outline', 'checkmark-circle'],
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
      <Tab.Screen name="Görevler" component={TasksScreen} />
      <Tab.Screen
        name="İnceleme"
        component={ReviewScreen}
        options={{ tabBarBadge: pending || undefined, tabBarBadgeStyle: { backgroundColor: colors.gold, color: colors.navy } }}
      />
      <Tab.Screen name="Gelişim" component={ProgressScreen} />
      <Tab.Screen name="Aile" options={{ tabBarBadge: unread || undefined, tabBarBadgeStyle: { backgroundColor: colors.gold, color: colors.navy } }}>
        {() => <FamilyScreen onLogout={signOut} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <ActivityIndicator color={colors.navy} />
    </View>
  );
}

function Main() {
  const { ready, joinFamily, children } = useStore();
  // İlk kullanım rehberi: yalnız yeni aileye (henüz çocuk yok), bu cihazda bir kez. Aile › Hesap › Nasıl kullanılır? ile yeniden açılır.
  const [guide, setGuide] = React.useState(false);
  const hasChildren = children.length > 0;
  React.useEffect(() => {
    if (!ready) return;
    Promise.all([shouldShowOnboarding(), getPendingClinicInvite()]).then(([show, invite]) => {
      if (!show || invite) return; // uzman davetiyle gelen önce daveti görür
      if (hasChildren) markOnboardingSeen(); else setGuide(true);
    });
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps
  // Uzman davet bağlantısı: daveti bu aileye bağla ve davet ekranını aç (akislar.md 10 adım 5b)
  React.useEffect(() => {
    if (!ready) return;
    let busy = false;
    const claim = async () => {
      const key = await getPendingClinicInvite();
      if (!key || busy) return;
      busy = true;
      try {
        const r = await openInvite(key);
        await clearPendingClinicInvite();
        // Gezinme hazır olana kadar bekle (açılışta bağlantıyla gelindiyse); hazır olmazsa Görevler'deki bant hatırlatır
        for (let i = 0; i < 20 && !navRef.isReady(); i++) await new Promise((res) => setTimeout(res, 150));
        if (r.kind === 'pending' && navRef.isReady()) navRef.navigate('Invite', { invite: r.invite });
        if (r.kind === 'done') {
          Alert.alert('Bu daveti zaten kabul ettin', `${r.invite.clinician || r.invite.clinic} ile paylaşım Aile › Hesap › Uzmanım bölümünde.`);
        }
      } catch (e) {
        const hint = hintOf(e);
        if (hint && INVITE_FINAL.includes(hint)) await clearPendingClinicInvite();
        Alert.alert(hint ? inviteErrorTitle(hint) : 'Davet açılamadı', (e as Error).message);
      } finally {
        busy = false;
      }
    };
    claim();
    return onClinicInvite(() => { claim(); });
  }, [ready]);
  // Giriş ekranında davet kodu girildiyse: kayıt/giriş sonrası aileye otomatik katıl
  React.useEffect(() => {
    if (!ready) return;
    getPendingInvite().then(async (code) => {
      if (!code) return;
      await clearPendingInvite();
      try {
        await joinFamily(code);
        Alert.alert('Aileye katıldın', 'Artık ailenin görevlerini, çocuklarını ve bildirimlerini görüyorsun.');
      } catch (e) {
        Alert.alert('Aileye katılınamadı', `${(e as Error).message}\n\nAile > Hesap > Aileye katıl bölümünden tekrar deneyebilirsin.`);
      }
    });
  }, [ready, joinFamily]);
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
  if (!ready) return <Loading />;
  return (
    <BillingProvider onPaywall={paywall}>
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={Tabs} />
      <Stack.Screen name="CreateTask" component={CreateTaskScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="TaskDetails" component={TaskDetailsScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Abc" component={AbcScreen} />
      <Stack.Screen name="Rewards" component={RewardsScreen} />
      <Stack.Screen name="Paywall" component={PaywallScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Invite" component={InviteScreen} options={{ presentation: 'modal', gestureEnabled: false }} />
      <Stack.Screen name="CarePlan" component={CarePlanScreen} />
    </Stack.Navigator>
    <Onboarding visible={guide} onClose={() => setGuide(false)} />
    </BillingProvider>
  );
}

function AuthFlow() {
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {/* ParentApp yalnızca ebeveyn uygulaması: açılış ekranı ebeveyn girişi (çocuk girişi Pofi Adası oyununda) */}
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen name="Forgot" component={ForgotPasswordScreen} />
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
      <NotificationsProvider userId={session.user.id}>
        <NavigationContainer theme={navTheme} ref={navRef}
          onReady={() => trackScreen(navRef.getCurrentRoute()?.name)}
          onStateChange={() => trackScreen(navRef.getCurrentRoute()?.name)}>
          <StatusBar style="dark" />
          <Tracking userId={session.user.id} />
          <Main />
        </NavigationContainer>
      </NotificationsProvider>
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
