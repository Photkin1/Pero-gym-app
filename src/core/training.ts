// Логика тренировок без привязки к интерфейсу и базе: прогрессия, разминка,
// расчётный максимум, объём по мышцам, расписание.
import type { ExerciseDef, Muscle, PlannedExercise, Program, Weekday } from './program.ts';
import { WEEKDAYS } from './program.ts';
import { parseRange, roundTo } from './units.ts';

export type SetKind = 'warmup' | 'work';
export type Side = 'both' | 'left' | 'right';

export type SetLog = {
  id: number;
  sessionId: number;
  exerciseId: string;
  variantId: string | null;
  position: number;
  setIndex: number;
  kind: SetKind;
  side: Side;
  weight: number | null;
  reps: number | null;
  durationS: number | null;
  rir: number | null;
  restPlannedS: number | null;
  restActualS: number | null;
  completedAt: number | null;
  note: string | null;
};

// ───────── Расчётный максимум ─────────

/** Формула Эпли с поправкой на RIR: повторения до отказа = reps + rir. Для 1 повторения без запаса возвращает сам вес. */
export function e1rm(weight: number, reps: number, rir = 0): number {
  const r = reps + Math.max(0, rir);
  if (weight <= 0 || r <= 0) return 0;
  if (r === 1) return weight;
  return weight * (1 + r / 30);
}

// ───────── Прогрессия ─────────

export type Suggestion = {
  weight: number | null;
  /** Шаг, на который предлагаем прибавить, если пора */
  bump: number;
  reason: 'first-time' | 'start-weight' | 'repeat' | 'increase' | 'reduce';
  text: string;
};

export function incrementFor(def: ExerciseDef | undefined, variantId: string | null, override?: number | null): number {
  if (override) return override;
  const v = def?.variants?.find((x) => x.id === variantId);
  return v?.increment ?? def?.increment ?? 2.5;
}

/**
 * Двойная прогрессия. Смотрим рабочие подходы прошлой тренировки с этим упражнением и вариантом.
 * Все подходы на верхней границе диапазона с запасом не меньше целевого → прибавляем вес.
 * Больше половины подходов ниже нижней границы → предлагаем снизить на шаг.
 */
const span = (r: { min: number; max: number }) => (r.min === r.max ? `${r.min}` : `${r.min}–${r.max}`);

export function suggestWeight(plan: PlannedExercise, last: SetLog[], increment: number, progression: 'double' | 'linear' | 'none' = 'double'): Suggestion {
  const work = last.filter((s) => s.kind === 'work' && s.weight != null && s.reps != null);
  const range = parseRange(plan.reps);
  const target = parseRange(plan.rir ?? 2);
  if (!work.length) {
    if (plan.start_weight != null) return { weight: plan.start_weight, bump: 0, reason: 'start-weight', text: 'Стартовый вес из программы' };
    return { weight: null, bump: 0, reason: 'first-time', text: `Подбери вес, чтобы сделать ${span(range)} повторений с запасом ${span(target)}` };
  }
  const top = Math.max(...work.map((s) => s.weight!));
  const atTop = work.filter((s) => s.weight === top);
  if (progression === 'none') return { weight: top, bump: 0, reason: 'repeat', text: 'Вес как в прошлый раз' };
  if (progression === 'linear') return { weight: top + increment, bump: increment, reason: 'increase', text: `Линейная прогрессия: +${increment} кг` };
  // Все рабочие подходы с максимальным весом на верхней границе и с нужным запасом.
  // Подходов с этим весом должно быть не меньше, чем по плану (если какой-то пропустил, не торопимся).
  const enoughSets = atTop.length >= plan.sets || atTop.length === work.length;
  const allTop = enoughSets && atTop.every((s) => s.reps! >= range.max && (s.rir ?? target.min) >= target.min);
  if (allTop) {
    return { weight: top + increment, bump: increment, reason: 'increase', text: `В прошлый раз все подходы по ${range.max}. Пора +${String(increment).replace('.', ',')} кг` };
  }
  const below = atTop.filter((s) => s.reps! < range.min).length;
  if (below > atTop.length / 2) {
    return { weight: Math.max(0, top - increment), bump: -increment, reason: 'reduce', text: `Прошлый раз меньше ${range.min} повторений. Можно снизить вес` };
  }
  return { weight: top, bump: 0, reason: 'repeat', text: `Тот же вес, добери повторения до ${range.max}` };
}

// ───────── Разминка ─────────

export const DEFAULT_WARMUP = [
  { percent: 50, reps: 8 },
  { percent: 70, reps: 4 },
  { percent: 85, reps: 2 },
];

/** Разминочные подходы от рабочего веса. Для лёгких весов (< 40 кг) не нужна. Штанга не легче грифа. */
export function warmupSets(workWeight: number, scheme = DEFAULT_WARMUP, step = 2.5, minBar = 20): { weight: number; reps: number }[] {
  if (workWeight < 40) return [];
  return scheme
    .map((s) => ({ weight: Math.max(minBar, roundTo((workWeight * s.percent) / 100, step)), reps: s.reps }))
    .filter((s, i, arr) => s.weight < workWeight && (i === 0 || s.weight > arr[i - 1].weight));
}

