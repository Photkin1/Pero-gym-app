import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { migrate, prepareDb } from '../db/db';
import { patchBundledPrograms, seedIfEmpty } from '../db/repo';
import { ThemeProvider, useTheme } from '../theme';
import { FONTS } from '../theme/themes';
import { ToastHost } from '../ui/kit';
import { AchievementHost } from '../ui/AchievementHost';
import { Intro, isNewYearSeason } from '../ui/Intro';
import { Snow } from '../ui/Snow';

// База готовится до первого кадра: все запросы синхронные и быстрые.
// В веб-версии сначала ждём, пока загрузится SQLite-воркер.
let dbReady = false;
const dbPromise = prepareDb().then(() => {
  migrate();
  seedIfEmpty();
  patchBundledPrograms();
  dbReady = true;
});
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
      {t.dark && isNewYearSeason() && <Snow />}
      <ToastHost />
      <AchievementHost />
    </View>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts(FONTS);
  const [ready, setReady] = useState(dbReady);
  useEffect(() => {
    if (!ready) dbPromise.then(() => setReady(true));
  }, [ready]);
  const [intro, setIntro] = useState(true);
  const endIntro = useCallback(() => setIntro(false), []);
  useEffect(() => {
    if (loaded && ready) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, ready]);
  if (!loaded || !ready) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <Shell />
          {intro && <Intro onDone={endIntro} />}
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
