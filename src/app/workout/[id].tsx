import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../theme';
import { useLive } from '../../db/hooks';
import {
  deleteSession, deleteSet, finishSession, getActiveProgram, getPref, getSession, getSetting, lastSetsFor, listSets, setsForExercise, updateSet,
} from '../../db/repo';
import { addExercise, addSet, addWarmups, cleanupSession, defsFor, removeExercise, switchSides, switchVariant } from '../../features/session';
import { setPickHandler } from '../../features/picker';
import { getRest, startRest, stopRest } from '../../features/timer';
import { checkAchievements } from '../../features/achievements';
import { refreshWidget } from '../../widget/handler';
import { e1rm, incrementFor, suggestWeight, type SetLog } from '../../core/training';
import { clock, num, parseRange, plural } from '../../core/units';
import { Btn, Card, Field, IconBtn, Press, Row, Sheet, Txt, success, thud, toast } from '../../ui/kit';
import { ExerciseCard, NumberSheet, RestBar, RirSheet, type NumberField } from '../../ui/workout';
import { Icon } from '../../ui/Icon';

type Edit = { row: SetLog; field: NumberField } | null;

export default function WorkoutScreen() {
  useKeepAwake();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = Number(id);
  const session = useLive(() => getSession(sessionId), [sessionId]);
  const rows = useLive(() => listSets(sessionId), [sessionId]);
  const program = useLive(() => getActiveProgram());
  const defs = useMemo(() => defsFor(program), [program]);
  const step = useLive(() => getSetting('weightStep', 0.5));
  const suggestWarmup = program?.program.warmup?.suggest ?? true;

  const [edit, setEdit] = useState<Edit>(null);
  const [rirRow, setRirRow] = useState<SetLog | null>(null);
  const [menu, setMenu] = useState<number | null>(null);
  const [rowMenu, setRowMenu] = useState<SetLog | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [note, setNote] = useState('');
  const [mood, setMood] = useState<number | null>(null);
  const [fatigue, setFatigue] = useState<number | null>(null);
  const [pending, setPending] = useState<{ setId: number; plannedS: number; label: string } | null>(null);
  const [, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  // Данные по каждому упражнению: строки, прошлый раз, подсказка
  const blocks = useMemo(() => {
    if (!session) return [];
    return session.plan.exercises.map((plan, position) => {
      const def = defs.get(plan.exercise);
      const r = rows.filter((x) => x.position === position);
      const variantId = r[0]?.variantId ?? null;
      const last = lastSetsFor(plan.exercise, variantId, sessionId);
      const inc = incrementFor(def, variantId, getPref(plan.exercise).increment);
      const sug = suggestWeight(plan, last, inc, program?.program.progression?.type ?? 'double');
      const sidesMode: 'both' | 'each' = r.some((x) => x.side !== 'both') ? 'each' : 'both';
      return { plan, position, def, rows: r, last, sug, inc, variantId, sidesMode };
    });
  }, [session, rows, defs, sessionId, program]);

  const firstWarmupPos = blocks.find((b) => b.def?.type === 'weight' && Math.max(0, ...b.rows.map((r) => r.weight ?? 0)) >= 40)?.position;
  const activeRow = rows.find((r) => !r.completedAt) ?? null;
  const doneWork = rows.filter((r) => r.kind === 'work' && r.completedAt);
  const totalWork = rows.filter((r) => r.kind === 'work');
  const tonnage = doneWork.reduce((s, r) => s + (r.weight ?? 0) * (r.reps ?? 0), 0);

  if (!session) {
    return (
      <View style={{ flex: 1, backgroundColor: t.c.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Txt>Тренировка не найдена</Txt>
      </View>
    );
  }
  const elapsed = ((session.finishedAt ?? Date.now()) - session.startedAt) / 1000;
  const readOnly = !!session.finishedAt;

  const nextLabel = (after: SetLog) => {
    const next = rows.find((r) => !r.completedAt && r.id !== after.id);
    if (!next) return 'последний подход';
    return defs.get(next.exerciseId)?.name ?? next.exerciseId;
  };

  const toggle = (r: SetLog) => {
    if (r.completedAt) {
      updateSet(r.id, { completedAt: null });
      if (pending?.setId === r.id) setPending(null);
      return;
    }
    const def = defs.get(r.exerciseId);
    const b = blocks[r.position];
    if (def?.type === 'weight' && r.weight == null) {
      setEdit({ row: r, field: 'weight' });
      return;
    }
    const patch: Partial<SetLog> = { completedAt: Date.now() };
    if (def?.type === 'time') {
      if (r.durationS == null) patch.durationS = parseRange(b.plan.reps).min;
    } else if (r.reps == null) {
      const prev = b.last.find((l) => l.kind === r.kind && l.setIndex === r.setIndex && l.side === r.side);
      patch.reps = prev?.reps ?? parseRange(b.plan.reps).min;
    }
    if (getRest()) stopRest();
    updateSet(r.id, patch);
    success();
    // Отдых после подхода по одной стороне — только после второй стороны
    const sameIndexOther = r.side === 'left' ? rows.find((x) => x.position === r.position && x.setIndex === r.setIndex && x.side === 'right' && !x.completedAt) : null;
    if (!sameIndexOther) setPending({ setId: r.id, plannedS: r.restPlannedS ?? 120, label: nextLabel(r) });
    checkRecord(r, { ...r, ...patch } as SetLog);
    checkAchievements();
  };

  const checkRecord = (r: SetLog, filled: SetLog) => {
    if (filled.kind !== 'work' || !filled.weight || !filled.reps) return;
    const v = e1rm(filled.weight, filled.reps, filled.rir ?? 0);
    const hist = setsForExercise(r.exerciseId).filter((x) => x.sessionId !== sessionId && x.kind === 'work' && x.weight && x.reps && x.variantId === r.variantId);
    if (hist.length < 2) return;
    const best = Math.max(...hist.map((x) => e1rm(x.weight!, x.reps!, x.rir ?? 0)));
    if (v > best + 0.01) {
      thud();
      toast(`Новый рекорд: расчётный максимум ${num(v)} кг`, 'trophy');
    }
  };

  const applyNumber = (v: number | null) => {
    if (!edit) return;
    const { row, field } = edit;
    if (field === 'weight') {
      updateSet(row.id, { weight: v });
      // Новый вес переносим в следующие незаполненные подходы этого упражнения
      for (const r of rows) {
        if (r.position === row.position && r.kind === row.kind && r.side === row.side && r.setIndex > row.setIndex && !r.completedAt && (r.weight == null || r.weight === row.weight)) {
          updateSet(r.id, { weight: v });
        }
      }
    } else if (field === 'reps') updateSet(row.id, { reps: v == null ? null : Math.round(v) });
    else updateSet(row.id, { durationS: v == null ? null : Math.round(v) });
    setEdit(null);
  };

  const startPending = () => {
    if (!pending) return;
    startRest(pending.setId, pending.plannedS, pending.label);
    setPending(null);
  };

  const openPicker = () => {
    setPickHandler((exId) => {
      addExercise(sessionId, exId);
      toast('Упражнение добавлено', 'plus');
    });
    router.push('/library?pick=1');
  };

  const finish = () => {
    if (getRest()) stopRest();
    cleanupSession(sessionId);
    if (!doneWork.length) {
      deleteSession(sessionId);
      router.back();
      return;
    }
    finishSession(sessionId, { note: note.trim() || undefined, mood, fatigue });
    success();
    setFinishOpen(false);
    checkAchievements();
    refreshWidget();
    router.replace(`/history/${sessionId}?fresh=1`);
  };

  // Параметры для шторки ввода числа
  const sheet = (() => {
    if (!edit) return null;
    const b = blocks[edit.row.position];
    const prev = b?.last.find((l) => l.kind === edit.row.kind && l.setIndex === edit.row.setIndex && l.side === edit.row.side);
    if (edit.field === 'weight') {
      const quick = [
        prev?.weight != null && { label: `Прошлый ${num(prev.weight)}`, value: prev.weight },
        b?.sug.weight != null && b.sug.reason === 'increase' && { label: `Новый ${num(b.sug.weight)}`, value: b.sug.weight },
      ].filter(Boolean) as { label: string; value: number }[];
      return { title: b?.def?.type === 'bodyweight' ? 'Дополнительный вес' : 'Вес', unit: 'кг', steps: [step, b?.inc ?? 2.5].filter((x, i, a) => a.indexOf(x) === i), quick, value: edit.row.weight };
    }
    const range = parseRange(b?.plan.reps);
    const opts = Array.from({ length: Math.min(8, range.max - range.min + 1) }, (_, i) => range.min + i);
    if (edit.field === 'duration') {
      return { title: 'Время', unit: 'с', steps: [5, 15], quick: [range.min, range.max].filter((x, i, a) => a.indexOf(x) === i).map((v) => ({ label: `${v} с`, value: v })), value: edit.row.durationS };
    }
    return { title: 'Повторения', unit: 'раз', steps: [1], quick: opts.map((v) => ({ label: String(v), value: v })), value: edit.row.reps ?? prev?.reps ?? null };
  })();

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      {/* Шапка */}
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 12, paddingBottom: 12, backgroundColor: t.id === 'energy' ? t.c.header : t.c.bg, borderBottomLeftRadius: t.id === 'energy' ? 26 : 0, borderBottomRightRadius: t.id === 'energy' ? 26 : 0 }}>
        <Row>
          <IconBtn name="down" onPress={() => router.back()} color={t.c.onHeader} label="Свернуть" />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontFamily: t.f.display, fontSize: t.id === 'energy' ? 17 : 20, color: t.c.onHeader }}>{session.workoutName}</Text>
            <Text style={{ fontFamily: t.f.medium, fontSize: 12.5, color: t.c.onHeaderMuted }}>
              {session.plan.note ? `${session.plan.note} · ` : ''}{doneWork.length} из {totalWork.length} {plural(totalWork.length, 'подхода', 'подходов', 'подходов')}
            </Text>
          </View>
          <View style={{ backgroundColor: t.id === 'energy' ? 'rgba(255,255,255,0.16)' : t.c.chip, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
            <Text style={{ fontFamily: t.f.num, fontSize: 14, color: t.c.onHeader, fontVariant: ['tabular-nums'] }}>{clock(elapsed)}</Text>
          </View>
          {!readOnly && (
            <Press onPress={() => setFinishOpen(true)} style={{ marginLeft: 6, backgroundColor: t.c.accent, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}>
              <Text style={{ fontFamily: t.f.bold, fontSize: 14, color: t.c.onAccent }}>Завершить</Text>
            </Press>
          )}
        </Row>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: t.id === 'energy' ? 'rgba(255,255,255,0.2)' : t.c.chip, marginTop: 10, overflow: 'hidden' }}>
          <View style={{ width: `${totalWork.length ? (doneWork.length / totalWork.length) * 100 : 0}%`, height: '100%', backgroundColor: t.id === 'energy' ? '#ffffff' : t.c.accent }} />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: insets.bottom + 140 }} keyboardShouldPersistTaps="handled">
        {blocks.map((b) => (
          <ExerciseCard
            key={`${b.position}-${b.plan.exercise}`}
            index={b.position}
            plan={b.plan}
            def={b.def}
            rows={b.rows}
            last={b.last}
            hint={b.sug.text}
            hintKind={b.sug.reason === 'increase' ? 'increase' : b.sug.reason === 'reduce' ? 'reduce' : 'other'}
            variantId={b.variantId}
            sidesMode={b.sidesMode}
            activeRowId={activeRow?.id ?? null}
            onVariant={(v) => switchVariant(sessionId, b.position, b.plan.exercise, v)}
            onSides={(m) => {
              if (!switchSides(sessionId, b.position, b.plan.exercise, m)) toast('Нельзя переключить: уже есть выполненные подходы', 'info');
            }}
            onInfo={() => router.push(`/exercise/${b.plan.exercise}`)}
            onEdit={(row, f) => (f === 'rir' ? setRirRow(row) : setEdit({ row, field: f }))}
            onToggle={toggle}
            onLongRow={(row) => setRowMenu(row)}
            onAddSet={() => addSet(sessionId, b.position, rows)}
            onWarmup={suggestWarmup && b.position === firstWarmupPos && !b.rows.some((r) => r.kind === 'warmup') ? () => {
              const n = addWarmups(sessionId, b.position, rows);
              toast(n ? `Добавлено ${n} ${plural(n, 'разминочный подход', 'разминочных подхода', 'разминочных подходов')}` : 'Для такого веса разминка не нужна', 'flame');
            } : undefined}
            onMenu={() => setMenu(b.position)}
          />
        ))}
        <Animated.View entering={FadeInDown.delay(200)}>
          <Card onPress={openPicker} style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, borderStyle: 'dashed', borderWidth: 1.5, borderColor: t.c.faint, backgroundColor: 'transparent' }}>
            <Icon name="plus" size={20} color={t.c.muted} />
            <Txt v="medium" color={t.c.muted}>Добавить упражнение</Txt>
          </Card>
        </Animated.View>
      </ScrollView>

      <RestBar pending={readOnly ? null : pending} onStart={startPending} />

      {sheet && (
        <NumberSheet
          open={!!edit} field={edit!.field} value={sheet.value} title={sheet.title} unit={sheet.unit} steps={sheet.steps} quick={sheet.quick}
          onClose={() => setEdit(null)} onDone={applyNumber}
        />
      )}
      <RirSheet
        open={!!rirRow} value={rirRow?.rir ?? null} target={rirRow ? blocks[rirRow.position]?.plan.rir : undefined}
        onClose={() => setRirRow(null)}
        onPick={(v) => {
          if (rirRow) updateSet(rirRow.id, { rir: v });
          setRirRow(null);
        }}
      />

      <Sheet open={menu !== null} onClose={() => setMenu(null)} title={menu !== null ? defs.get(blocks[menu]?.plan.exercise)?.name : undefined}>
        {menu !== null && (
          <>
            <Btn kind="secondary" icon="info" title="Как делать" onPress={() => { const ex = blocks[menu].plan.exercise; setMenu(null); router.push(`/exercise/${ex}`); }} />
            {!blocks[menu].rows.some((r) => r.kind === 'warmup') && blocks[menu].def?.type === 'weight' && (
              <Btn kind="secondary" icon="flame" title="Добавить разминку" onPress={() => { const n = addWarmups(sessionId, menu, rows); setMenu(null); toast(n ? 'Разминка добавлена' : 'Для такого веса разминка не нужна', 'flame'); }} />
            )}
            <Btn kind="danger" icon="trash" title="Убрать из тренировки" onPress={() => { removeExercise(sessionId, menu); setMenu(null); }} />
          </>
        )}
      </Sheet>

      <Sheet open={!!rowMenu} onClose={() => setRowMenu(null)} title="Подход">
        {rowMenu && (
          <>
            {rowMenu.restActualS != null && <Txt v="small">Отдых после подхода: {clock(rowMenu.restActualS)} из {clock(rowMenu.restPlannedS ?? 0)}</Txt>}
            <Btn kind="danger" icon="trash" title="Удалить подход" onPress={() => { deleteSet(rowMenu.id); setRowMenu(null); }} />
          </>
        )}
      </Sheet>

      <Sheet open={finishOpen} onClose={() => setFinishOpen(false)} title={doneWork.length ? 'Завершить тренировку?' : 'Ни одного подхода'}>
        {doneWork.length ? (
          <>
            <Row gap={8}>
              <Stat label="Время" value={clock(elapsed)} />
              <Stat label="Подходов" value={String(doneWork.length)} />
              <Stat label="Тоннаж" value={`${num(tonnage / 1000)} т`} />
            </Row>
            {doneWork.length < totalWork.length && <Txt v="small">Невыполненные подходы ({totalWork.length - doneWork.length}) не сохранятся.</Txt>}
            <Scale title="Самочувствие" value={mood} onChange={setMood} labels={['Ужасно', 'Плохо', 'Норм', 'Хорошо', 'Отлично']} />
            <Scale title="Усталость" value={fatigue} onChange={setFatigue} labels={['Свежий', 'Легко', 'Средне', 'Устал', 'Выжат']} />
            <Field label="Заметка к тренировке" placeholder="Как самочувствие, что болело, что поменять" value={note} onChangeText={setNote} multiline />
            <Btn title="Сохранить тренировку" icon="check" onPress={finish} />
            <Btn kind="ghost" title="Продолжить" onPress={() => setFinishOpen(false)} />
          </>
        ) : (
          <>
            <Txt v="small">Если завершить сейчас, тренировка не сохранится.</Txt>
            <Btn kind="danger" icon="trash" title="Удалить тренировку" onPress={finish} />
            <Btn kind="ghost" title="Продолжить" onPress={() => setFinishOpen(false)} />
          </>
        )}
      </Sheet>
    </View>
  );
}

