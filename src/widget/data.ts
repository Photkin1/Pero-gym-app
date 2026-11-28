// Данные для виджета берутся из той же базы, что и приложение.
import { migrate } from '../db/db';
import { getActiveProgram, lastFinishedSession, listSessions } from '../db/repo';
import { computeStreak, weekStart } from '../core/streak';
import { nextWorkout } from '../core/training';
import { weeklyGoal } from '../features/achievements';
import type { WidgetData } from './StreakWidget';

export function widgetData(): WidgetData {
  migrate();
  const program = getActiveProgram();
  const sessions = listSessions(2000);
  const s = computeStreak(sessions.map((x) => x.startedAt), weeklyGoal(program?.program));
  const ws = weekStart(Date.now());
  const done = Array.from({ length: 7 }, (_, i) => sessions.some((x) => x.startedAt >= ws + i * 86400000 && x.startedAt < ws + (i + 1) * 86400000));
  let next: string | null = null;
  if (program) {
    const today = new Date().toDateString();
    const doneToday = sessions.some((x) => new Date(x.startedAt).toDateString() === today);
    const n = nextWorkout(program.program, lastFinishedSession()?.workoutId ?? null, doneToday);
    next = n ? program.program.workouts.find((w) => w.id === n.workoutId)?.name ?? null : null;
  }
  return { weeks: s.weeks, thisWeek: s.thisWeek, goal: s.goal, next, done };
}
