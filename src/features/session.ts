// Начало тренировки и операции над ней. При старте все запланированные подходы
// сразу создаются в базе с подставленными весами: если приложение закроется, ничего не потеряется.
import { exerciseIndex, type ExerciseDef, type PlannedExercise, type Workout } from '../core/program';
import { incrementFor, phaseFor, programWeek, suggestWeight, warmupSets, DEFAULT_WARMUP, type SetLog, type Side } from '../core/training';
import { parseDuration } from '../core/units';
import {
  getActiveProgram, getLibrary, getPref, getSession, insertSet, insertSets, lastSetsFor, listSets, setPref, startSession,
  updateSessionPlan, deleteSet, getSetting, setVariantForExercise, type StoredProgram,
} from '../db/repo';
import type { NewSet } from '../db/repo';
import { db } from '../db/db';

export function defsFor(program?: StoredProgram | null): Map<string, ExerciseDef> {
  return exerciseIndex(getLibrary(), program?.program);
}

export function sidesFor(def: ExerciseDef | undefined, plan: PlannedExercise): 'both' | 'each' {
  if (def?.sides === 'each') return 'each';
  if (plan.sides) return plan.sides;
  if (def?.sides === 'optional') return getPref(def.id).sides ?? 'both';
  return 'both';
}

export function variantFor(def: ExerciseDef | undefined, plan: PlannedExercise): string | null {
  if (!def?.variants?.length) return null;
  const pref = getPref(def.id).variantId;
  if (pref && def.variants.some((v) => v.id === pref)) return pref;
  return plan.variant ?? def.variants[0].id;
}

function createRows(sessionId: number, position: number, plan: PlannedExercise, def: ExerciseDef | undefined, progression: 'double' | 'linear' | 'none'): NewSet[] {
  const out: NewSet[] = [];
  const variantId = variantFor(def, plan);
  const sides = sidesFor(def, plan);
  const last = lastSetsFor(plan.exercise, variantId, sessionId);
  const inc = incrementFor(def, variantId, getPref(plan.exercise).increment);
  const sug = suggestWeight(plan, last, inc, progression);
  const rest = parseDuration(plan.rest);
  const sideList: Side[] = sides === 'each' ? ['left', 'right'] : ['both'];
  for (let i = 0; i < plan.sets; i++) {
    for (const side of sideList) {
      const lastSame = last.find((s) => s.kind === 'work' && s.setIndex === i && s.side === side);
      // Если пора прибавлять, ставим новый вес во все подходы; иначе вес того же подхода в прошлый раз
      const weight = sug.reason === 'increase' || sug.reason === 'reduce' ? sug.weight : lastSame?.weight ?? sug.weight;
      out.push({
        sessionId, exerciseId: plan.exercise, variantId, position, setIndex: i, kind: 'work', side,
        weight: def?.type === 'time' ? null : weight, reps: null, durationS: null, rir: null,
        restPlannedS: rest, restActualS: null, completedAt: null, note: null,
      });
    }
  }
  return out;
}

/** Начинает тренировку по программе: применяет вводную фазу или разгрузку, создаёт подходы */
export function beginWorkout(workoutId: string): number {
  const sp = getActiveProgram();
  if (!sp) throw new Error('Нет активной программы');
  const w = sp.program.workouts.find((x) => x.id === workoutId);
  if (!w) throw new Error('Тренировка не найдена');
  const week = programWeek(sp.startedAt);
  const phase = phaseFor(sp.program, week);
  const plan: Workout = {
    ...w,
    note: phase.label,
    exercises: w.exercises.map((x) => ({
      ...x,
      sets: Math.max(1, Math.round(x.sets * phase.setsFactor)),
      rir: phase.rir ?? x.rir,
    })),
  };
  const defs = defsFor(sp);
  let id = 0;
  db.withTransactionSync(() => {
    id = startSession(sp.id, plan);
    insertSets(plan.exercises.flatMap((x, i) => createRows(id, i, x, defs.get(x.exercise), sp.program.progression?.type ?? 'double')));
  });
  return id;
}

/** Пустая тренировка без программы */
export function beginEmptyWorkout(): number {
  const plan: Workout = { id: 'free', name: 'Свободная тренировка', exercises: [] as unknown as Workout['exercises'] };
  return startSession(getActiveProgram()?.id ?? null, plan);
}

