import 'react-native-gesture-handler';
import React from 'react';
import { View, ActivityIndicator, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import './src/lib/webAlert';
import { NavigationContainer, DefaultTheme, createNavigationContainerRef } from '@react-navigation/native';
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
  const { completions } = useStore();
  const { signOut } = useAuth();
  const pending = Object.values(completions).filter((s) => s === 'pending').length;
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
      <Tab.Screen name="Aile">{() => <FamilyScreen onLogout={signOut} />}</Tab.Screen>
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
  const { ready, joinFamily } = useStore();
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
  if (!ready) return <Loading />;
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={Tabs} />
      <Stack.Screen name="CreateTask" component={CreateTaskScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="TaskDetails" component={TaskDetailsScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Abc" component={AbcScreen} />
    </Stack.Navigator>
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

function Root() {
  const { session, loading, recovery, childLinking } = useAuth();
  if (loading) return <Loading />;
  // Eski sürümden kalan çocuk (anonim) oturumu ebeveyn paneline giremez; bilgi ekranı + ebeveyn girişine geçiş
  if (session?.user.is_anonymous) return childLinking ? <Loading /> : <ChildHomeScreen />;
  if (recovery && session) return <NewPasswordScreen />;
  if (!session) return <AuthFlow />;
  return (
    <StoreProvider userId={session?.user.id ?? null}>
      <NotificationsProvider userId={session.user.id}>
        <NavigationContainer theme={navTheme} ref={navRef}>
          <StatusBar style="dark" />
          <Main />
        </NavigationContainer>
      </NotificationsProvider>
    </StoreProvider>
  );
}

export default function App() {
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
