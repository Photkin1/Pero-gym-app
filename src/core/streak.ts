// Серия в неделях, как в Duolingo, но для зала: каждый день тренироваться вредно.
// Неделя засчитана, если сделано не меньше тренировок, чем стоит в программе.
// Заморозка: одна незачтённая неделя не обрывает серию, если за 4 недели до неё заморозок не было.

const DAY = 86400000;
const WEEK = 7 * DAY;

export function weekStart(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

export type Streak = {
  /** Сколько недель подряд выполнено (вместе с текущей, если она уже выполнена) */
  weeks: number;
  /** Тренировок на этой неделе и цель */
  thisWeek: number;
  goal: number;
  /** Текущая неделя уже засчитана */
  weekDone: boolean;
  /** Сколько заморозок потрачено внутри текущей серии */
  frozen: number;
  /** Заморозка сейчас доступна */
  freezeReady: boolean;
  /** Лучшая серия за всё время */
  best: number;
};

export function computeStreak(sessionTimes: number[], goal: number, now = Date.now()): Streak {
  const g = Math.max(1, goal);
  const counts = new Map<number, number>();
  for (const t of sessionTimes) counts.set(weekStart(t), (counts.get(weekStart(t)) ?? 0) + 1);
  const cur = weekStart(now);
  const thisWeek = counts.get(cur) ?? 0;
  const weekDone = thisWeek >= g;
  const ok = (w: number) => (counts.get(w) ?? 0) >= g;

  // Проходим недели от старой к новой и считаем серию с заморозками
  const first = sessionTimes.length ? weekStart(Math.min(...sessionTimes)) : cur;
  let run = 0;
  let best = 0;
  let frozen = 0;
  let lastFreeze = -Infinity;
  for (let w = first; w < cur; w += WEEK) {
    if (ok(w)) run++;
    else if (run > 0 && w - lastFreeze > 4 * WEEK) {
      // заморозка: серия не растёт, но и не сгорает
      lastFreeze = w;
      frozen++;
    } else {
      run = 0;
      frozen = 0;
    }
    best = Math.max(best, run);
  }
  const weeks = run + (weekDone ? 1 : 0);
  best = Math.max(best, weeks);
  return { weeks, thisWeek, goal: g, weekDone, frozen, freezeReady: cur - lastFreeze > 4 * WEEK, best };
}
