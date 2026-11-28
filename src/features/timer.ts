// Таймер отдыха. Запускается вручную. Время конца хранится как отметка времени,
// поэтому таймер не сбивается, если телефон заблокирован или приложение свернуто.
// В конце: уведомление со звуком (работает и в фоне) и вибрация.
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { updateSet } from '../db/repo';
import { hideRestNotification, showRestNotification } from '../../modules/rest-timer';

export type RestState = {
  /** Подход, после которого отдыхаем: в него запишем фактическое время отдыха */
  setId: number;
  label: string;
  plannedS: number;
  startedAt: number;
  endsAt: number;
  notificationId: string | null;
} | null;

let state: RestState = null;
// Если приложение закрыли посреди отдыха, уведомление таймера могло остаться: убираем при запуске
hideRestNotification();
const listeners = new Set<() => void>();
let ver = 0;
const emit = () => {
  ver++;
  listeners.forEach((l) => l());
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

let channelReady = false;
async function ensurePermission() {
  if (Platform.OS === 'android' && !channelReady) {
    // Новый канал: у старого 'rest' был короткий системный звук, а звук канала потом не поменять
    await Notifications.deleteNotificationChannelAsync('rest').catch(() => {});
    await Notifications.setNotificationChannelAsync('rest-end', {
      name: 'Конец отдыха',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'rest_end.wav',
      vibrationPattern: [0, 400, 200, 400, 200, 400],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
    channelReady = true;
  }
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

async function schedule(endsAt: number, label: string): Promise<string | null> {
  try {
    if (!(await ensurePermission())) return null;
    const seconds = Math.max(1, Math.round((endsAt - Date.now()) / 1000));
    return await Notifications.scheduleNotificationAsync({
      content: { title: 'Отдых закончился', body: `Следующий подход: ${label}`, sound: 'rest_end.wav' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, channelId: 'rest-end' },
    });
  } catch {
    return null;
  }
}
async function cancel(id: string | null) {
  if (id) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

let tick: ReturnType<typeof setInterval> | null = null;
let buzzed = false;
function ensureTick() {
  if (tick) return;
  tick = setInterval(() => {
    if (!state) return;
    if (!buzzed && Date.now() >= state.endsAt) {
      buzzed = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      // В шторке: время вышло, дальше считаем вверх без звука
      showRestNotification(state.endsAt, 'Отдых закончился', `Сверх отдыха · ${state.label}`, true);
      if (Platform.OS === 'web') webChime();
    }
    emit();
  }, 250);
}

export async function startRest(setId: number, plannedS: number, label: string) {
  if (state) await stopRest();
  const now = Date.now();
  state = { setId, label, plannedS, startedAt: now, endsAt: now + plannedS * 1000, notificationId: null };
  buzzed = false;
  ensureTick();
  emit();
  const id = await schedule(state.endsAt, label);
  // После schedule: там же спрашивается разрешение на уведомления
  if (state && state.setId === setId) showRestNotification(state.endsAt, 'Отдых', `Дальше: ${label}`, Date.now() >= state.endsAt);
  if (state && state.setId === setId) state = { ...state, notificationId: id };
}

export async function addRest(deltaS: number) {
  if (!state) return;
  const endsAt = Math.max(Date.now() + 1000, state.endsAt + deltaS * 1000);
  await cancel(state.notificationId);
  buzzed = Date.now() >= endsAt;
  state = { ...state, endsAt, plannedS: Math.round((endsAt - state.startedAt) / 1000), notificationId: null };
  emit();
  showRestNotification(endsAt, buzzed ? 'Отдых закончился' : 'Отдых', buzzed ? `Сверх отдыха · ${state.label}` : `Дальше: ${state.label}`, buzzed);
  const id = await schedule(endsAt, state.label);
  if (state) state = { ...state, notificationId: id };
}

/** Останавливает таймер и записывает фактический отдых в подход */
export async function stopRest() {
  if (!state) return;
  const s = state;
  state = null;
  emit();
  hideRestNotification();
  await cancel(s.notificationId);
  const actual = Math.round((Date.now() - s.startedAt) / 1000);
  updateSet(s.setId, { restActualS: actual, restPlannedS: s.plannedS });
  if (tick) {
    clearInterval(tick);
    tick = null;
  }
}

// Веб: уведомлений нет, поэтому звеним сами ~5 секунд, пока вкладка открыта
function webChime() {
  try {
    const AC = (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ac = new AC();
    const notes = [880, 1108.7, 1318.5];
    for (let r = 0; r < 5; r++)
      notes.forEach((f, i) => {
        const t0 = ac.currentTime + r + i * 0.13;
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.3, t0 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.8);
        o.connect(g).connect(ac.destination);
        o.start(t0);
        o.stop(t0 + 0.85);
      });
    setTimeout(() => ac.close().catch(() => {}), 5500);
  } catch {}
}

export function getRest() {
  return state;
}

const sub = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
/** Подписка на таймер: компонент перерисовывается 4 раза в секунду, пока идёт отдых */
export function useRest() {
  useSyncExternalStore(sub, () => ver);
  return state;
}
