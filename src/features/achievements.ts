// Проверка новых ачивок и очередь поздравлений.
import { ACHIEVEMENTS, evaluate, type Achievement } from '../core/achievements';
import { getActiveProgram, getSetting, listBody, listSessions, setSetting, setsBetween } from '../db/repo';
import { defsFor } from './session';
import type { Program } from '../core/program';

/** Сколько тренировок в неделю по программе */
export function weeklyGoal(p?: Program | null) {
  if (!p) return 3;
  if (p.schedule.type === 'weekly') return Math.max(1, Object.keys(p.schedule.days).length);
  const order = p.schedule.order;
  return Math.max(1, Math.round((order.filter((x) => x !== 'rest').length / order.length) * 7));
}

type Unlocked = Record<string, number>;

export function getUnlocked(): Unlocked {
  return getSetting<Unlocked>('achievements', {});
}


let queue: Achievement[] = [];
const listeners = new Set<() => void>();
export function subscribeQueue(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
export function peekQueue() {
  return queue[0] ?? null;
}
export function shiftQueue() {
  queue = queue.slice(1);
  listeners.forEach((l) => l());
}

/** Проверяет историю и показывает поздравления за новые ачивки */
export function checkAchievements() {
  const program = getActiveProgram();
  const defs = defsFor(program);
  const body = listBody().filter((b) => b.weight != null);
  const got = evaluate({
    sessions: listSessions(100000),
    sets: setsBetween(0),
    bodyWeight: body.length ? body[body.length - 1].weight : null,
    weeklyGoal: weeklyGoal(program?.program),
    primaryOf: (id) => defs.get(id)?.muscles.primary ?? [],
  });
  const u = getUnlocked();
  const fresh = ACHIEVEMENTS.filter((a) => got.has(a.id) && !u[a.id]);
  if (!fresh.length) return;
  const now = Date.now();
  for (const a of fresh) u[a.id] = now;
  setSetting('achievements', u);
  // Силовые первыми, они самые торжественные
  const order = { strength: 0, progress: 1, habit: 2 };
  queue = [...queue, ...fresh.sort((a, b) => order[a.group] - order[b.group])];
  listeners.forEach((l) => l());
}