export function addExercise(sessionId: number, exerciseId: string) {
  const s = getSession(sessionId);
  if (!s) return;
  const plan: PlannedExercise = { exercise: exerciseId, sets: 3, reps: '8-12', rir: '1-2', rest: '2m' };
  const defs = defsFor(getActiveProgram());
  const def = defs.get(exerciseId);
  if (def?.type === 'time') plan.reps = '30-60s';
  const next = { ...s.plan, exercises: [...s.plan.exercises, plan] };
  db.withTransactionSync(() => {
    updateSessionPlan(sessionId, next);
    insertSets(createRows(sessionId, next.exercises.length - 1, plan, def, 'double'));
  });
}

export function removeExercise(sessionId: number, position: number) {
  const s = getSession(sessionId);
  if (!s) return;
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM set_log WHERE session_id = ? AND position = ?', sessionId, position);
    db.runSync('UPDATE set_log SET position = position - 1 WHERE session_id = ? AND position > ?', sessionId, position);
    updateSessionPlan(sessionId, { ...s.plan, exercises: s.plan.exercises.filter((_, i) => i !== position) });
  });
}

export function addSet(sessionId: number, position: number, sets: SetLog[]) {
  const work = sets.filter((x) => x.position === position && x.kind === 'work');
  const lastRow = work[work.length - 1];
  const s = getSession(sessionId);
  const plan = s?.plan.exercises[position];
  const idx = work.length ? Math.max(...work.map((x) => x.setIndex)) + 1 : 0;
  const sides: Side[] = work.some((x) => x.side !== 'both') ? ['left', 'right'] : ['both'];
  for (const side of sides) {
    insertSet({
      sessionId, exerciseId: plan?.exercise ?? lastRow.exerciseId, variantId: lastRow?.variantId ?? null, position, setIndex: idx, kind: 'work', side,
      weight: lastRow?.weight ?? null, reps: null, durationS: null, rir: null, restPlannedS: parseDuration(plan?.rest), restActualS: null, completedAt: null, note: null,
    });
  }
}

export function addWarmups(sessionId: number, position: number, sets: SetLog[]): number {
  const work = sets.filter((x) => x.position === position && x.kind === 'work');
  const w = Math.max(0, ...work.map((x) => x.weight ?? 0));
  const scheme = getSetting('warmupScheme', DEFAULT_WARMUP);
  const ws = warmupSets(w, scheme);
  const first = work[0];
  if (!first) return 0;
  db.withTransactionSync(() => {
    ws.forEach((x, i) =>
      insertSet({
        sessionId, exerciseId: first.exerciseId, variantId: first.variantId, position, setIndex: i, kind: 'warmup', side: 'both',
        weight: x.weight, reps: x.reps, durationS: null, rir: null, restPlannedS: 60, restActualS: null, completedAt: null, note: null,
      }),
    );
  });
  return ws.length;
}

/** Переключить вариант (штанга/гантели...): запоминаем выбор и подставляем веса этого варианта */
export function switchVariant(sessionId: number, position: number, exerciseId: string, variantId: string) {
  setPref(exerciseId, { variantId });
  setVariantForExercise(sessionId, position, variantId);
  const last = lastSetsFor(exerciseId, variantId, sessionId);
  const rows = listSets(sessionId).filter((x) => x.position === position && x.kind === 'work' && !x.completedAt);
  for (const r of rows) {
    const same = last.find((l) => l.setIndex === r.setIndex && l.side === r.side) ?? last[last.length - 1];
    db.runSync('UPDATE set_log SET weight = ? WHERE id = ?', same?.weight ?? null, r.id);
  }
}

/** Переключить «обе стороны / по одной» для упражнений с выбором */
export function switchSides(sessionId: number, position: number, exerciseId: string, mode: 'both' | 'each') {
  setPref(exerciseId, { sides: mode });
  const rows = listSets(sessionId).filter((x) => x.position === position && x.kind === 'work');
  const done = rows.filter((r) => r.completedAt);
  if (done.length) return false;
  db.withTransactionSync(() => {
    const byIndex = new Map<number, SetLog>();
    for (const r of rows) if (!byIndex.has(r.setIndex)) byIndex.set(r.setIndex, r);
    for (const r of rows) deleteSet(r.id);
    for (const r of byIndex.values()) {
      for (const side of mode === 'each' ? (['left', 'right'] as Side[]) : (['both'] as Side[])) {
        const { id: _id, ...rest } = r;
        insertSet({ ...rest, side });
      }
    }
  });
  return true;
}

/** Перед завершением: незаполненные подходы удаляем */
export function cleanupSession(sessionId: number) {
  db.runSync('DELETE FROM set_log WHERE session_id = ? AND completed_at IS NULL', sessionId);
}
