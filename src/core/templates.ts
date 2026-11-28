import type { Program } from './program.ts';

/** Заготовка новой программы в конструкторе */
export function emptyProgram(): Program {
  return {
    format: 'pero-program/1',
    name: 'Моя программа',
    schedule: { type: 'weekly', days: { mon: 'day-a', thu: 'day-b' } },
    progression: { type: 'double' },
    warmup: { suggest: true },
    workouts: [
      { id: 'day-a', name: 'День A', exercises: [{ exercise: 'squat', variant: 'back', sets: 3, reps: '6-10', rir: 2, rest: '3m' }] },
      { id: 'day-b', name: 'День B', exercises: [{ exercise: 'bench-press', variant: 'barbell', sets: 3, reps: '6-10', rir: '1-2', rest: '2m30s' }] },
    ],
  };
}
