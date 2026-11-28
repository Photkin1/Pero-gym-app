// Ачивки и уровни. Чистая логика: на вход вся история, на выход список полученных ачивок.
// Добавить ачивку = добавить объект в ACHIEVEMENTS.
import { e1rm, type SetLog } from './training.ts';
import { computeStreak } from './streak.ts';

export type AchSession = { id: number; startedAt: number; finishedAt: number | null; mood: number | null; note: string | null; tonnage: number };
export type AchSet = SetLog & { startedAt: number };
export type AchContext = { sessions: AchSession[]; sets: AchSet[]; bodyWeight: number | null; weeklyGoal: number; primaryOf: (exerciseId: string) => string[] };

export type Achievement = {
  id: string;
  title: string;
  desc: string;
  /** Группа для экрана ачивок */
  group: 'habit' | 'progress' | 'strength';
  check: (c: AchContext) => boolean;
};

const work = (c: AchContext) => c.sets.filter((s) => s.kind === 'work' && s.completedAt);
/** Максимальный вес в упражнениях из списка (для гантелей — вес одной) */
const maxWeight = (c: AchContext, ids: string[]) => Math.max(0, ...work(c).filter((s) => ids.includes(s.exerciseId) && s.reps && s.reps >= 1).map((s) => s.weight ?? 0));
const weightAch = (id: string, title: string, desc: string, ids: string[], kg: number): Achievement => ({
  id, title, desc, group: 'strength', check: (c) => maxWeight(c, ids) >= kg,
});

const BENCH = ['bench-press'];
const SQUAT = ['squat', 'hack-squat'];
const DEAD = ['deadlift', 'romanian-deadlift'];
const OHP = ['overhead-press'];
const CURL = ['barbell-curl', 'incline-db-curl', 'hammer-curl', 'preacher-curl', 'cable-curl'];

function weekStreak(c: AchContext) {
  return computeStreak(c.sessions.map((s) => s.startedAt), c.weeklyGoal).best;
}

function prCount(c: AchContext) {
  const best = new Map<string, number>();
  let n = 0;
  for (const s of [...work(c)].sort((a, b) => a.startedAt - b.startedAt)) {
    if (!s.weight || !s.reps) continue;
    const k = `${s.exerciseId}|${s.variantId}`;
    const e = e1rm(s.weight, s.reps, s.rir ?? 0);
    const prev = best.get(k);
    if (prev !== undefined && e > prev + 0.01) n++;
    if (prev === undefined || e > prev) best.set(k, e);
  }
  return n;
}

function bestGain(c: AchContext) {
  const first = new Map<string, number>();
  const top = new Map<string, number>();
  for (const s of [...work(c)].sort((a, b) => a.startedAt - b.startedAt)) {
    if (!s.weight || !s.reps) continue;
    const k = `${s.exerciseId}|${s.variantId}`;
    const e = e1rm(s.weight, s.reps, s.rir ?? 0);
    if (!first.has(k)) first.set(k, e);
    top.set(k, Math.max(top.get(k) ?? 0, e));
  }
  return Math.max(0, ...[...top.entries()].map(([k, v]) => v - (first.get(k) ?? v)));
}

