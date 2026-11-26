// Все запросы к базе в одном месте. Экраны не пишут SQL сами.
import { db, notify, TABLES } from './db';
import libraryJson from '../data/library.json';
import programsJson from '../data/programs.json';
import { exerciseSchema, parseProgram, type ExerciseDef, type Program, type Workout } from '../core/program';
import type { SetKind, SetLog, Side } from '../core/training';

export const BUNDLED_LIBRARY = libraryJson as unknown as ExerciseDef[];
export const BUNDLED_PROGRAMS = programsJson as { file: string; source: string }[];

// ───────── Настройки ─────────

export function getSetting<T>(key: string, fallback: T): T {
  const r = db.getFirstSync<{ value: string }>('SELECT value FROM setting WHERE key = ?', key);
  if (!r) return fallback;
  try {
    return JSON.parse(r.value) as T;
  } catch {
    return fallback;
  }
}
export function setSetting(key: string, value: unknown) {
  db.runSync('INSERT INTO setting(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, JSON.stringify(value));
  notify();
}

// ───────── Библиотека ─────────

export function getLibrary(): ExerciseDef[] {
  const custom = db.getAllSync<{ json: string }>('SELECT json FROM custom_exercise').map((r) => JSON.parse(r.json) as ExerciseDef);
  const ids = new Set(custom.map((c) => c.id));
  return [...BUNDLED_LIBRARY.filter((e) => !ids.has(e.id)), ...custom];
}
export function saveCustomExercise(e: ExerciseDef) {
  const parsed = exerciseSchema.parse(e);
  db.runSync('INSERT INTO custom_exercise(id, json) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json', parsed.id, JSON.stringify(parsed));
  notify();
}

// ───────── Программы ─────────

export type StoredProgram = { id: number; name: string; program: Program; isActive: boolean; startedAt: number | null; updatedAt: number };
type ProgramRow = { id: number; name: string; json: string; is_active: number; started_at: number | null; updated_at: number };
const toProgram = (r: ProgramRow): StoredProgram => ({ id: r.id, name: r.name, program: JSON.parse(r.json), isActive: !!r.is_active, startedAt: r.started_at, updatedAt: r.updated_at });

export function listPrograms(): StoredProgram[] {
  return db.getAllSync<ProgramRow>('SELECT * FROM program ORDER BY is_active DESC, updated_at DESC').map(toProgram);
}
export function getProgram(id: number): StoredProgram | null {
  const r = db.getFirstSync<ProgramRow>('SELECT * FROM program WHERE id = ?', id);
  return r ? toProgram(r) : null;
}
export function getActiveProgram(): StoredProgram | null {
  const r = db.getFirstSync<ProgramRow>('SELECT * FROM program WHERE is_active = 1 LIMIT 1');
  return r ? toProgram(r) : null;
}
export function saveProgram(p: Program, opts: { id?: number; activate?: boolean } = {}): number {
  const now = Date.now();
  let id = opts.id;
  db.withTransactionSync(() => {
    if (opts.activate) db.runSync('UPDATE program SET is_active = 0');
    if (id) {
      db.runSync('UPDATE program SET name = ?, json = ?, updated_at = ? WHERE id = ?', p.name, JSON.stringify(p), now, id);
      if (opts.activate) db.runSync('UPDATE program SET is_active = 1 WHERE id = ?', id);
    } else {
      id = db.runSync('INSERT INTO program(name, json, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', p.name, JSON.stringify(p), opts.activate ? 1 : 0, now, now).lastInsertRowId;
    }
  });
  notify();
  return id!;
}
export function activateProgram(id: number) {
  db.withTransactionSync(() => {
    db.runSync('UPDATE program SET is_active = 0');
    db.runSync('UPDATE program SET is_active = 1 WHERE id = ?', id);
  });
  notify();
}
export function deleteProgram(id: number) {
  db.runSync('DELETE FROM program WHERE id = ?', id);
  notify();
}

/** Первый запуск: кладём встроенные программы, программу Петра делаем основной */
export function seedIfEmpty() {
  const n = db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM program')?.n ?? 0;
  if (n) return;
  for (const f of BUNDLED_PROGRAMS) {
    const r = parseProgram(f.source, BUNDLED_LIBRARY);
    if (r.ok) saveProgram(r.program, { activate: f.file === 'upper-lower-4d.yaml' });
  }
}

// ───────── Предпочтения по упражнению ─────────

export type ExercisePref = { variantId: string | null; sides: 'both' | 'each' | null; increment: number | null };
export function getPref(exerciseId: string): ExercisePref {
  const r = db.getFirstSync<{ variant_id: string | null; sides: string | null; increment: number | null }>('SELECT * FROM exercise_pref WHERE exercise_id = ?', exerciseId);
  return { variantId: r?.variant_id ?? null, sides: (r?.sides as ExercisePref['sides']) ?? null, increment: r?.increment ?? null };
}
export function setPref(exerciseId: string, patch: Partial<ExercisePref>) {
  const cur = getPref(exerciseId);
  const n = { ...cur, ...patch };
  db.runSync(
    'INSERT INTO exercise_pref(exercise_id, variant_id, sides, increment) VALUES (?, ?, ?, ?) ON CONFLICT(exercise_id) DO UPDATE SET variant_id = excluded.variant_id, sides = excluded.sides, increment = excluded.increment',
    exerciseId, n.variantId, n.sides, n.increment,
  );
  notify();
}

// ───────── Тренировки ─────────

export type Session = { id: number; programId: number | null; workoutId: string | null; workoutName: string; plan: Workout; startedAt: number; finishedAt: number | null; note: string | null };
type SessionRow = { id: number; program_id: number | null; workout_id: string | null; workout_name: string; plan_json: string; started_at: number; finished_at: number | null; note: string | null };
const toSession = (r: SessionRow): Session => ({ id: r.id, programId: r.program_id, workoutId: r.workout_id, workoutName: r.workout_name, plan: JSON.parse(r.plan_json), startedAt: r.started_at, finishedAt: r.finished_at, note: r.note });

export function startSession(programId: number | null, plan: Workout): number {
  const now = Date.now();
  const id = db.runSync('INSERT INTO session(program_id, workout_id, workout_name, plan_json, started_at) VALUES (?, ?, ?, ?, ?)', programId, plan.id, plan.name, JSON.stringify(plan), now).lastInsertRowId;
  if (programId) db.runSync('UPDATE program SET started_at = COALESCE(started_at, ?) WHERE id = ?', now, programId);
  notify();
  return id;
}
export function getSession(id: number): Session | null {
  const r = db.getFirstSync<SessionRow>('SELECT * FROM session WHERE id = ?', id);
  return r ? toSession(r) : null;
}
export function getOpenSession(): Session | null {
  const r = db.getFirstSync<SessionRow>('SELECT * FROM session WHERE finished_at IS NULL ORDER BY started_at DESC LIMIT 1');
  return r ? toSession(r) : null;
}
export function updateSessionPlan(id: number, plan: Workout) {
  db.runSync('UPDATE session SET plan_json = ? WHERE id = ?', JSON.stringify(plan), id);
  notify();
}
export function finishSession(id: number, note?: string) {
  db.runSync('UPDATE session SET finished_at = ?, note = COALESCE(?, note) WHERE id = ?', Date.now(), note ?? null, id);
  notify();
}
export function deleteSession(id: number) {
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM set_log WHERE session_id = ?', id);
    db.runSync('DELETE FROM session WHERE id = ?', id);
  });
  notify();
}

