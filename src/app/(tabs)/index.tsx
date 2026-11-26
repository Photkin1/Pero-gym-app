import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../theme';
import { useLive } from '../../db/hooks';
import { getActiveProgram, getOpenSession, listSessions, listSets, lastFinishedSession } from '../../db/repo';
import { beginEmptyWorkout, beginWorkout, defsFor } from '../../features/session';
import { nextWorkout, phaseFor, programWeek, WEEKDAY_RU, weekdayOf } from '../../core/training';
import { WEEKDAYS, type Workout } from '../../core/program';
import { clock, parseDuration, plural, rangeLabel } from '../../core/units';
import { Btn, Card, Chip, IconBtn, Press, Row, Screen, SectionTitle, Txt, Empty, thud } from '../../ui/kit';
import { Icon } from '../../ui/Icon';
import { ExerciseArt } from '../../ui/ExerciseArt';
import { dayKey } from '../../ui/charts';
import { StreakCard } from '../../ui/StreakCard';
import { computeStreak } from '../../core/streak';
import { weeklyGoal } from '../../features/achievements';
import { installUpdate, useUpdate } from '../../features/update';

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const DAYS_FULL = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

function estimateMin(w: Workout) {
  return Math.round(w.exercises.reduce((s, x) => s + x.sets * (40 + parseDuration(x.rest)), 0) / 60 / 5) * 5;
}

