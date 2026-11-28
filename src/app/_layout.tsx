import { useCallback, useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { migrate, prepareDb } from '../db/db';
import { patchBundledPrograms, patchUpperB, seedIfEmpty } from '../db/repo';
import { ThemeProvider, useTheme } from '../theme';
import { FONTS } from '../theme/themes';
import { ToastHost } from '../ui/kit';
import { AchievementHost } from '../ui/AchievementHost';
import { Intro, isNewYearSeason } from '../ui/Intro';
import { Snow } from '../ui/Snow';
import { ProfileSetup, profileDone } from '../ui/ProfileSetup';

// База готовится до первого кадра: все запросы синхронные и быстрые.
// В веб-версии сначала ждём, пока загрузится SQLite-воркер.
let dbReady = false;
let dbError: string | null = null;
const dbPromise = prepareDb()
  .then(() => {
    migrate();
    seedIfEmpty();
    patchBundledPrograms();
    patchUpperB();
    dbReady = true;
  })
  .catch((e: unknown) => {
    dbError = String((e as Error)?.message ?? e);
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
  const [fail, setFail] = useState<string | null>(null);
  useEffect(() => {
    if (ready) return;
    dbPromise.then(() => (dbError ? setFail(dbError) : setReady(true)));
    // Если база так и не открылась (например, браузер без нужных функций), не оставляем белый экран
    const tm = setTimeout(() => !dbReady && setFail(dbError ?? 'База данных не открылась за 25 секунд'), 25000);
    return () => clearTimeout(tm);
  }, [ready]);
  const [intro, setIntro] = useState(true);
  const endIntro = useCallback(() => setIntro(false), []);
  const [profile, setProfile] = useState(false);
  useEffect(() => {
    if (ready) setProfile(!profileDone());
  }, [ready]);
  useEffect(() => {
    if (loaded && ready) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, ready]);
  if (fail && !ready) return <StartError text={fail} />;
  if (!loaded || !ready) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <Shell />
          {profile && !intro && <ProfileSetup onDone={() => setProfile(false)} />}
          {intro && <Intro onDone={endIntro} />}
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function StartError({ text }: { text: string }) {
  const web = Platform.OS === 'web';
  const ua = web && typeof navigator !== 'undefined' ? navigator.userAgent : '';
  // Встроенные браузеры: Telegram и другие на iPhone не поддерживают service worker, без него нет нужной изоляции
  const noSW = web && typeof navigator !== 'undefined' && !('serviceWorker' in navigator && navigator.serviceWorker);
  const inApp = web && (noSW || /Telegram|Instagram|FBAN|FBAV|VKClient|Line\//i.test(ua)) && /SharedArrayBuffer/.test(text);
  const isolated = web && typeof globalThis !== 'undefined' ? String((globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated) : '-';
  return (
    <View style={{ flex: 1, backgroundColor: '#121316', padding: 28, justifyContent: 'center', gap: 14 }}>
      <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>{inApp ? 'Открой в Safari или Chrome' : 'Pero не смог запуститься'}</Text>
      <Text style={{ color: '#c9ccd3', fontSize: 15, lineHeight: 21 }}>
        {inApp
          ? 'Ссылка открылась внутри другого приложения (Telegram, Instagram и т. п.). Там не работает хранилище, которое нужно Pero. Нажми «…» или «Открыть в браузере», а на iPhone потом «Поделиться» → «На экран Домой».'
          : web
            ? 'Скорее всего, Pero открыт ещё в одной вкладке. Закрой лишние вкладки и нажми «Обновить». Если не помогло, пришли этот экран разработчику.'
            : 'Перезапусти приложение. Если не помогло, пришли этот экран разработчику.'}
      </Text>
      {web && (
        <Text onPress={() => (globalThis as { location?: Location }).location?.reload()} style={{ color: '#fff', backgroundColor: '#2f5bff', alignSelf: 'flex-start', paddingHorizontal: 18, paddingVertical: 11, borderRadius: 12, fontSize: 15, fontWeight: '700', overflow: 'hidden' }}>
          Обновить
        </Text>
      )}
      <Text style={{ color: '#8d93a0', fontSize: 12.5 }} selectable>{`${text}\nisolated: ${isolated}\n${web && typeof navigator !== 'undefined' ? navigator.userAgent : ''}`}</Text>
    </View>
  );
}
