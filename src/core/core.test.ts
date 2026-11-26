/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseProgram, serializeProgram, type ExerciseDef } from './program.ts';
import { suggestWeight, warmupSets, e1rm, nextWorkout, plannedWeeklySets, type SetLog } from './training.ts';
import { parseDuration, parseRange, plural, clock } from './units.ts';
import { exerciseIndex } from './program.ts';

const library = JSON.parse(readFileSync('src/data/library.json', 'utf8')) as ExerciseDef[];
const programs = JSON.parse(readFileSync('src/data/programs.json', 'utf8')) as { file: string; source: string }[];

test('все встроенные программы проходят проверку', () => {
  for (const p of programs) {
    const r = parseProgram(p.source, library);
    assert.ok(r.ok, `${p.file}: ${!r.ok && JSON.stringify(r.issues)}`);
  }
});

test('YAML туда и обратно не теряет данные', () => {
  for (const p of programs) {
    const prog = must(parseProgram(p.source, library));
    assert.deepEqual(must(parseProgram(serializeProgram(prog), library)), prog);
  }
});

test('ошибка ссылается на строку', () => {
  const src = `format: pero-program/1
name: T
schedule: { type: weekly, days: { mon: a } }
workouts:
  - id: a
    name: A
    exercises:
      - { exercise: bench-pres, sets: 3, reps: 8-12 }
`;
  const r = parseProgram(src, library);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.issues[0].line, 8);
    assert.match(r.issues[0].message, /bench-pres/);
  }
});

test('ошибка YAML и неверный вариант', () => {
  assert.equal(parseProgram('format: [', library).ok, false);
  const src = `format: pero-program/1
name: T
schedule: { type: rotation, order: [a, rest] }
workouts:
  - id: a
    name: A
    exercises:
      - { exercise: bench-press, variant: kettlebell, sets: 3, reps: 8-12 }
`;
  const r = parseProgram(src, library);
  assert.equal(r.ok, false);
});

function must(r: ReturnType<typeof parseProgram>) {
  if (!r.ok) throw new Error(JSON.stringify(r.issues));
  return r.program;
}

const set = (weight: number, reps: number, rir = 2): SetLog => ({ id: 0, sessionId: 1, exerciseId: 'x', variantId: null, position: 0, setIndex: 0, kind: 'work', side: 'both', weight, reps, durationS: null, rir, restPlannedS: null, restActualS: null, completedAt: 1, note: null });

test('двойная прогрессия', () => {
  const plan = { exercise: 'bench-press', sets: 3, reps: '6-8', rir: '1-2' };
  assert.equal(suggestWeight(plan, [set(70, 8), set(70, 8), set(70, 8)], 2.5).weight, 72.5);
  assert.equal(suggestWeight(plan, [set(70, 8), set(70, 8), set(70, 7)], 2.5).reason, 'repeat');
  assert.equal(suggestWeight(plan, [set(70, 5), set(70, 4), set(70, 6)], 2.5).reason, 'reduce');
  assert.equal(suggestWeight({ ...plan, start_weight: 60 }, [], 2.5).weight, 60);
  assert.equal(suggestWeight(plan, [], 2.5).weight, null);
  // RIR 0 при цели 1-2: не прибавляем
  assert.equal(suggestWeight(plan, [set(70, 8, 0), set(70, 8, 0), set(70, 8, 0)], 2.5).reason, 'repeat');
});

test('разминка', () => {
  assert.deepEqual(warmupSets(72.5), [{ weight: 37.5, reps: 8 }, { weight: 50, reps: 4 }, { weight: 62.5, reps: 2 }]);
  assert.deepEqual(warmupSets(30), []);
});

test('e1RM', () => {
  assert.equal(Math.round(e1rm(80, 5)), 93);
  assert.equal(e1rm(100, 1), 100);
  assert.equal(Math.round(e1rm(80, 3, 2)), 93);
});

test('единицы', () => {
  assert.equal(parseDuration('2m30s'), 150);
  assert.equal(parseDuration('90s'), 90);
  assert.equal(parseDuration(45), 45);
  assert.deepEqual(parseRange('30-60s'), { min: 30, max: 60, time: true });
  assert.equal(plural(21, 'подход', 'подхода', 'подходов'), 'подход');
  assert.equal(plural(12, 'подход', 'подхода', 'подходов'), 'подходов');
  assert.equal(plural(3, 'подход', 'подхода', 'подходов'), 'подхода');
  assert.equal(clock(150), '2:30');
});

test('расписание', () => {
  const r = { program: must(parseProgram(programs.find((p) => p.file === 'upper-lower-4d.yaml')!.source, library)) };
  const wed = new Date(2026, 10, 25); // среда
  assert.deepEqual(nextWorkout(r.program, null, false, wed), { workoutId: 'upper-b', when: 'thu' });
  const mon = new Date(2026, 10, 23);
  assert.deepEqual(nextWorkout(r.program, null, false, mon), { workoutId: 'upper-a', when: 'today' });
  assert.deepEqual(nextWorkout(r.program, 'upper-a', true, mon), { workoutId: 'lower-a', when: 'tue' });
  const vol = plannedWeeklySets(r.program, exerciseIndex(library, r.program));
  assert.equal(vol.get('calves'), 6);
});

import { computeStreak, weekStart } from './streak.ts';
test('серия по неделям с заморозкой', () => {
  const now = new Date(2026, 10, 26, 12).getTime(); // четверг
  const W = 7 * 86400000;
  const cur = weekStart(now);
  const week = (k: number, n: number) => Array.from({ length: n }, (_, i) => cur - k * W + (i + 1) * 3600000 * 20);
  // 3 полные недели назад + текущая 2 из 4
  let s = computeStreak([...week(3, 4), ...week(2, 4), ...week(1, 4), ...week(0, 2)], 4, now);
  assert.equal(s.weeks, 3);
  assert.equal(s.thisWeek, 2);
  assert.equal(s.weekDone, false);
  // пропуск одной недели замораживается
  s = computeStreak([...week(4, 4), ...week(3, 4), ...week(2, 1), ...week(1, 4), ...week(0, 4)], 4, now);
  assert.equal(s.weeks, 4);
  assert.equal(s.frozen, 1);
  // два пропуска подряд обрывают
  s = computeStreak([...week(4, 4), ...week(3, 0), ...week(2, 0), ...week(1, 4)], 4, now);
  assert.equal(s.weeks, 1);
  assert.equal(s.best, 1);
});
