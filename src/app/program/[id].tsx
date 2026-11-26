// Конструктор программы: дни, расписание, упражнения. Все изменения сохраняются сразу.
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { useTheme } from '../../theme';
import { useLive } from '../../db/hooks';
import { getLibrary, getProgram, saveProgram, activateProgram } from '../../db/repo';
import { setPickHandler } from '../../features/picker';
import { exerciseIndex, WEEKDAYS, type PlannedExercise, type Program, type Workout } from '../../core/program';
import { WEEKDAY_RU, plannedWeeklySets, MUSCLE_RU } from '../../core/training';
import { durationToken, parseDuration, parseRange, rangeLabel, restLabel, num, parseNum } from '../../core/units';
import { Btn, Card, Chip, Field, IconBtn, Press, Row, Screen, SectionTitle, Segmented, Sheet, Txt, toast } from '../../ui/kit';
import { ExerciseArt } from '../../ui/ExerciseArt';
import { Icon } from '../../ui/Icon';
import { RirExplainer } from '../../ui/workout';

const RIR_CHOICES = ['0', '0-1', '1', '1-2', '2', '2-3', '3'];
const REST_CHOICES = [45, 60, 90, 120, 150, 180, 240];

export default function ProgramEditor() {
  const t = useTheme();
  const router = useRouter();
  const { id, workout: initialWorkout } = useLocalSearchParams<{ id: string; workout?: string }>();
  const pid = Number(id);
  const stored = useMemo(() => getProgram(pid), [pid]);
  const lib = useLive(() => getLibrary());
  const [p, setP] = useState<Program | null>(stored?.program ?? null);
  const [sel, setSel] = useState<string>(initialWorkout ?? stored?.program.workouts[0]?.id ?? '');
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [rirInfo, setRirInfo] = useState(false);
  const defs = useMemo(() => exerciseIndex(lib, p), [lib, p]);

  // Автосохранение
  useEffect(() => {
    if (p && stored) saveProgram(p, { id: pid });
  }, [p, pid, stored]);

  if (!p || !stored) {
    return (
      <Screen back title="Программа">
        <Txt>Программа не найдена</Txt>
      </Screen>
    );
  }

  const w = p.workouts.find((x) => x.id === sel) ?? p.workouts[0];
  const wi = p.workouts.indexOf(w);
  const update = (f: (draft: Program) => Program) => setP((cur) => (cur ? f(structuredClone(cur)) : cur));
  const updateW = (f: (w: Workout) => void) => update((d) => { f(d.workouts[wi]); return d; });
  const updateX = (i: number, patch: Partial<PlannedExercise>) => updateW((ww) => {
    const next = { ...ww.exercises[i], ...patch };
    for (const k of Object.keys(next) as (keyof PlannedExercise)[]) if (next[k] === undefined) delete next[k];
    ww.exercises[i] = next;
  });

  const addDay = () => {
    const letters = 'ABCDEFGHIJ';
    let n = p.workouts.length;
    let nid = `day-${letters[n].toLowerCase()}`;
    while (p.workouts.some((x) => x.id === nid)) nid = `day-${letters[++n % 10].toLowerCase()}${n}`;
    update((d) => {
      d.workouts.push({ id: nid, name: `День ${letters[d.workouts.length] ?? d.workouts.length + 1}`, exercises: [] as unknown as Workout['exercises'] });
      return d;
    });
    setSel(nid);
  };
  const deleteDay = () => {
    if (p.workouts.length <= 1) return toast('В программе должна остаться хотя бы одна тренировка', 'info');
    update((d) => {
      d.workouts = d.workouts.filter((x) => x.id !== w.id);
      if (d.schedule.type === 'weekly') for (const k of WEEKDAYS) if (d.schedule.days[k] === w.id) delete d.schedule.days[k];
      if (d.schedule.type === 'rotation') d.schedule.order = d.schedule.order.filter((x) => x !== w.id);
      return d;
    });
    setSel(p.workouts.find((x) => x.id !== w.id)!.id);
  };
  const addExercise = () => {
    setPickHandler((exId) => {
      const def = defs.get(exId) ?? getLibrary().find((e) => e.id === exId);
      updateW((ww) => {
        ww.exercises.push({ exercise: exId, sets: 3, reps: def?.type === 'time' ? '30-60s' : '8-12', rir: '1-2', rest: '2m', ...(def?.variants?.length ? { variant: def.variants[0].id } : {}) });
      });
      setEditIdx(w.exercises.length);
    });
    router.push('/library?pick=1');
  };
  const move = (i: number, dir: -1 | 1) => updateW((ww) => {
    const j = i + dir;
    if (j < 0 || j >= ww.exercises.length) return;
    [ww.exercises[i], ww.exercises[j]] = [ww.exercises[j], ww.exercises[i]];
  });

  const vol = plannedWeeklySets(p, defs);
  const weekVol = [...vol.entries()].filter(([, v]) => v >= 1).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const editing = editIdx !== null ? w.exercises[editIdx] : null;
  const editDef = editing ? defs.get(editing.exercise) : undefined;

  return (
    <Screen
      back
      title={p.name}
      subtitle={stored.isActive ? 'Основная программа · сохраняется автоматически' : 'Сохраняется автоматически'}
      right={<IconBtn name="edit" onPress={() => setRenameOpen(true)} label="Переименовать" />}
    >
      {!stored.isActive && (
        <Btn kind="secondary" icon="check" title="Сделать основной" onPress={() => { activateProgram(pid); toast('Программа стала основной', 'check'); }} />
      )}

      <SectionTitle>Расписание</SectionTitle>
      <Card style={{ gap: 12 }}>
        <Segmented
          value={p.schedule.type}
          onChange={(v) => update((d) => {
            d.schedule = v === 'weekly'
              ? { type: 'weekly', days: Object.fromEntries(d.workouts.slice(0, 7).map((x, i) => [WEEKDAYS[[0, 1, 3, 4, 5, 2, 6][i]], x.id])) }
              : { type: 'rotation', order: d.workouts.map((x) => x.id) };
            return d;
          })}
          options={[{ id: 'weekly', label: 'По дням недели' }, { id: 'rotation', label: 'По кругу' }]}
        />
        {p.schedule.type === 'weekly' ? (
          WEEKDAYS.map((wd) => {
            const cur = p.schedule.type === 'weekly' ? p.schedule.days[wd] : undefined;
            return (
              <Row key={wd} gap={8}>
                <Text style={{ width: 28, fontFamily: t.f.bold, color: cur ? t.c.ink : t.c.faint }}>{WEEKDAY_RU[wd]}</Text>
                {/* Одна строка на день: листается вбок, если тренировок много */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ gap: 6, paddingRight: 8 }}>
                  <Chip small label="Отдых" on={!cur} onPress={() => update((d) => { if (d.schedule.type === 'weekly') delete d.schedule.days[wd]; return d; })} />
                  {p.workouts.map((x) => (
                    <Chip key={x.id} small label={x.name} on={cur === x.id} onPress={() => update((d) => { if (d.schedule.type === 'weekly') d.schedule.days[wd] = x.id; return d; })} />
                  ))}
                </ScrollView>
              </Row>
            );
          })
        ) : (
          <View style={{ gap: 8 }}>
            <Txt v="small">Тренировки идут по кругу, приложение предлагает следующую. Нажми, чтобы убрать из круга.</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              {p.schedule.order.map((x, i) => (
                <Chip key={`${x}${i}`} small label={x === 'rest' ? 'Отдых' : p.workouts.find((ww) => ww.id === x)?.name ?? x} onPress={() => update((d) => { if (d.schedule.type === 'rotation' && d.schedule.order.length > 1) d.schedule.order.splice(i, 1); return d; })} />
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {[...p.workouts.map((x) => ({ id: x.id, name: x.name })), { id: 'rest', name: 'Отдых' }].map((x) => (
                <Chip key={x.id} small label={`+ ${x.name}`} on={false} onPress={() => update((d) => { if (d.schedule.type === 'rotation') d.schedule.order.push(x.id); return d; })} />
              ))}
            </View>
          </View>
        )}
      </Card>

      <SectionTitle>Тренировки</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {p.workouts.map((x) => <Chip key={x.id} label={x.name} on={x.id === w.id} onPress={() => setSel(x.id)} />)}
        <Chip label="+ День" onPress={addDay} />
      </View>

      <Card style={{ gap: 10 }}>
        <Field label="Название тренировки" value={w.name} onChangeText={(s) => updateW((ww) => { ww.name = s; })} />
        {w.exercises.length === 0 && <Txt v="small" center style={{ paddingVertical: 12 }}>Пока пусто. Добавь первое упражнение.</Txt>}
        {w.exercises.map((x, i) => {
          const d = defs.get(x.exercise);
          const v = d?.variants?.find((vv) => vv.id === x.variant);
          return (
            <Animated.View key={`${x.exercise}-${i}`} layout={LinearTransition.springify().damping(18)} entering={FadeIn}>
              <Press onPress={() => setEditIdx(i)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: t.c.chip, borderRadius: t.r.md, padding: 8 }}>
                <ExerciseArt def={d} variantId={x.variant ?? null} size={40} />
                <View style={{ flex: 1 }}>
                  <Txt v="medium" numberOfLines={1}>{d?.name ?? x.exercise}</Txt>
                  <Txt v="small" numberOfLines={1}>
                    {x.group ? `${x.group} · ` : ''}{v ? `${v.name} · ` : ''}{x.sets} × {rangeLabel(x.reps)}{x.rir !== undefined ? ` · RIR ${String(x.rir).replace('-', '–')}` : ''} · {restLabel(parseDuration(x.rest))}
                  </Txt>
                </View>
                <View style={{ gap: 2 }}>
                  <IconBtn name="up" size={30} onPress={() => move(i, -1)} color={i ? t.c.ink : t.c.faint} label="Выше" />
                  <IconBtn name="down" size={30} onPress={() => move(i, 1)} color={i < w.exercises.length - 1 ? t.c.ink : t.c.faint} label="Ниже" />
                </View>
              </Press>
            </Animated.View>
          );
        })}
        <Btn kind="secondary" icon="plus" title="Добавить упражнение" onPress={addExercise} />
        <Btn kind="danger" small icon="trash" title="Удалить этот день" onPress={deleteDay} />
      </Card>

      {weekVol.length > 0 && (
        <Card style={{ gap: 6 }}>
          <Txt v="label">Объём в неделю (рабочих подходов)</Txt>
          <Txt v="small" style={{ color: t.c.ink }}>{weekVol.map(([m, v]) => `${MUSCLE_RU[m]} ${num(v)}`).join(' · ')}</Txt>
        </Card>
      )}

      <SectionTitle>Дополнительно</SectionTitle>
      <Card style={{ gap: 12 }}>
        <Txt v="label">Прогрессия</Txt>
        <Segmented
          value={p.progression?.type ?? 'double'}
          onChange={(v) => update((d) => { d.progression = { ...d.progression, type: v }; return d; })}
          options={[{ id: 'double', label: 'Двойная' }, { id: 'linear', label: 'Линейная' }, { id: 'none', label: 'Без подсказок' }]}
        />
        <Txt v="small">
          {(p.progression?.type ?? 'double') === 'double' ? 'Сделал верх диапазона во всех подходах, тогда прибавляешь вес.' : p.progression?.type === 'linear' ? 'Каждая тренировка +шаг веса. Подходит новичкам.' : 'Приложение не подсказывает вес.'}
        </Txt>
        <Txt v="label">Разминочные подходы</Txt>
        <Segmented
          value={p.warmup?.suggest === false ? 'off' : 'on'}
          onChange={(v) => update((d) => { d.warmup = { ...d.warmup, suggest: v === 'on' }; return d; })}
          options={[{ id: 'on', label: 'Предлагать' }, { id: 'off', label: 'Не нужно' }]}
        />
        <Txt v="label">Разгрузочная неделя</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {[0, 4, 5, 6, 7, 8].map((n) => (
            <Chip key={n} small label={n ? `каждые ${n} нед` : 'нет'} on={(p.deload?.every_weeks ?? 0) === n} onPress={() => update((d) => { if (n) d.deload = { every_weeks: n, sets_factor: 0.5, rir: 3 }; else delete d.deload; return d; })} />
          ))}
        </View>
      </Card>

      <Sheet open={renameOpen} onClose={() => setRenameOpen(false)} title="Программа">
        <Field label="Название" value={p.name} onChangeText={(s) => update((d) => { d.name = s || 'Без названия'; return d; })} />
        <Field label="Описание" value={p.description ?? ''} onChangeText={(s) => update((d) => { if (s) d.description = s; else delete d.description; return d; })} multiline />
        <Field label="Автор" value={p.author ?? ''} onChangeText={(s) => update((d) => { if (s) d.author = s; else delete d.author; return d; })} />
        <Btn title="Готово" onPress={() => setRenameOpen(false)} />
      </Sheet>

      <Sheet open={!!editing} onClose={() => setEditIdx(null)} title={editDef?.name ?? editing?.exercise}>
        {editing && editIdx !== null && (
          <>
            {editDef?.variants && editDef.variants.length > 1 && (
              <>
                <Txt v="label">Вариант</Txt>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {editDef.variants.map((v) => <Chip key={v.id} small label={v.name} on={editing.variant === v.id} onPress={() => updateX(editIdx, { variant: v.id })} />)}
                </View>
              </>
            )}
            <Stepper label="Подходов" value={editing.sets} min={1} max={10} onChange={(v) => updateX(editIdx, { sets: v })} />
            <RangeEditor value={editing.reps} onChange={(r) => updateX(editIdx, { reps: r })} />
            <Row>
              <Txt v="label" style={{ flex: 1 }}>Запас до отказа (RIR)</Txt>
              <Press onPress={() => setRirInfo((x) => !x)}><Text style={{ fontFamily: t.f.semibold, color: t.c.accentText, fontSize: 13 }}>{rirInfo ? 'Скрыть' : 'Что это?'}</Text></Press>
            </Row>
            {rirInfo && <RirExplainer />}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {RIR_CHOICES.map((r) => <Chip key={r} small label={r.replace('-', '–')} on={String(editing.rir ?? '') === r} onPress={() => updateX(editIdx, { rir: r.includes('-') ? r : Number(r) })} />)}
            </View>
            <Txt v="label">Отдых</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {REST_CHOICES.map((s) => <Chip key={s} small label={restLabel(s)} on={parseDuration(editing.rest) === s} onPress={() => updateX(editIdx, { rest: durationToken(s) })} />)}
            </View>
            {editDef?.sides === 'optional' && (
              <>
                <Txt v="label">Стороны</Txt>
                <Segmented value={editing.sides ?? 'both'} onChange={(v) => updateX(editIdx, { sides: v === 'both' ? undefined : v })} options={[{ id: 'both', label: 'Обе сразу' }, { id: 'each', label: 'По одной' }]} />
              </>
            )}
            <Txt v="label">Суперсет</Txt>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {['', 'A', 'B', 'C'].map((g) => <Chip key={g} small label={g || 'Нет'} on={(editing.group ?? '') === g} onPress={() => updateX(editIdx, { group: g || undefined })} />)}
            </View>
            <Txt v="small">Упражнения с одной буквой выполняются по очереди без отдыха между ними.</Txt>
            {editDef?.type !== 'time' && (
              <Field label="Стартовый вес, кг (для первой тренировки)" keyboardType="decimal-pad" value={editing.start_weight != null ? num(editing.start_weight, 2) : ''} onChangeText={(s) => updateX(editIdx, { start_weight: parseNum(s) ?? undefined })} placeholder="Подберу сам" />
            )}
            <Field label="Заметка" value={editing.note ?? ''} onChangeText={(s) => updateX(editIdx, { note: s || undefined })} placeholder="Например, с паузой внизу" />
            <Btn title="Готово" onPress={() => setEditIdx(null)} />
            <Btn kind="danger" icon="trash" title="Убрать упражнение" onPress={() => { const i = editIdx; setEditIdx(null); updateW((ww) => { ww.exercises.splice(i, 1); }); }} />
          </>
        )}
      </Sheet>
    </Screen>
  );
}

function Stepper({ label, value, min, max, onChange, suffix }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; suffix?: string }) {
  const t = useTheme();
  return (
    <Row>
      <Txt v="label" style={{ flex: 1 }}>{label}</Txt>
      <IconBtn name="minus" bg={t.c.chip} onPress={() => onChange(Math.max(min, value - 1))} label="Меньше" />
      <Text style={{ fontFamily: t.f.num, fontSize: 20, color: t.c.ink, minWidth: 54, textAlign: 'center' }}>{value}{suffix ?? ''}</Text>
      <IconBtn name="plus" bg={t.c.chip} onPress={() => onChange(Math.min(max, value + 1))} label="Больше" />
    </Row>
  );
}

function RangeEditor({ value, onChange }: { value: number | string; onChange: (v: string | number) => void }) {
  const r = parseRange(value);
  const s = r.time ? 's' : '';
  const set = (min: number, max: number) => {
    const a = Math.max(1, min);
    const b = Math.max(a, max);
    onChange(a === b ? (s ? `${a}s` : a) : `${a}-${b}${s}`);
  };
  const step = r.time ? 5 : 1;
  return (
    <>
      <Stepper label={r.time ? 'Секунд от' : 'Повторений от'} value={r.min} min={1} max={r.time ? 600 : 50} onChange={(v) => set(v, Math.max(v, r.max))} />
      <Stepper label="до" value={r.max} min={r.min} max={r.time ? 600 : 50} onChange={(v) => set(r.min, v)} />
      {step === 5 ? null : null}
    </>
  );
}