export type SessionSummary = Session & { sets: number; tonnage: number; exercises: number };
export function listSessions(limit = 200): SessionSummary[] {
  const rows = db.getAllSync<SessionRow & { sets: number; tonnage: number; exercises: number }>(
    `SELECT s.*, COUNT(l.id) AS sets, COALESCE(SUM(l.weight * l.reps), 0) AS tonnage, COUNT(DISTINCT l.exercise_id) AS exercises
     FROM session s LEFT JOIN set_log l ON l.session_id = s.id AND l.kind = 'work' AND l.completed_at IS NOT NULL
     WHERE s.finished_at IS NOT NULL GROUP BY s.id ORDER BY s.started_at DESC LIMIT ?`,
    limit,
  );
  return rows.map((r) => ({ ...toSession(r), sets: r.sets, tonnage: r.tonnage, exercises: r.exercises }));
}
export function lastFinishedSession(): Session | null {
  const r = db.getFirstSync<SessionRow>('SELECT * FROM session WHERE finished_at IS NOT NULL ORDER BY started_at DESC LIMIT 1');
  return r ? toSession(r) : null;
}

// ───────── Подходы ─────────

type SetRow = { id: number; session_id: number; exercise_id: string; variant_id: string | null; position: number; set_index: number; kind: string; side: string; weight: number | null; reps: number | null; duration_s: number | null; rir: number | null; rest_planned_s: number | null; rest_actual_s: number | null; completed_at: number | null; note: string | null };
const toSet = (r: SetRow): SetLog => ({
  id: r.id, sessionId: r.session_id, exerciseId: r.exercise_id, variantId: r.variant_id, position: r.position, setIndex: r.set_index,
  kind: r.kind as SetKind, side: r.side as Side, weight: r.weight, reps: r.reps, durationS: r.duration_s, rir: r.rir,
  restPlannedS: r.rest_planned_s, restActualS: r.rest_actual_s, completedAt: r.completed_at, note: r.note,
});