export default function Today() {
  const t = useTheme();
  const router = useRouter();
  const program = useLive(() => getActiveProgram());
  const open = useLive(() => getOpenSession());
  const sessions = useLive(() => listSessions(1000));
  const last = useLive(() => lastFinishedSession());
  const openRows = useLive(() => (open ? listSets(open.id) : []), [open?.id]);
  const defs = useMemo(() => defsFor(program), [program]);
  const [picked, setPicked] = useState<string | null>(null);
  const update = useUpdate();

  const now = new Date();
  const todayKey = dayKey(Date.now());
  const doneToday = sessions.some((s) => dayKey(s.startedAt) === todayKey && s.programId === program?.id);
  const nxt = program ? nextWorkout(program.program, last?.workoutId ?? null, doneToday) : null;
  const wid = picked ?? nxt?.workoutId ?? program?.program.workouts[0]?.id;
  const workout = program?.program.workouts.find((w) => w.id === wid);
  const week = programWeek(program?.startedAt ?? null);
  const phase = program ? phaseFor(program.program, week) : null;

  // Неделя: что запланировано и что сделано
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((now.getDay() + 6) % 7));
  const weekDone = new Set(sessions.filter((s) => s.startedAt >= monday.getTime()).map((s) => dayKey(s.startedAt)));
  const thisWeekCount = sessions.filter((s) => s.startedAt >= monday.getTime()).length;
  const plannedCount = program?.program.schedule.type === 'weekly' ? Object.keys(program.program.schedule.days).length : null;

  // Подсказка о разгрузке: 3 последние тренировки с усталостью 4–5
  const tired = sessions.slice(0, 3);
  const needDeload = tired.length === 3 && tired.every((s) => (s.fatigue ?? 0) >= 4);

  const start = () => {
    if (!workout) return;
    thud();
    const id = beginWorkout(workout.id);
    router.push(`/workout/${id}`);
  };

  const whenLabel = picked ? 'Выбрана вручную' : nxt?.when === 'today' ? 'Сегодня' : nxt?.when === 'next' ? 'Следующая' : nxt ? `${DAYS_FULL[(WEEKDAYS.indexOf(nxt.when as never) + 1) % 7]}` : '';

  return (
    <Screen
      headerBand
      title={open ? 'Тренировка идёт' : workout ? workout.name : 'Pero'}
      subtitle={`${DAYS_FULL[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]}`}
      right={<IconBtn name="gear" onPress={() => router.push('/settings')} color={t.id === 'energy' ? t.c.onHeader : t.c.ink} label="Настройки" />}
    >
      {update && (
        <Animated.View entering={FadeInDown.duration(350)}>
          <Card onPress={installUpdate} style={{ borderColor: t.c.accent }}>
            <Row>
              <View style={{ transform: [{ rotate: "180deg" }] }}><Icon name="share" color={t.c.accent} size={22} /></View>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt v="h3">Доступно обновление</Txt>
                <Txt v="small" color={t.c.muted}>Нажми, чтобы скачать и установить. Данные сохранятся.</Txt>
              </View>
            </Row>
          </Card>
        </Animated.View>
      )}
      {open && (
        <Animated.View entering={FadeInDown.duration(350)}>
          <Card onPress={() => router.push(`/workout/${open.id}`)} style={{ backgroundColor: t.c.accent, borderWidth: 0 }}>
            <Row>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: t.f.display, fontSize: 18, color: t.c.onAccent }}>{open.workoutName}</Text>
                <Text style={{ fontFamily: t.f.medium, fontSize: 13.5, color: t.c.onAccent, opacity: 0.85 }}>
                  Идёт {clock((Date.now() - open.startedAt) / 1000)} · {openRows.filter((r) => r.completedAt && r.kind === 'work').length} из {openRows.filter((r) => r.kind === 'work').length} подходов
                </Text>
              </View>
              <View style={{ backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 999, padding: 10 }}>
                <Icon name="play" size={22} color={t.c.onAccent} />
              </View>
            </Row>
          </Card>
        </Animated.View>
      )}

      {!program && (
        <Empty icon="list" title="Нет программы" text="Выбери готовую программу или собери свою" action={<Btn title="К программам" onPress={() => router.push('/program')} />} />
      )}

      {program && workout && !open && (
        <Animated.View entering={FadeInDown.duration(400)}>
          <Card pad={16} style={{ gap: 14 }}>
            <Row>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt v="label" color={t.c.accentText}>{whenLabel}</Txt>
                <Txt v="h2">{workout.name}</Txt>
                <Txt v="small">
                  {workout.exercises.length} {plural(workout.exercises.length, 'упражнение', 'упражнения', 'упражнений')} · ~{estimateMin(workout)} мин
                </Txt>
              </View>
              {phase?.label && (
                <View style={{ backgroundColor: t.c.chip, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, maxWidth: 150 }}>
                  <Text numberOfLines={2} style={{ fontFamily: t.f.semibold, fontSize: 12, color: t.c.warm, textAlign: 'center' }}>{phase.label}{phase.rir !== undefined ? ` · RIR ${phase.rir}` : ''}</Text>
                </View>
              )}
            </Row>
            <View style={{ gap: 10 }}>
              {workout.exercises.map((x, i) => {
                const d = defs.get(x.exercise);
                const v = d?.variants?.find((vv) => vv.id === x.variant);
                return (
                  <Row key={`${x.exercise}${i}`} gap={12}>
                    <ExerciseArt def={d} variantId={x.variant ?? null} size={38} />
                    <View style={{ flex: 1 }}>
                      <Txt v="medium" numberOfLines={1}>{d?.name ?? x.exercise}</Txt>
                      <Txt v="small" numberOfLines={1}>{v ? `${v.name} · ` : ''}{x.sets} × {rangeLabel(x.reps)}{x.group ? ` · суперсет ${x.group}` : ''}</Txt>
                    </View>
                  </Row>
                );
              })}
            </View>
            <Btn title="Начать тренировку" icon="play" onPress={start} />
          </Card>
        </Animated.View>
      )}

      {program && !open && program.program.workouts.length > 1 && (
        <View style={{ gap: 8 }}>
          <Txt v="label">Другая тренировка</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {program.program.workouts.map((w) => (
              <Chip key={w.id} label={w.name} on={w.id === wid} onPress={() => setPicked(w.id === nxt?.workoutId ? null : w.id)} />
            ))}
            <Chip label="Свободная" onPress={() => { const id = beginEmptyWorkout(); router.push(`/workout/${id}`); }} />
          </View>
        </View>
      )}

      {program && (
        <Animated.View entering={FadeInDown.delay(80).duration(400)}>
          <StreakCard s={computeStreak(sessions.map((x) => x.startedAt), weeklyGoal(program.program))} onPress={() => router.push('/achievements')} />
        </Animated.View>
      )}

      {needDeload && (
        <Card style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Icon name="info" size={22} color={t.c.warm} />
          <View style={{ flex: 1 }}>
            <Txt v="medium">Похоже, копится усталость</Txt>
            <Txt v="small">Три тренировки подряд с усталостью 4–5. Подумай о разгрузочной неделе: половина подходов с теми же весами и RIR 3.</Txt>
          </View>
        </Card>
      )}

      {program && (
        <>
          <SectionTitle right={plannedCount ? <Txt v="small">{thisWeekCount} из {plannedCount}</Txt> : undefined}>Эта неделя</SectionTitle>
          <Card>
            <Row gap={6} style={{ justifyContent: 'space-between' }}>
              {WEEKDAYS.map((wd, i) => {
                const d = new Date(monday);
                d.setDate(monday.getDate() + i);
                const done = weekDone.has(dayKey(d.getTime()));
                const isToday = weekdayOf(now) === wd;
                const planned = program.program.schedule.type === 'weekly' ? program.program.schedule.days[wd] : undefined;
                const pw = planned ? program.program.workouts.find((w) => w.id === planned) : undefined;
                return (
                  <Press key={wd} haptic={false} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontFamily: isToday ? t.f.bold : t.f.medium, fontSize: 12, color: isToday ? t.c.accentText : t.c.muted }}>{WEEKDAY_RU[wd]}</Text>
                    <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? t.c.accent : planned ? t.c.chip : 'transparent', borderWidth: isToday && !done ? 2 : 0, borderColor: t.c.accent }}>
                      {done ? <Icon name="check" size={18} color={t.c.onAccent} strokeWidth={2.6} /> : <Text style={{ fontFamily: t.f.bold, fontSize: 12, color: planned ? t.c.ink : t.c.faint }}>{d.getDate()}</Text>}
                    </View>
                    <Text numberOfLines={1} style={{ fontFamily: t.f.medium, fontSize: 10, color: t.c.muted }}>{pw ? shortName(pw.name) : ' '}</Text>
                  </Press>
                );
              })}
            </Row>
          </Card>
        </>
      )}

      {last && (
        <>
          <SectionTitle>Прошлая тренировка</SectionTitle>
          <Card onPress={() => router.push(`/history/${last.id}`)}>
            <Row>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt v="medium">{last.workoutName}</Txt>
                <Txt v="small">
                  {new Date(last.startedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} · {clock(((last.finishedAt ?? last.startedAt) - last.startedAt) / 1000)}
                </Txt>
              </View>
              <Icon name="chevron" size={20} color={t.c.muted} />
            </Row>
          </Card>
        </>
      )}
    </Screen>
  );
}

function shortName(n: string) {
  const m = /^(\S+)\s+(\S)/.exec(n);
  return m ? `${m[1].slice(0, 4)} ${m[2]}` : n.slice(0, 6);
}
