import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { migrate } from '../db/db';
import { seedIfEmpty } from '../db/repo';
import { ThemeProvider, useTheme } from '../theme';
import { FONTS } from '../theme/themes';
import { ToastHost } from '../ui/kit';
import { AchievementHost } from '../ui/AchievementHost';

// База готовится до первого кадра: все запросы синхронные и быстрые
migrate();
seedIfEmpty();
SplashScreen.preventAutoHideAsync().catch(() => {});

function Shell() {
  const t = useTheme();
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(t.c.bg).catch(() => {});
  }, [t]);
  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.c.bg }, animation: 'slide_from_right' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="workout/[id]" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
        <Stack.Screen name="library" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
      <ToastHost />
      <AchievementHost />
    </View>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts(FONTS);
  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);
  if (!loaded) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <Shell />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
