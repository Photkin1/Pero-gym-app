// Программа тренировок: типы, разбор YAML-файла, проверка и обратная запись.
// Один и тот же код используется для встроенных программ, импорта файла и конструктора.
import { z } from 'zod';
import { parseDocument, stringify, isNode, LineCounter } from 'yaml';
import { parseDuration, parseRange } from './units.ts';

export const MUSCLES = [
  'chest', 'lats', 'upper_back', 'lower_back', 'traps', 'front_delts', 'side_delts', 'rear_delts',
  'biceps', 'triceps', 'forearms', 'quads', 'hamstrings', 'glutes', 'adductors', 'abductors', 'calves', 'abs',
] as const;
export type Muscle = (typeof MUSCLES)[number];

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

const id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'id: только латиница в нижнем регистре, цифры и дефисы, например upper-a');
const reps = z.union([
  z.number().int().min(1),
  z.string().regex(/^\d+(-\d+)?s?$/, 'повторения: число или диапазон, например 8-12, для времени 30-60s'),
]);
const rir = z.union([
  z.number().int().min(0).max(5),
  z.string().regex(/^[0-5]-[0-5]$/, 'RIR: число 0–5 или диапазон, например 1-2'),
]);
const duration = z.union([
  z.number().int().min(0),
  z.string().regex(/^(\d+m)?(\d+s)?$/, 'время: секунды или вида 90s, 2m, 2m30s'),
]);
const muscle = z.enum(MUSCLES);

export const exerciseSchema = z.strictObject({
  id,
  name: z.string().min(1),
  muscles: z.strictObject({ primary: z.array(muscle).min(1), secondary: z.array(muscle).optional() }),
  type: z.enum(['weight', 'bodyweight', 'time']),
  sides: z.enum(['both', 'each', 'optional']).optional(),
  increment: z.number().positive().optional(),
  variants: z.array(z.strictObject({ id, name: z.string(), increment: z.number().positive().optional() })).optional(),
  tips: z.array(z.string()).optional(),
  video: z.string().optional(),
  image: z.string().optional(),
});
export type ExerciseDef = z.infer<typeof exerciseSchema>;

export const plannedExerciseSchema = z.strictObject({
  exercise: id,
  variant: id.optional(),
  sets: z.number().int().min(1).max(20),
  reps,
  rir: rir.optional(),
  rest: duration.optional(),
  sides: z.enum(['both', 'each']).optional(),
  group: z.string().regex(/^[A-Z]$/, 'суперсет: одна заглавная латинская буква').optional(),
  start_weight: z.number().min(0).optional(),
  note: z.string().optional(),
});
export type PlannedExercise = z.infer<typeof plannedExerciseSchema>;

export const workoutSchema = z.strictObject({
  id,
  name: z.string().min(1),
  note: z.string().optional(),
  exercises: z.array(plannedExerciseSchema).min(1, 'в тренировке должно быть хотя бы одно упражнение'),
});
export type Workout = z.infer<typeof workoutSchema>;

const weekdaySchema = z.enum(WEEKDAYS);

export const programSchema = z.strictObject({
  format: z.literal('pero-program/1', { error: 'первая строка должна быть format: pero-program/1' }),
  name: z.string().min(1),
  author: z.string().optional(),
  description: z.string().optional(),
  level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  units: z.enum(['kg', 'lb']).optional(),
  schedule: z.discriminatedUnion('type', [
    z.strictObject({ type: z.literal('weekly'), days: z.partialRecord(weekdaySchema, id) }),
    z.strictObject({ type: z.literal('rotation'), order: z.array(id).min(1) }),
  ]),
  progression: z.strictObject({ type: z.enum(['double', 'linear', 'none']).optional(), increment: z.number().positive().optional() }).optional(),
  phases: z.array(z.strictObject({ week: z.number().int().min(1), rir: rir.optional(), sets_factor: z.number().positive().optional(), note: z.string().optional() })).optional(),
  deload: z.strictObject({ every_weeks: z.number().int().min(2).optional(), sets_factor: z.number().positive().max(1).optional(), rir: rir.optional() }).optional(),
  warmup: z.strictObject({
    suggest: z.boolean().optional(),
    scheme: z.array(z.strictObject({ percent: z.number().positive().max(100), reps: z.number().int().min(1) })).optional(),
  }).optional(),
  custom_exercises: z.array(exerciseSchema).optional(),
  workouts: z.array(workoutSchema).min(1),
});
export type Program = z.infer<typeof programSchema>;

export type ProgramIssue = { message: string; path: string; line?: number };
export type ParseResult = { ok: true; program: Program; warnings: ProgramIssue[] } | { ok: false; issues: ProgramIssue[] };

const pathText = (p: readonly PropertyKey[]) =>
  p.reduce<string>((acc, k) => (typeof k === 'number' ? `${acc}[${k}]` : acc ? `${acc}.${String(k)}` : String(k)), '');