function Scale({ title, value, onChange, labels }: { title: string; value: number | null; onChange: (v: number | null) => void; labels: string[] }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Txt v="label">{title}</Txt>
      <Row gap={6}>
        {labels.map((l, i) => {
          const v = i + 1;
          const on = value === v;
          return (
            <Press key={l} onPress={() => onChange(on ? null : v)} style={{ flex: 1 }}>
              <View style={{ backgroundColor: on ? t.c.accent : t.c.chip, borderRadius: t.r.md, paddingVertical: 10, alignItems: 'center', gap: 2 }}>
                <Text style={{ fontFamily: t.f.num, fontSize: 18, color: on ? t.c.onAccent : t.c.ink }}>{v}</Text>
                <Text numberOfLines={1} style={{ fontFamily: t.f.medium, fontSize: 10.5, color: on ? t.c.onAccent : t.c.muted }}>{l}</Text>
              </View>
            </Press>
          );
        })}
      </Row>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.c.chip, borderRadius: t.r.md, padding: 12, gap: 2 }}>
      <Text style={{ fontFamily: t.f.num, fontSize: 20, color: t.c.ink }}>{value}</Text>
      <Text style={{ fontFamily: t.f.medium, fontSize: 12, color: t.c.muted }}>{label}</Text>
    </View>
  );
}