export function listSets(sessionId: number): SetLog[] {
  return db.getAllSync<SetRow>('SELECT * FROM set_log WHERE session_id = ? ORDER BY position, kind, set_index, side', sessionId).map(toSet);
}

export type NewSet = Omit<SetLog, 'id'>;
export function insertSet(s: NewSet): number {
  const id = db.runSync(
    `INSERT INTO set_log(session_id, exercise_id, variant_id, position, set_index, kind, side, weight, reps, duration_s, rir, rest_planned_s, rest_actual_s, completed_at, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    s.sessionId, s.exerciseId, s.variantId, s.position, s.setIndex, s.kind, s.side, s.weight, s.reps, s.durationS, s.rir, s.restPlannedS, s.restActualS, s.completedAt, s.note,
  ).lastInsertRowId;
  notify();
  return id;
}
export function updateSet(id: number, patch: Partial<NewSet>) {
  const map: Record<string, string> = { variantId: 'variant_id', setIndex: 'set_index', durationS: 'duration_s', restPlannedS: 'rest_planned_s', restActualS: 'rest_actual_s', completedAt: 'completed_at', exerciseId: 'exercise_id', sessionId: 'session_id' };
  const keys = Object.keys(patch) as (keyof NewSet)[];
  if (!keys.length) return;
  const cols = keys.map((k) => `${map[k] ?? k} = ?`).join(', ');
  db.runSync(`UPDATE set_log SET ${cols} WHERE id = ?`, ...keys.map((k) => (patch[k] ?? null) as string | number | null), id);
  notify();
}
export function deleteSet(id: number) {
  db.runSync('DELETE FROM set_log WHERE id = ?', id);
  notify();
}
export function setVariantForExercise(sessionId: number, position: number, variantId: string | null) {
  db.runSync('UPDATE set_log SET variant_id = ? WHERE session_id = ? AND position = ?', variantId, sessionId, position);
  notify();
}

/** Подходы последней завершённой тренировки с этим упражнением и вариантом */
export function lastSetsFor(exerciseId: string, variantId: string | null, excludeSessionId?: number): SetLog[] {
  const last = db.getFirstSync<{ session_id: number }>(
    `SELECT l.session_id FROM set_log l JOIN session s ON s.id = l.session_id
     WHERE l.exercise_id = ? AND l.variant_id IS ? AND l.completed_at IS NOT NULL AND l.session_id IS NOT ?
     ORDER BY s.started_at DESC LIMIT 1`,
    exerciseId, variantId, excludeSessionId ?? -1,
  );
  if (!last) return [];
  return db.getAllSync<SetRow>('SELECT * FROM set_log WHERE session_id = ? AND exercise_id = ? AND variant_id IS ? AND completed_at IS NOT NULL ORDER BY set_index, side', last.session_id, exerciseId, variantId).map(toSet);
}

export type HistorySet = SetLog & { startedAt: number; workoutName: string };
export function setsBetween(from: number, to = Date.now() + 86400000): HistorySet[] {
  return db.getAllSync<SetRow & { started_at: number; workout_name: string }>(
    `SELECT l.*, s.started_at, s.workout_name FROM set_log l JOIN session s ON s.id = l.session_id
     WHERE l.completed_at IS NOT NULL AND s.started_at >= ? AND s.started_at < ? ORDER BY s.started_at, l.position, l.set_index`,
    from, to,
  ).map((r) => ({ ...toSet(r), startedAt: r.started_at, workoutName: r.workout_name }));
}
export function setsForExercise(exerciseId: string): HistorySet[] {
  return db.getAllSync<SetRow & { started_at: number; workout_name: string }>(
    `SELECT l.*, s.started_at, s.workout_name FROM set_log l JOIN session s ON s.id = l.session_id
     WHERE l.exercise_id = ? AND l.completed_at IS NOT NULL ORDER BY s.started_at, l.set_index`,
    exerciseId,
  ).map((r) => ({ ...toSet(r), startedAt: r.started_at, workoutName: r.workout_name }));
}
export function exercisesWithHistory(): { exerciseId: string; sessions: number; last: number }[] {
  return db.getAllSync<{ exercise_id: string; sessions: number; last: number }>(
    `SELECT l.exercise_id, COUNT(DISTINCT l.session_id) AS sessions, MAX(l.completed_at) AS last
     FROM set_log l WHERE l.completed_at IS NOT NULL AND l.kind = 'work' GROUP BY l.exercise_id ORDER BY last DESC`,
  ).map((r) => ({ exerciseId: r.exercise_id, sessions: r.sessions, last: r.last }));
}

// ───────── Вес тела ─────────

export type BodyMetric = { date: string; weight: number | null; waist: number | null; note: string | null };
export function listBody(): BodyMetric[] {
  return db.getAllSync<BodyMetric>('SELECT * FROM body_metric ORDER BY date');
}
export function upsertBody(m: BodyMetric) {
  db.runSync(
    'INSERT INTO body_metric(date, weight, waist, note) VALUES (?, ?, ?, ?) ON CONFLICT(date) DO UPDATE SET weight = excluded.weight, waist = excluded.waist, note = excluded.note',
    m.date, m.weight, m.waist, m.note,
  );
  notify();
}
export function deleteBody(date: string) {
  db.runSync('DELETE FROM body_metric WHERE date = ?', date);
  notify();
}

// ───────── Бэкап ─────────

export type Backup = { app: 'pero'; version: 1; createdAt: string; tables: Record<string, Record<string, unknown>[]> };

export function dumpAll(): Backup {
  const tables: Backup['tables'] = {};
  for (const t of TABLES) tables[t] = db.getAllSync<Record<string, unknown>>(`SELECT * FROM ${t}`);
  return { app: 'pero', version: 1, createdAt: new Date().toISOString(), tables };
}

export function restoreAll(b: Backup) {
  if (b?.app !== 'pero' || !b.tables) throw new Error('Это не файл бэкапа Pero');
  db.withTransactionSync(() => {
    for (const t of [...TABLES].reverse()) db.runSync(`DELETE FROM ${t}`);
    for (const t of TABLES) {
      for (const row of b.tables[t] ?? []) {
        const cols = Object.keys(row);
        if (!cols.every((c) => /^[a-z_]+$/.test(c))) throw new Error('Повреждённый бэкап');
        db.runSync(`INSERT INTO ${t}(${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, ...cols.map((c) => row[c] as string | number | null));
      }
    }
  });
  notify();
}
