// Локальная база SQLite. Все данные живут только на телефоне.
// Миграции пронумерованы: новая версия схемы = новый элемент в MIGRATIONS, старые не меняем.
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

const NAME = 'pero.db';
let handle: SQLite.SQLiteDatabase | null = null;
function open() {
  if (!handle) handle = SQLite.openDatabaseSync(NAME);
  return handle;
}

// База открывается при первом обращении. В браузере SQLite живёт в воркере,
// поэтому там сначала нужно дождаться prepareDb(), а дальше синхронный API работает как на телефоне.
export const db = new Proxy({} as SQLite.SQLiteDatabase, {
  get(_, key) {
    const d = open();
    if (WEB) {
      if (key === 'getAllSync' || key === 'getFirstSync') return cachedRead(d, key);
      if (key === 'runSync') return (sql: string, ...params: unknown[]) => (invalidate(sql), (d.runSync as (s: string, ...p: unknown[]) => unknown)(sql, ...params));
      if (key === 'execSync') return (sql: string) => (readCache.clear(), d.execSync(sql));
      if (key === 'withTransactionSync')
        return (fn: () => void) => {
          try {
            d.withTransactionSync(fn);
          } catch (e) {
            readCache.clear();
            throw e;
          }
        };
    }
    const v = Reflect.get(d, key, d);
    return typeof v === 'function' ? v.bind(d) : v;
  },
});

// В браузере каждый запрос — это поход в отдельный поток и обратно, в Safari это медленно.
// Поэтому результаты чтения кешируются, пока не изменится одна из таблиц, из которых они читались.
const WEB = Platform.OS === 'web';
type Cached = { tables: string[]; value: unknown };
const readCache = new Map<string, Cached>();
const tablesOf = (sql: string) => [...sql.matchAll(/\b(?:FROM|JOIN)\s+([A-Za-z_]+)/gi)].map((m) => m[1].toLowerCase());
function invalidate(sql: string) {
  const m = sql.match(/^\s*(?:INSERT(?:\s+OR\s+\w+)?\s+INTO|UPDATE|DELETE\s+FROM|REPLACE\s+INTO)\s+([A-Za-z_]+)/i);
  if (!m) return readCache.clear();
  const t = m[1].toLowerCase();
  for (const [k, c] of readCache) if (c.tables.includes(t)) readCache.delete(k);
}
function cachedRead(d: SQLite.SQLiteDatabase, key: 'getAllSync' | 'getFirstSync') {
  return (sql: string, ...params: unknown[]) => {
    const k = `${key}\u0000${sql}\u0000${JSON.stringify(params)}`;
    let c = readCache.get(k);
    if (!c) {
      const value = (d[key] as (s: string, ...p: unknown[]) => unknown)(sql, ...params);
      c = { tables: tablesOf(sql), value };
      if (c.tables.length && !/^\s*PRAGMA/i.test(sql)) readCache.set(k, c);
    }
    // Копия, чтобы случайное изменение результата не испортило кеш
    return c.value == null ? c.value : structuredClone(c.value);
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function prepareDb() {
  if (Platform.OS !== 'web') return;
  const g = globalThis as { crossOriginIsolated?: boolean; navigator?: Navigator };
  // Просим постоянное хранилище, чтобы браузер сам не стёр данные (Safari чистит сайты через ~7 дней без визитов)
  g.navigator?.storage?.persist?.().catch(() => {});
  // Первая загрузка без изоляции: service worker сейчас сам перезагрузит страницу.
  // Не трогаем базу, иначе эта страница займёт файлы и новая не сможет их открыть.
  if (g.crossOriginIsolated === false && g.navigator?.serviceWorker) {
    for (let i = 0; i < 40 && !g.crossOriginIsolated; i++) await sleep(100);
  }
  // Файлы базы может ещё держать прошлая вкладка или прошлая загрузка страницы (Safari отпускает их не сразу)
  let last: unknown;
  for (let i = 0; i < 8; i++) {
    try {
      await SQLite.openDatabaseAsync(NAME);
      return;
    } catch (e) {
      last = e;
      if (/SharedArrayBuffer/.test(String(e))) break;
      await sleep(300 + i * 300);
    }
  }
  throw last;
}

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
  // 2: оценка тренировки после завершения
  `
  ALTER TABLE session ADD COLUMN mood INTEGER;     -- самочувствие 1–5
  ALTER TABLE session ADD COLUMN fatigue INTEGER;  -- усталость 1–5
  `,
  // 3: замеры тела, см
  `
  ALTER TABLE body_metric ADD COLUMN chest REAL;
  ALTER TABLE body_metric ADD COLUMN arm REAL;    -- бицепс в напряжении
  ALTER TABLE body_metric ADD COLUMN hips REAL;   -- ягодицы
  ALTER TABLE body_metric ADD COLUMN thigh REAL;
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