/** Разбирает YAML, проверяет схему и ссылки на упражнения. Ошибки с номерами строк, чтобы их можно было отдать нейросети. */
export function parseProgram(source: string, library: ExerciseDef[]): ParseResult {
  const lc = new LineCounter();
  const doc = parseDocument(source, { lineCounter: lc, prettyErrors: false });
  if (doc.errors.length) {
    return { ok: false, issues: doc.errors.map((e) => ({ message: `ошибка YAML: ${e.message.split('\n')[0]}`, path: '', line: e.linePos?.[0].line })) };
  }
  const lineOf = (path: readonly PropertyKey[]) => {
    for (let i = path.length; i >= 0; i--) {
      const node = doc.getIn(path.slice(0, i) as unknown[], true);
      if (isNode(node) && node.range) return lc.linePos(node.range[0]).line;
    }
    return undefined;
  };
  const res = programSchema.safeParse(doc.toJS());
  if (!res.success) {
    return { ok: false, issues: res.error.issues.map((i) => ({ message: i.message, path: pathText(i.path), line: lineOf(i.path) })) };
  }
  const issues = checkReferences(res.data, library).map((i) => ({ ...i, line: lineOf(i.pathArr) }));
  const errors = issues.filter((i) => i.level === 'error').map(({ message, path, line }) => ({ message, path, line }));
  if (errors.length) return { ok: false, issues: errors };
  const warnings = issues.filter((i) => i.level === 'warning').map(({ message, path, line }) => ({ message, path, line }));
  return { ok: true, program: res.data, warnings };
}

type RefIssue = { level: 'error' | 'warning'; message: string; path: string; pathArr: (string | number)[] };

export function checkReferences(p: Program, library: ExerciseDef[]): RefIssue[] {
  const out: RefIssue[] = [];
  const all = new Map(library.map((e) => [e.id, e]));
  for (const c of p.custom_exercises ?? []) all.set(c.id, c);
  const wids = new Set<string>();
  p.workouts.forEach((w, wi) => {
    if (wids.has(w.id)) out.push({ level: 'error', message: `тренировка с id «${w.id}» уже есть`, path: `workouts[${wi}].id`, pathArr: ['workouts', wi, 'id'] });
    wids.add(w.id);
    w.exercises.forEach((x, xi) => {
      const pa: (string | number)[] = ['workouts', wi, 'exercises', xi];
      const e = all.get(x.exercise);
      if (!e) {
        out.push({ level: 'error', message: `упражнения «${x.exercise}» нет в библиотеке. Возьми id из exercises.yaml или опиши его в custom_exercises`, path: pathText(pa), pathArr: [...pa, 'exercise'] });
        return;
      }
      if (x.variant && !(e.variants ?? []).some((v) => v.id === x.variant)) {
        const known = (e.variants ?? []).map((v) => v.id).join(', ') || 'вариантов нет';
        out.push({ level: 'error', message: `у «${e.name}» нет варианта «${x.variant}». Есть: ${known}`, path: pathText(pa), pathArr: [...pa, 'variant'] });
      }
      if (x.sides === 'each' && (e.sides ?? 'both') === 'both') {
        out.push({ level: 'warning', message: `«${e.name}» обычно не делают по одной стороне`, path: pathText(pa), pathArr: [...pa, 'sides'] });
      }
      const isTime = typeof x.reps === 'string' && x.reps.endsWith('s');
      if ((e.type === 'time') !== isTime) {
        out.push({ level: 'error', message: e.type === 'time' ? `«${e.name}» на время: укажи reps в секундах, например 30-60s` : `«${e.name}» на повторения: reps без буквы s`, path: pathText(pa), pathArr: [...pa, 'reps'] });
      }
      if (x.rest !== undefined && parseDuration(x.rest) > 600) {
        out.push({ level: 'warning', message: 'отдых больше 10 минут, проверь', path: pathText(pa), pathArr: [...pa, 'rest'] });
      }
      const r = parseRange(x.reps);
      if (r.min > r.max) out.push({ level: 'error', message: 'в диапазоне повторений первое число больше второго', path: pathText(pa), pathArr: [...pa, 'reps'] });
    });
  });
  const refs = p.schedule.type === 'weekly' ? Object.entries(p.schedule.days).map(([k, v]) => ({ v: v as string, pa: ['schedule', 'days', k] })) : p.schedule.order.map((v, i) => ({ v, pa: ['schedule', 'order', i] }));
  for (const r of refs) {
    if (r.v !== 'rest' && !wids.has(r.v)) out.push({ level: 'error', message: `в расписании указана тренировка «${r.v}», а её нет в workouts`, path: pathText(r.pa), pathArr: r.pa });
  }
  return out;
}

/** Обратно в YAML: компактный вид, где каждое упражнение в одну строку, как в примерах. */
export function serializeProgram(p: Program): string {
  const text = stringify(p, {
    lineWidth: 0,
    collectionStyle: 'any',
    flowCollectionPadding: true,
  });
  // Упражнения тренировок и фазы записываем в одну строку для читаемости
  const doc = parseDocument(text);
  const flowAt = (path: (string | number)[]) => {
    const node = doc.getIn(path, true) as { flow?: boolean } | undefined;
    if (node && typeof node === 'object') node.flow = true;
  };
  p.workouts.forEach((w, wi) => w.exercises.forEach((_, xi) => flowAt(['workouts', wi, 'exercises', xi])));
  (p.phases ?? []).forEach((_, i) => flowAt(['phases', i]));
  (p.warmup?.scheme ?? []).forEach((_, i) => flowAt(['warmup', 'scheme', i]));
  if (p.schedule.type === 'weekly') flowAt(['schedule', 'days']);
  else flowAt(['schedule', 'order']);
  return doc.toString({ lineWidth: 0 });
}

export function exerciseIndex(library: ExerciseDef[], p?: Program | null): Map<string, ExerciseDef> {
  const m = new Map(library.map((e) => [e.id, e]));
  for (const c of p?.custom_exercises ?? []) m.set(c.id, c);
  return m;
}
