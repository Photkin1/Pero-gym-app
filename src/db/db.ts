// Локальная база SQLite. Все данные живут только на телефоне.
// Миграции пронумерованы: новая версия схемы = новый элемент в MIGRATIONS, старые не меняем.
import * as SQLite from 'expo-sqlite';

export const db = SQLite.openDatabaseSync('pero.db');

const MIGRATIONS: string[] = [
  `
  CREATE TABLE program (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    json TEXT NOT NULL,           -- программа в том же виде, что и YAML-файл (core/program.ts)
    is_active INTEGER NOT NULL DEFAULT 0,
    started_at INTEGER,           -- первая тренировка по программе, от неё считаются недели
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE custom_exercise (
    id TEXT PRIMARY KEY,
    json TEXT NOT NULL
  );

  CREATE TABLE session (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    program_id INTEGER,
    workout_id TEXT,
    workout_name TEXT NOT NULL,
    plan_json TEXT NOT NULL,      -- снимок плана на момент начала: история не ломается, если программу поменяли
    started_at INTEGER NOT NULL,
    finished_at INTEGER,
    note TEXT
  );

  CREATE TABLE set_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES session(id) ON DELETE CASCADE,
    exercise_id TEXT NOT NULL,
    variant_id TEXT,
    position INTEGER NOT NULL,    -- порядок упражнения в тренировке
    set_index INTEGER NOT NULL,
    kind TEXT NOT NULL DEFAULT 'work',   -- warmup | work
    side TEXT NOT NULL DEFAULT 'both',   -- both | left | right
    weight REAL,
    reps INTEGER,
    duration_s INTEGER,
    rir INTEGER,
    rest_planned_s INTEGER,
    rest_actual_s INTEGER,        -- сколько реально отдыхал после подхода
    completed_at INTEGER,
    note TEXT
  );
  CREATE INDEX set_log_ex ON set_log(exercise_id, variant_id, completed_at);
  CREATE INDEX set_log_session ON set_log(session_id);

  CREATE TABLE exercise_pref (
    exercise_id TEXT PRIMARY KEY,
    variant_id TEXT,              -- последний выбранный вариант
    sides TEXT,                   -- both | each для упражнений с переключателем
    increment REAL                -- свой шаг прибавки
  );

  CREATE TABLE body_metric (
    date TEXT PRIMARY KEY,        -- YYYY-MM-DD
    weight REAL,
    waist REAL,
    note TEXT
  );

  CREATE TABLE setting (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
];

export function migrate() {
  db.execSync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = db.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  let v = row?.user_version ?? 0;
  while (v < MIGRATIONS.length) {
    db.withTransactionSync(() => {
      db.execSync(MIGRATIONS[v]);
      db.execSync(`PRAGMA user_version = ${v + 1}`);
    });
    v++;
  }
}

// ───────── Подписка на изменения ─────────
// Экраны перечитывают данные, когда что-то записано. Без внешних библиотек состояния.

type Listener = () => void;
const listeners = new Set<Listener>();
let version = 0;

export function notify() {
  version++;
  listeners.forEach((l) => l());
}
export function subscribe(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
export function dbVersion() {
  return version;
}

export const TABLES = ['program', 'custom_exercise', 'session', 'set_log', 'exercise_pref', 'body_metric', 'setting'] as const;
