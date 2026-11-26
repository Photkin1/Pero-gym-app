// Мелкие преобразования: время, диапазоны, форматирование чисел по-русски.

/** 90 → 90, "90s" → 90, "2m" → 120, "2m30s" → 150 */
export function parseDuration(v: number | string | undefined, fallback = 120): number {
  if (v === undefined || v === '') return fallback;
  if (typeof v === 'number') return v;
  const m = /^(?:(\d+)m)?(?:(\d+)s)?$/.exec(v.trim());
  if (!m || (!m[1] && !m[2])) return fallback;
  return Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0);
}

/** 150 → "2m30s" — для записи в файл программы */
export function durationToken(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (!m) return `${s}s`;
  return s ? `${m}m${s}s` : `${m}m`;
}

/** 150 → "2:30" */
export function clock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

/** 150 → "2,5 мин", 90 → "1,5 мин", 45 → "45 с" */
export function restLabel(sec: number): string {
  if (sec < 60) return `${sec} с`;
  return `${num(sec / 60)} мин`;
}

export type Range = { min: number; max: number; time: boolean };

/** "8-12" → {8,12}, 10 → {10,10}, "30-60s" → {30,60,time} */
export function parseRange(v: number | string | undefined): Range {
  if (v === undefined) return { min: 0, max: 0, time: false };
  if (typeof v === 'number') return { min: v, max: v, time: false };
  const time = v.endsWith('s');
  const [a, b] = v.replace('s', '').split('-').map(Number);
  return { min: a, max: b ?? a, time };
}

export function rangeLabel(v: number | string | undefined): string {
  const r = parseRange(v);
  const body = r.min === r.max ? `${r.min}` : `${r.min}–${r.max}`;
  return r.time ? `${body} с` : body;
}

/** 72.5 → "72,5", 70 → "70" */
export function num(n: number, digits = 1): string {
  const f = Math.round(n * 10 ** digits) / 10 ** digits;
  return String(f).replace('.', ',');
}

/** "72,5" → 72.5; пустая строка → null */
export function parseNum(s: string): number | null {
  const t = s.replace(',', '.').trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Склонение: plural(3, 'подход', 'подхода', 'подходов') */
export function plural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

export function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}
