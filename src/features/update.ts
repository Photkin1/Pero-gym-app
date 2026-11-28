// Проверка обновлений для APK, который ставится с сайта (не из Play Маркета).
// CI кладёт на сайт version.json с номером сборки и вшивает тот же номер в приложение (extra.build).
// Если на сайте номер больше, показываем плашку; по тапу скачивается новый APK и Android предлагает обновить.
import { useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';

const SITE = 'https://photkin1.github.io/Pero-gym-app';
export const APK_URL = `${SITE}/pero.apk`;

export function currentBuild(): number {
  const b = Number((Constants.expoConfig?.extra as { build?: unknown } | undefined)?.build);
  return Number.isFinite(b) ? b : 0;
}

export type UpdateInfo = { build: number; date?: string };

export async function checkUpdate(): Promise<UpdateInfo | null> {
  // Веб-версия всегда свежая; сборка без номера (локальная разработка) не проверяет
  if (Platform.OS !== 'android' || currentBuild() === 0) return null;
  try {
    const res = await fetch(`${SITE}/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const info = (await res.json()) as UpdateInfo;
    return Number(info.build) > currentBuild() ? info : null;
  } catch {
    return null; // нет сети — молча пропускаем
  }
}

export function useUpdate() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  useEffect(() => {
    let alive = true;
    checkUpdate().then((i) => alive && setInfo(i));
    return () => {
      alive = false;
    };
  }, []);
  return info;
}

export function installUpdate() {
  return Linking.openURL(APK_URL);
}
