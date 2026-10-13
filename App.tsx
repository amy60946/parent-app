import 'react-native-gesture-handler';
import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import './src/lib/webAlert';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
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
import {
  LoginScreen, SignUpScreen, ForgotPasswordScreen, NewPasswordScreen, ChildCodeScreen, ChildHomeScreen,
} from './src/screens/AuthScreens';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

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
  const { ready } = useStore();
  if (!ready) return <Loading />;
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={Tabs} />
      <Stack.Screen name="CreateTask" component={CreateTaskScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="TaskDetails" component={TaskDetailsScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Chat" component={ChatScreen} />
    </Stack.Navigator>
  );
}

function AuthFlow() {
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="ChildCode" component={ChildCodeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen name="Forgot" component={ForgotPasswordScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function Root() {
  const { session, loading, recovery, childLinking } = useAuth();
  if (loading) return <Loading />;
  // Çocuk oturumu (giriş koduyla açılan anonim oturum) ebeveyn paneline giremez
  if (session?.user.is_anonymous) return childLinking ? <Loading /> : <ChildHomeScreen />;
  if (recovery && session) return <NewPasswordScreen />;
  if (!session) return <AuthFlow />;
  return (
    <StoreProvider userId={session?.user.id ?? null}>
      <NavigationContainer theme={navTheme}>
        <StatusBar style="dark" />
        <Main />
      </NavigationContainer>
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