export const ACHIEVEMENTS: Achievement[] = [
  // Привычка — доступны всем с первого дня
  { id: 'first', group: 'habit', title: 'Блин комом', desc: 'Первая тренировка. Самое сложное позади: ты пришёл', check: (c) => c.sessions.length >= 1 },
  { id: 'ten', group: 'habit', title: 'Втянулся', desc: '10 тренировок. Это уже не случайность', check: (c) => c.sessions.length >= 10 },
  { id: 'fifty', group: 'habit', title: 'Постоялец', desc: '50 тренировок. Администратор здоровается первым', check: (c) => c.sessions.length >= 50 },
  { id: 'hundred', group: 'habit', title: 'Часть интерьера', desc: '100 тренировок. Тебя пора вносить в инвентарь зала', check: (c) => c.sessions.length >= 100 },
  { id: 'streak4', group: 'habit', title: 'Железная дисциплина', desc: '4 недели подряд по плану', check: (c) => weekStreak(c) >= 4 },
  { id: 'streak12', group: 'habit', title: 'Режим терминатора', desc: '12 недель подряд по плану', check: (c) => weekStreak(c) >= 12 },
  { id: 'owl', group: 'habit', title: 'Ночной качок', desc: 'Тренировка после 22:00. Соседи по общаге спят, а ты нет', check: (c) => c.sessions.some((s) => new Date(s.startedAt).getHours() >= 22) },
  { id: 'lark', group: 'habit', title: 'Раньше петухов', desc: 'Тренировка до 7 утра', check: (c) => c.sessions.some((s) => new Date(s.startedAt).getHours() < 7) },
  { id: 'legs10', group: 'habit', title: 'Ноги не пропускаю', desc: '10 тренировок ног. Мем про цыплячьи ножки не про тебя', check: (c) => new Set(work(c).filter((s) => c.primaryOf(s.exerciseId).includes('quads')).map((s) => s.sessionId)).size >= 10 },
  { id: 'notes', group: 'habit', title: 'Летописец', desc: '10 тренировок с заметкой', check: (c) => c.sessions.filter((s) => s.note).length >= 10 },
  { id: 'happy', group: 'habit', title: 'Кайфую', desc: '5 тренировок с самочувствием «отлично»', check: (c) => c.sessions.filter((s) => s.mood === 5).length >= 5 },
  { id: 'patient', group: 'habit', title: 'Дзен-мастер отдыха', desc: '30 подходов с отдыхом точно по плану', check: (c) => work(c).filter((s) => s.restActualS && s.restPlannedS && Math.abs(s.restActualS - s.restPlannedS) <= s.restPlannedS * 0.2).length >= 30 },

  // Прогресс — для любого уровня силы
  { id: 'pr1', group: 'progress', title: 'Растёшь!', desc: 'Первый личный рекорд', check: (c) => prCount(c) >= 1 },
  { id: 'pr10', group: 'progress', title: 'Рекордсмен', desc: '10 личных рекордов', check: (c) => prCount(c) >= 10 },
  { id: 'pr50', group: 'progress', title: 'Машина рекордов', desc: '50 личных рекордов', check: (c) => prCount(c) >= 50 },
  { id: 'gain10', group: 'progress', title: 'Прогресс налицо', desc: '+10 кг к расчётному максимуму в любом упражнении', check: (c) => bestGain(c) >= 10 },
  { id: 'gain25', group: 'progress', title: 'Мама не узнала', desc: '+25 кг к расчётному максимуму', check: (c) => bestGain(c) >= 25 },
  { id: 'truck', group: 'progress', title: 'Перевёз грузовик', desc: '10 тонн за одну тренировку', check: (c) => c.sessions.some((s) => s.tonnage >= 10000) },
  { id: 'ton100', group: 'progress', title: 'Грузчик года', desc: '100 тонн за всё время', check: (c) => c.sessions.reduce((a, s) => a + s.tonnage, 0) >= 100000 },

  // Сила
  weightAch('bench60', 'Гриф прогнулся', 'Жим лёжа 60 кг', BENCH, 60),
  weightAch('bench80', 'Грудь колесом', 'Жим лёжа 80 кг', BENCH, 80),
  weightAch('bench100', 'Клуб сотки', 'Жим лёжа 100 кг. Добро пожаловать в легенду любой раздевалки', BENCH, 100),
  weightAch('bench120', 'Скамья просит пощады', 'Жим лёжа 120 кг', BENCH, 120),
  weightAch('squat100', 'Колени не скрипят', 'Присед 100 кг', SQUAT, 100),
  weightAch('squat140', 'Сейсмолог насторожился', 'Присед 140 кг', SQUAT, 140),
  weightAch('dead140', 'Земля уходит', 'Тяга 140 кг', DEAD, 140),
  weightAch('dead180', 'Земная ось сместилась', 'Тяга 180 кг. NASA уже в курсе', DEAD, 180),
  weightAch('ohp60', 'Над головой как кубок', 'Жим над головой 60 кг', OHP, 60),
  weightAch('curl20', 'Бицуха из гранита', 'Сгибания на бицепс 20 кг', CURL, 20),
  weightAch('curl30', 'Рукава трещат', 'Сгибания на бицепс 30 кг. Футболки M больше не налезают', CURL, 30),
  weightAch('lat14', 'Плечи-арбузы', 'Махи в стороны 14 кг', ['lateral-raise'], 14),
  weightAch('press200', 'Двести на ноги', 'Жим ногами 200 кг', ['leg-press'], 200),
  weightAch('pullup20', 'Тянет за двоих', 'Подтягивания с весом +20 кг', ['pull-up'], 20),
  { id: 'bw-bench', group: 'strength', title: 'Жмёт себя', desc: 'Жим лёжа не меньше собственного веса', check: (c) => !!c.bodyWeight && maxWeight(c, BENCH) >= c.bodyWeight },
];

/** Звание по числу ачивок — просто для улыбки */
export const RANKS = [
  { count: 0, title: 'Носитель пакетов' },
  { count: 3, title: 'Гроза турников' },
  { count: 7, title: 'Ломатель скамеек' },
  { count: 12, title: 'Сосед снизу слышит' },
  { count: 18, title: 'Друг всех тренеров' },
  { count: 25, title: 'Законченный качок' },
  { count: 32, title: 'Легенда зала' },
];

export function evaluate(c: AchContext): Set<string> {
  return new Set(ACHIEVEMENTS.filter((a) => a.check(c)).map((a) => a.id));
}

export function rankOf(count: number) {
  let i = 0;
  while (i + 1 < RANKS.length && count >= RANKS[i + 1].count) i++;
  return { title: RANKS[i].title, next: RANKS[i + 1] ?? null };
}