// ───────── Объём ─────────

/** Рабочие подходы на мышцу: основная мышца 1, вспомогательная 0,5. По одной стороне: пара Л+П = 1 подход. */
export function setsPerMuscle(sets: Pick<SetLog, 'exerciseId' | 'kind' | 'side'>[], defs: Map<string, ExerciseDef>): Map<Muscle, number> {
  const out = new Map<Muscle, number>();
  for (const s of sets) {
    if (s.kind !== 'work') continue;
    const d = defs.get(s.exerciseId);
    if (!d) continue;
    const w = s.side === 'both' ? 1 : 0.5;
    for (const m of d.muscles.primary) out.set(m, (out.get(m) ?? 0) + w);
    for (const m of d.muscles.secondary ?? []) out.set(m, (out.get(m) ?? 0) + w * 0.5);
  }
  return out;
}

/** Плановый недельный объём программы по мышцам */
export function plannedWeeklySets(p: Program, defs: Map<string, ExerciseDef>): Map<Muscle, number> {
  const counts = new Map<string, number>();
  if (p.schedule.type === 'weekly') for (const w of Object.values(p.schedule.days)) counts.set(w as string, (counts.get(w as string) ?? 0) + 1);
  else {
    const per = 7 / p.schedule.order.length;
    for (const w of p.schedule.order) if (w !== 'rest') counts.set(w, (counts.get(w) ?? 0) + per);
  }
  const out = new Map<Muscle, number>();
  for (const w of p.workouts) {
    const times = counts.get(w.id) ?? 0;
    for (const x of w.exercises) {
      const d = defs.get(x.exercise);
      if (!d) continue;
      for (const m of d.muscles.primary) out.set(m, (out.get(m) ?? 0) + x.sets * times);
      for (const m of d.muscles.secondary ?? []) out.set(m, (out.get(m) ?? 0) + x.sets * times * 0.5);
    }
  }
  return out;
}

export const MUSCLE_RU: Record<Muscle, string> = {
  chest: 'Грудь', lats: 'Широчайшие', upper_back: 'Середина спины', lower_back: 'Поясница', traps: 'Трапеции',
  front_delts: 'Передняя дельта', side_delts: 'Средняя дельта', rear_delts: 'Задняя дельта', biceps: 'Бицепс',
  triceps: 'Трицепс', forearms: 'Предплечья', quads: 'Квадрицепс', hamstrings: 'Бицепс бедра', glutes: 'Ягодицы',
  adductors: 'Приводящие', abductors: 'Отводящие', calves: 'Икры', abs: 'Пресс',
};

// ───────── Расписание ─────────

export const WEEKDAY_RU: Record<Weekday, string> = { mon: 'Пн', tue: 'Вт', wed: 'Ср', thu: 'Чт', fri: 'Пт', sat: 'Сб', sun: 'Вс' };

export function weekdayOf(d: Date): Weekday {
  return WEEKDAYS[(d.getDay() + 6) % 7];
}

/**
 * Какую тренировку делать следующей.
 * weekly: тренировка на сегодня, если сегодня по плану и ещё не сделана, иначе ближайшая по дням.
 * rotation: следующая по кругу после последней выполненной.
 */
export function nextWorkout(p: Program, lastWorkoutId: string | null, doneToday: boolean, now = new Date()): { workoutId: string; when: 'today' | Weekday | 'next' } | null {
  if (p.schedule.type === 'rotation') {
    const order = p.schedule.order.filter((x) => x !== 'rest');
    if (!order.length) return null;
    const i = lastWorkoutId ? p.schedule.order.indexOf(lastWorkoutId) : -1;
    for (let k = 1; k <= p.schedule.order.length; k++) {
      const cand = p.schedule.order[(i + k) % p.schedule.order.length];
      if (cand !== 'rest') return { workoutId: cand, when: 'next' };
    }
    return { workoutId: order[0], when: 'next' };
  }
  const days = p.schedule.days;
  const today = WEEKDAYS.indexOf(weekdayOf(now));
  for (let k = doneToday ? 1 : 0; k < 8; k++) {
    const wd = WEEKDAYS[(today + k) % 7];
    const w = days[wd];
    if (w) return { workoutId: w as string, when: k === 0 ? 'today' : wd };
  }
  return null;
}

/** Неделя программы (1, 2, ...) по дате первой тренировки — для вводных фаз и разгрузки */
export function programWeek(startedAt: number | null, now = Date.now()): number {
  if (!startedAt) return 1;
  return Math.floor((now - startedAt) / (7 * 86400000)) + 1;
}

export function phaseFor(p: Program, week: number): { rir?: string | number; setsFactor: number; label?: string } {
  const ph = p.phases?.find((x) => x.week === week);
  if (ph) return { rir: ph.rir, setsFactor: ph.sets_factor ?? 1, label: ph.note ?? `Неделя ${week}` };
  const every = p.deload?.every_weeks;
  if (every && week % every === 0) return { rir: p.deload?.rir ?? 3, setsFactor: p.deload?.sets_factor ?? 0.5, label: 'Разгрузочная неделя' };
  return { setsFactor: 1 };
}
