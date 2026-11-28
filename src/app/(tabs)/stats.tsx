import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '../../theme';
import { useLive } from '../../db/hooks';
import { exercisesWithHistory, getActiveProgram, getSetting, listBody, listSessions, setsBetween, setsForExercise, upsertBody } from '../../db/repo';
import { defsFor } from '../../features/session';
import { exportExcel } from '../../features/files';
import { MUSCLE_RU, MUSCLE_ZONE, e1rm, plannedWeeklySets, setsPerMuscle } from '../../core/training';
import type { Muscle } from '../../core/program';
import { clock, num, parseNum, plural } from '../../core/units';
import { Btn, Card, Chip, Field, IconBtn, Row, Screen, SectionTitle, Segmented, Txt, Empty, toast } from '../../ui/kit';
import { ColumnChart, Heatmap, LineChart, ZoneBars, dayKey } from '../../ui/charts';
import { Icon } from '../../ui/Icon';
import { BodyMap, type Sex } from '../../ui/BodyMap';
import { BodySection } from '../../ui/BodySection';
import { computeStreak } from '../../core/streak';
import { weeklyGoal } from '../../features/achievements';

const DAY = 86400000;
const weekStart = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
};

export default function Stats() {
  const t = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState<'strength' | 'volume' | 'body'>('strength');
  const program = useLive(() => getActiveProgram());
  const defs = useMemo(() => defsFor(program), [program]);
  const sessions = useLive(() => listSessions(400));
  const exList = useLive(() => exercisesWithHistory());
  const [ex, setEx] = useState<string | null>(null);
  const exId = ex ?? exList[0]?.exerciseId ?? null;
  const exSets = useLive(() => (exId ? setsForExercise(exId) : []), [exId]);
  const thisWeek = weekStart(Date.now());
  const [weekOffset, setWeekOffset] = useState(0);
  const wFrom = thisWeek - weekOffset * 7 * DAY;
  const weekSets = useLive(() => setsBetween(wFrom, wFrom + 7 * DAY), [wFrom]);
  const recent = useLive(() => setsBetween(thisWeek - 7 * 7 * DAY));
  const body = useLive(() => listBody());
  const [exporting, setExporting] = useState(false);

  // Сводка
  const last30 = sessions.filter((s) => s.startedAt > Date.now() - 30 * DAY).length;
  const tonnageWeek = sessions.filter((s) => s.startedAt >= thisWeek).reduce((a, s) => a + s.tonnage, 0);
  const tonnagePrev = sessions.filter((s) => s.startedAt >= thisWeek - 7 * DAY && s.startedAt < thisWeek).reduce((a, s) => a + s.tonnage, 0);
  // Та же серия, что на главной: недели, где выполнен план по тренировкам
  const streak = computeStreak(sessions.map((x) => x.startedAt), weeklyGoal(program?.program)).weeks;
  const days = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sessions) m.set(dayKey(s.startedAt), (m.get(dayKey(s.startedAt)) ?? 0) + 1);
    return m;
  }, [sessions]);

  // Сила по упражнению
  const strength = useMemo(() => {
    const by = new Map<number, { at: number; e: number }>();
    for (const s of exSets) {
      if (s.kind !== 'work' || !s.weight || !s.reps) continue;
      const e = e1rm(s.weight, s.reps, s.rir ?? 0);
      const cur = by.get(s.sessionId);
      if (!cur || e > cur.e) by.set(s.sessionId, { at: s.startedAt, e });
    }
    const pts = [...by.values()].sort((a, b) => a.at - b.at).map((p) => ({ x: p.at, y: p.e }));
    const first = pts[0]?.y ?? 0;
    const lastV = pts[pts.length - 1]?.y ?? 0;
    return { pts, delta: lastV - first, best: Math.max(0, ...pts.map((p) => p.y)) };
  }, [exSets]);

  // Объём недели по мышцам против плана
  const factMap = useMemo(() => setsPerMuscle(weekSets, defs), [weekSets, defs]);
  const planMap = useMemo(() => (program ? plannedWeeklySets(program.program, defs) : new Map<Muscle, number>()), [program, defs]);
  const [bodyMode, setBodyMode] = useState<'fact' | 'plan'>('fact');
  const sex = useLive(() => getSetting<Sex>('profile.sex', 'm'));
  const volRows = useMemo(() => {
    const fact = factMap;
    const plan = planMap;
    const keys = new Set([...fact.keys(), ...[...plan.entries()].filter(([, v]) => v >= 2).map(([k]) => k)]);
    return [...keys].map((k) => ({ label: MUSCLE_RU[k], value: fact.get(k) ?? 0, plan: plan.get(k), zone: MUSCLE_ZONE[k] })).sort((a, b) => (b.plan ?? 0) - (a.plan ?? 0) || b.value - a.value);
  }, [factMap, planMap]);

  const tonnageWeeks = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => {
      const from = thisWeek - (7 - i) * 7 * DAY;
      const v = sessions.filter((s) => s.startedAt >= from && s.startedAt < from + 7 * DAY).reduce((a, s) => a + s.tonnage, 0);
      const d = new Date(from);
      return { label: `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`, value: v / 1000 };
    });
  }, [sessions, thisWeek]);

  const rest = useMemo(() => {
    const r = recent.filter((s) => s.kind === 'work' && s.restActualS != null && s.restPlannedS);
    if (!r.length) return null;
    const avgA = r.reduce((a, s) => a + s.restActualS!, 0) / r.length;
    const avgP = r.reduce((a, s) => a + s.restPlannedS!, 0) / r.length;
    return { avgA, avgP, n: r.length };
  }, [recent]);

  const feel = sessions.filter((s) => s.mood != null || s.fatigue != null).slice(0, 20).reverse();

  const doExport = async () => {
    setExporting(true);
    try {
      await exportExcel();
    } catch (e) {
      toast((e as Error).message, 'info');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Screen headerBand title="Прогресс" subtitle={`${sessions.length} ${plural(sessions.length, 'тренировка', 'тренировки', 'тренировок')} всего`} right={<IconBtn name="share" onPress={doExport} color={t.id === 'energy' ? t.c.onHeader : t.c.ink} label="Экспорт в Excel" />}>
      <Row gap={8}>
        <Kpi label="за 30 дней" value={String(last30)} sub={plural(last30, 'тренировка', 'тренировки', 'тренировок')} />
        <Kpi label="тоннаж недели" value={`${num(tonnageWeek / 1000)} т`} sub={tonnagePrev ? `${tonnageWeek >= tonnagePrev ? '+' : ''}${num((tonnageWeek - tonnagePrev) / 1000)} т` : ' '} good={tonnageWeek >= tonnagePrev} />
        <Kpi label={`${plural(streak, 'неделя', 'недели', 'недель')} подряд`} value={String(streak)} sub="по плану" />
      </Row>

      <Card style={{ gap: 12 }}>
        <Row>
          <Txt v="label" style={{ flex: 1 }}>Мышцы за неделю</Txt>
          <Txt v="small">{bodyMode === 'fact' ? `${weekSets.filter((x) => x.kind === 'work' && x.completedAt).length} подходов` : 'по программе'}</Txt>
        </Row>
        <Segmented value={bodyMode} onChange={setBodyMode} options={[{ id: 'fact', label: 'Сделано' }, { id: 'plan', label: 'План' }]} />
        <BodyMap load={bodyMode === 'fact' ? factMap : planMap} mode={bodyMode === 'fact' ? 'heat' : 'zones'} sex={sex} height={290} />
        {bodyMode === 'plan' && (
          <Row gap={14} style={{ justifyContent: 'center' }}>
            {[['#7f9bff', 'мало'], [t.c.good, 'в зоне роста'], [t.c.warm, 'много']].map(([c, l]) => (
              <Row key={l} gap={5}><View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: c }} /><Txt v="small">{l}</Txt></Row>
            ))}
          </Row>
        )}
      </Card>

      <Card style={{ gap: 10 }}>
        <Row>
          <Txt v="label" style={{ flex: 1 }}>Тренировки за 16 недель</Txt>
          <Icon name="calendar" size={16} color={t.c.muted} />
        </Row>
        <Heatmap days={days} />
      </Card>

      <Segmented value={tab} onChange={setTab} options={[{ id: 'strength', label: 'Сила' }, { id: 'volume', label: 'Объём' }, { id: 'body', label: 'Тело' }]} />

      {tab === 'strength' && (
        <Animated.View entering={FadeIn} style={{ gap: 12 }}>
          {!exList.length ? (
            <Empty icon="chart" title="Пока нет данных" text="Проведи первую тренировку, и здесь появятся графики силы по каждому упражнению" />
          ) : (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {exList.slice(0, 14).map((e) => (
                  <Chip key={e.exerciseId} small label={defs.get(e.exerciseId)?.name ?? e.exerciseId} on={e.exerciseId === exId} onPress={() => setEx(e.exerciseId)} />
                ))}
              </View>
              {exId && (
                <Card style={{ gap: 10 }} onPress={() => router.push(`/exercise/${exId}`)}>
                  <Row>
                    <View style={{ flex: 1 }}>
                      <Txt v="h3">{defs.get(exId)?.name}</Txt>
                      <Txt v="small">Расчётный 1ПМ по лучшему подходу</Txt>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontFamily: t.f.num, fontSize: 22, color: t.c.ink }}>{num(strength.best)} кг</Text>
                      {strength.pts.length > 1 && <Text style={{ fontFamily: t.f.bold, fontSize: 12.5, color: strength.delta >= 0 ? t.c.good : t.c.bad }}>{strength.delta >= 0 ? '+' : ''}{num(strength.delta)} кг с начала</Text>}
                    </View>
                  </Row>
                  <LineChart points={strength.pts} />
                </Card>
              )}
            </>
          )}
        </Animated.View>
      )}

      {tab === 'volume' && (
        <Animated.View entering={FadeIn} style={{ gap: 12 }}>
          <Card style={{ gap: 12 }}>
            <Row>
              <IconBtn name="back" size={34} onPress={() => setWeekOffset((x) => x + 1)} label="Неделя назад" />
              <Txt v="medium" center style={{ flex: 1 }}>
                {weekOffset === 0 ? 'Эта неделя' : weekOffset === 1 ? 'Прошлая неделя' : `Неделя с ${new Date(wFrom).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`}
              </Txt>
              <IconBtn name="chevron" size={34} onPress={() => setWeekOffset((x) => Math.max(0, x - 1))} color={weekOffset ? t.c.ink : t.c.faint} label="Неделя вперёд" />
            </Row>
            {volRows.length ? <ZoneBars rows={volRows} /> : <Txt v="small" center>За эту неделю подходов нет</Txt>}
            <Txt v="small">Сделано / по плану. Зелёная зона — нужный для роста объём, у каждой мышцы свой.</Txt>
          </Card>
          <Card style={{ gap: 10 }}>
            <Txt v="label">Тоннаж по неделям, тонн</Txt>
            <ColumnChart data={tonnageWeeks} format={(v) => num(v)} />
          </Card>
          {rest && (
            <Card style={{ gap: 6 }}>
              <Txt v="label">Отдых между подходами, 8 недель</Txt>
              <Row>
                <Text style={{ fontFamily: t.f.num, fontSize: 26, color: t.c.ink }}>{clock(rest.avgA)}</Text>
                <Txt v="small" style={{ flex: 1, marginLeft: 10 }}>в среднем при плане {clock(rest.avgP)}</Txt>
              </Row>
              <Txt v="small">
                {rest.avgA < rest.avgP * 0.8
                  ? 'Отдыхаешь заметно меньше плана. Короткий отдых снижает объём в следующих подходах (Schoenfeld 2016).'
                  : rest.avgA > rest.avgP * 1.4
                    ? 'Отдыхаешь сильно дольше плана, тренировка растягивается.'
                    : 'Отдых в пределах плана.'}
              </Txt>
            </Card>
          )}
          {feel.length > 1 && (
            <Card style={{ gap: 8 }}>
              <Txt v="label">Самочувствие и усталость</Txt>
              <LineChart points={feel.filter((s) => s.mood != null).map((s) => ({ x: s.startedAt, y: s.mood! }))} secondary={feel.filter((s) => s.fatigue != null).map((s) => ({ x: s.startedAt, y: s.fatigue! }))} unit="" height={150} />
              <Txt v="small">Линия: самочувствие. Пунктир: усталость. Если усталость растёт, а самочувствие падает, пора на разгрузку.</Txt>
            </Card>
          )}
        </Animated.View>
      )}

      {tab === 'body' && <BodySection body={body} />}

      <Btn kind="secondary" icon="file" title={exporting ? 'Готовлю файл…' : 'Выгрузить всё в Excel'} onPress={doExport} disabled={exporting} />
    </Screen>
  );
}

function Kpi({ label, value, sub, good }: { label: string; value: string; sub: string; good?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.c.card, borderRadius: t.r.md, padding: 12, borderWidth: t.border, borderColor: t.c.line, gap: 2 }}>
      <Text style={{ fontFamily: t.f.num, fontSize: 22, color: t.c.ink }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={{ fontFamily: t.f.medium, fontSize: 11.5, color: t.c.muted }}>{label}</Text>
      <Text style={{ fontFamily: t.f.bold, fontSize: 11.5, color: good === undefined ? t.c.muted : good ? t.c.good : t.c.bad }}>{sub}</Text>
    </View>
  );
}
