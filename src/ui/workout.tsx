// Элементы экрана тренировки: строка подхода, карточка упражнения, ввод чисел, выбор RIR, таймер отдыха.
import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition, ZoomIn, useAnimatedStyle, withTiming, interpolateColor, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import type { ExerciseDef, PlannedExercise } from '../core/program';
import type { SetLog } from '../core/training';
import { clock, num, parseNum, parseRange, rangeLabel, restLabel } from '../core/units';
import { Btn, Chip, IconBtn, Press, Row, Segmented, Sheet, Txt, tap } from './kit';
import { Icon } from './Icon';
import { ExerciseArt } from './ExerciseArt';
import { addRest, stopRest, useRest } from '../features/timer';

// ───────── Что такое RIR ─────────

export const RIR_OPTIONS = [
  { v: 0, label: 'Отказ', hint: 'Больше ни одного' },
  { v: 1, label: 'Ещё 1', hint: 'Смог бы ещё одно' },
  { v: 2, label: 'Ещё 2', hint: 'Два в запасе' },
  { v: 3, label: 'Ещё 3', hint: 'Три в запасе' },
  { v: 4, label: 'Легко', hint: '4 и больше' },
];

export function RirExplainer() {
  return (
    <View style={{ gap: 8 }}>
      <Txt v="body">
        RIR (reps in reserve) показывает, сколько повторений ты ещё смог бы сделать в этом подходе до отказа.
      </Txt>
      <Txt v="small">
        В программе указано, с каким запасом работать. Базовые упражнения обычно делают с RIR 1–2, изоляцию с RIR 0–1. Запас 1–2 даёт почти тот же рост, что и отказ, но меньше утомляет (Refalo 2023). По RIR приложение решает, пора ли прибавлять вес.
      </Txt>
    </View>
  );
}

export function RirSheet({ open, value, target, onPick, onClose }: { open: boolean; value: number | null; target?: string | number; onPick: (v: number | null) => void; onClose: () => void }) {
  const t = useTheme();
  const [info, setInfo] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} title="Сколько повторений осталось в запасе?">
      {target !== undefined && <Txt v="small">По плану RIR {String(target).replace('-', '–')}</Txt>}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {RIR_OPTIONS.map((o) => {
          const on = value === o.v;
          return (
            <Press key={o.v} onPress={() => onPick(on ? null : o.v)} style={{ flex: 1 }}>
              <View style={{ backgroundColor: on ? t.c.accent : t.c.chip, borderRadius: t.r.md, paddingVertical: 14, alignItems: 'center', gap: 4 }}>
                <Text style={{ fontFamily: t.f.num, fontSize: 24, color: on ? t.c.onAccent : t.c.ink }}>{o.v === 4 ? '4+' : o.v}</Text>
                <Text style={{ fontFamily: t.f.semibold, fontSize: 11.5, color: on ? t.c.onAccent : t.c.muted }}>{o.label}</Text>
              </View>
            </Press>
          );
        })}
      </View>
      <Press onPress={() => setInfo((x) => !x)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}>
        <Icon name="info" size={18} color={t.c.accentText} />
        <Text style={{ fontFamily: t.f.semibold, color: t.c.accentText, fontSize: 14 }}>{info ? 'Скрыть пояснение' : 'Что такое RIR?'}</Text>
      </Press>
      {info && (
        <Animated.View entering={FadeIn}>
          <RirExplainer />
        </Animated.View>
      )}
    </Sheet>
  );
}

// ───────── Ввод числа ─────────

export type NumberField = 'weight' | 'reps' | 'duration';

export function NumberSheet({ open, field, value, onDone, onClose, steps, quick, title, unit }: {
  open: boolean; field: NumberField; value: number | null; onDone: (v: number | null) => void; onClose: () => void;
  steps: number[]; quick: { label: string; value: number }[]; title: string; unit: string;
}) {
  const t = useTheme();
  const [v, setV] = useState<number | null>(value);
  const [text, setText] = useState(value != null ? num(value, 2) : '');
  useEffect(() => {
    if (open) {
      setV(value);
      setText(value != null ? num(value, 2) : '');
    }
  }, [open, value]);
  const set = (n: number | null) => {
    const c = n == null ? null : Math.max(0, Math.round(n * 100) / 100);
    setV(c);
    setText(c != null ? num(c, 2) : '');
  };
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <View style={{ alignItems: 'center', paddingVertical: 6 }}>
        <Row gap={6} style={{ alignItems: 'baseline' }}>
          <TextInput
            value={text}
            onChangeText={(s) => {
              setText(s);
              setV(parseNum(s));
            }}
            keyboardType="decimal-pad"
            selectTextOnFocus
            placeholder="—"
            placeholderTextColor={t.c.faint}
            selectionColor={t.c.accent}
            style={{ fontFamily: t.f.num, fontSize: 56, color: t.c.ink, minWidth: 80, textAlign: 'center', padding: 0 }}
          />
          <Text style={{ fontFamily: t.f.semibold, fontSize: 18, color: t.c.muted }}>{unit}</Text>
        </Row>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[...steps].reverse().map((s) => (
          <StepBtn key={`m${s}`} label={`−${num(s, 2)}`} onPress={() => set((v ?? 0) - s)} />
        ))}
        {steps.map((s) => (
          <StepBtn key={`p${s}`} label={`+${num(s, 2)}`} onPress={() => set((v ?? 0) + s)} accent />
        ))}
      </View>
      {quick.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {quick.map((q) => (
            <Chip key={q.label} label={q.label} on={v === q.value} onPress={() => set(q.value)} />
          ))}
        </View>
      )}
      <Btn title="Готово" onPress={() => onDone(v)} />
      {field !== 'weight' && null}
    </Sheet>
  );
}

function StepBtn({ label, onPress, accent }: { label: string; onPress: () => void; accent?: boolean }) {
  const t = useTheme();
  return (
    <Press onPress={onPress} style={{ flex: 1, height: 50, borderRadius: t.r.md, backgroundColor: accent ? t.c.done : t.c.chip, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: t.f.bold, fontSize: 16, color: accent ? t.c.accentText : t.c.ink }}>{label}</Text>
    </Press>
  );
}

// ───────── Строка подхода ─────────

function Cell({ value, placeholder, onPress, active, width }: { value: string | null; placeholder?: string; onPress: () => void; active?: boolean; width?: number }) {
  const t = useTheme();
  return (
    <Press onPress={onPress} haptic={false} style={{ flex: width ? undefined : 1, width, height: 38, borderRadius: t.r.sm, backgroundColor: t.c.input, alignItems: 'center', justifyContent: 'center', borderWidth: active ? 2 : 0, borderColor: t.c.accent }}>
      <Text style={{ fontFamily: value ? t.f.num : t.f.medium, fontSize: value ? 16 : 15, color: value ? t.c.ink : t.c.faint, fontVariant: ['tabular-nums'] }}>{value ?? placeholder ?? '—'}</Text>
    </Press>
  );
}

export function SetRow({ row, label, prev, def, plan, active, onEdit, onToggle, onLong, repsPlaceholder }: {
  row: SetLog; label: string; prev: string; def?: ExerciseDef; plan: PlannedExercise; active: boolean;
  onEdit: (f: NumberField | 'rir') => void; onToggle: () => void; onLong: () => void; repsPlaceholder: string;
}) {
  const t = useTheme();
  const done = !!row.completedAt;
  const p = useSharedValue(done ? 1 : 0);
  useEffect(() => {
    p.value = withTiming(done ? 1 : 0, { duration: 260 });
  }, [done, p]);
  const bg = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(p.value, [0, 1], ['rgba(0,0,0,0)', t.c.done]) }));
  const isTime = def?.type === 'time';
  const rir = row.rir == null ? null : row.rir >= 4 ? '4+' : String(row.rir);
  return (
    <Press onLongPress={onLong} haptic={false} scaleTo={1}>
      <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 4, borderRadius: t.r.sm }, bg]}>
        <Text style={{ width: 30, textAlign: 'center', fontFamily: t.f.bold, fontSize: 13.5, color: row.kind === 'warmup' ? t.c.warm : t.c.muted }}>{label}</Text>
        <Text numberOfLines={1} style={{ width: 62, textAlign: 'center', fontFamily: t.f.body, fontSize: 12.5, color: t.c.muted }}>{prev}</Text>
        {isTime ? (
          <Cell value={row.durationS != null ? `${row.durationS}` : null} placeholder={rangeLabel(plan.reps)} onPress={() => onEdit('duration')} active={active} />
        ) : (
          <>
            <Cell value={row.weight != null ? num(row.weight, 2) : null} placeholder={def?.type === 'bodyweight' ? '+0' : '—'} onPress={() => onEdit('weight')} active={active && row.weight == null} />
            <Cell value={row.reps != null ? `${row.reps}` : null} placeholder={repsPlaceholder} onPress={() => onEdit('reps')} active={active && row.weight != null} />
          </>
        )}
        {row.kind === 'work' ? <Cell width={44} value={rir} placeholder="–" onPress={() => onEdit('rir')} /> : <View style={{ width: 44 }} />}
        <Press onPress={onToggle} haptic={false} scaleTo={0.85} style={{ width: 38, height: 38, borderRadius: t.r.sm, backgroundColor: done ? t.c.accent : t.c.chip, alignItems: 'center', justifyContent: 'center' }}>
          {done ? (
            <Animated.View entering={ZoomIn.springify().damping(12)}>
              <Icon name="check" size={20} color={t.c.onAccent} strokeWidth={2.6} />
            </Animated.View>
          ) : (
            <Icon name="check" size={18} color={t.c.faint} />
          )}
        </Press>
      </Animated.View>
    </Press>
  );
}

// ───────── Карточка упражнения ─────────

export function ExerciseCard({ index, plan, def, rows, last, hint, hintKind, variantId, sidesMode, onVariant, onSides, onInfo, onEdit, onToggle, onLongRow, onAddSet, onWarmup, onMenu, activeRowId }: {
  index: number; plan: PlannedExercise; def?: ExerciseDef; rows: SetLog[]; last: SetLog[]; hint: string; hintKind: 'increase' | 'reduce' | 'other';
  variantId: string | null; sidesMode: 'both' | 'each'; onVariant: (v: string) => void; onSides: (m: 'both' | 'each') => void; onInfo: () => void;
  onEdit: (row: SetLog, f: NumberField | 'rir') => void; onToggle: (row: SetLog) => void; onLongRow: (row: SetLog) => void; onAddSet: () => void; onWarmup?: () => void; onMenu: () => void;
  activeRowId: number | null;
}) {
  const t = useTheme();
  const range = parseRange(plan.reps);
  const doneCount = rows.filter((r) => r.kind === 'work' && r.completedAt).length;
  const total = rows.filter((r) => r.kind === 'work').length;
  const allDone = total > 0 && doneCount === total;
  const isTime = def?.type === 'time';
  const prevOf = (r: SetLog) => {
    const p = last.find((l) => l.kind === r.kind && l.setIndex === r.setIndex && l.side === r.side);
    if (!p) return '—';
    if (isTime) return `${p.durationS ?? '—'} с`;
    return `${p.weight != null ? num(p.weight) : '—'}×${p.reps ?? '—'}`;
  };
  const repsPh = (r: SetLog) => {
    const p = last.find((l) => l.kind === r.kind && l.setIndex === r.setIndex && l.side === r.side);
    return p?.reps != null ? String(p.reps) : rangeLabel(plan.reps);
  };
  const labelOf = (r: SetLog) => {
    if (r.kind === 'warmup') return 'Р';
    const n = r.setIndex + 1;
    return r.side === 'left' ? `${n}Л` : r.side === 'right' ? `${n}П` : `${n}`;
  };
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * 50).duration(350)} layout={LinearTransition.springify().damping(20)}>
      <View style={{ backgroundColor: t.c.card, borderRadius: t.r.lg, padding: 12, borderWidth: t.border, borderColor: t.c.line, gap: 10, ...(t.shadow ? { shadowColor: '#1f3cff', shadowOpacity: 0.1, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 } : null) }}>
        <Row gap={12} style={{ alignItems: 'flex-start' }}>
          <Press onPress={onInfo}>
            <ExerciseArt def={def} variantId={variantId} size={52} />
          </Press>
          <View style={{ flex: 1, gap: 4 }}>
            <Row gap={6}>
              {plan.group && (
                <View style={{ backgroundColor: t.c.warm, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 }}>
                  <Text style={{ fontFamily: t.f.bold, fontSize: 11, color: t.dark ? '#121316' : '#fff' }}>Суперсет {plan.group}</Text>
                </View>
              )}
              {allDone && (
                <Animated.View entering={ZoomIn}>
                  <Text style={{ fontFamily: t.f.bold, fontSize: 12, color: t.c.good }}>Готово</Text>
                </Animated.View>
              )}
            </Row>
            <Press onPress={onInfo} haptic={false} scaleTo={0.99}>
              <Txt v="h2" style={{ fontSize: t.id === 'energy' ? 15 : 17, lineHeight: 22 }}>{def?.name ?? plan.exercise}</Txt>
            </Press>
            <Txt v="small">
              {plan.sets} × {rangeLabel(plan.reps)}
              {plan.rir !== undefined ? ` · RIR ${String(plan.rir).replace('-', '–')}` : ''}
              {` · отдых ${restLabel(rows[0]?.restPlannedS ?? 120)}`}
            </Txt>
          </View>
          <IconBtn name="more" onPress={onMenu} color={t.c.muted} size={36} label="Действия" />
        </Row>

        {def?.variants && def.variants.length > 1 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {def.variants.map((v) => (
              <Chip key={v.id} small label={v.name} on={v.id === variantId} onPress={v.id === variantId ? undefined : () => onVariant(v.id)} />
            ))}
          </View>
        )}
        {def?.sides === 'optional' && (
          <Segmented value={sidesMode} onChange={onSides} options={[{ id: 'both', label: 'Обе стороны' }, { id: 'each', label: 'По одной' }]} />
        )}

        <View style={{ backgroundColor: hintKind === 'increase' ? t.c.done : t.c.chip, borderRadius: t.r.sm, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Icon name={hintKind === 'increase' ? 'flame' : 'info'} size={16} color={hintKind === 'increase' ? t.c.accentText : t.c.muted} />
          <Text style={{ flex: 1, fontFamily: hintKind === 'increase' ? t.f.semibold : t.f.medium, fontSize: 13, color: hintKind === 'increase' ? t.c.accentText : t.c.muted }}>{hint}</Text>
        </View>
        {plan.note && <Txt v="small" style={{ fontStyle: 'italic' }}>{plan.note}</Txt>}

        <View style={{ gap: 2 }}>
          <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 4 }}>
            <Text style={hd(t, 30)}>№</Text>
            <Text style={hd(t, 62)}>Прошлый</Text>
            {isTime ? <Text style={[hd(t), { flex: 1 }]}>Секунды</Text> : (
              <>
                <Text style={[hd(t), { flex: 1 }]}>{def?.type === 'bodyweight' ? '+кг' : 'кг'}</Text>
                <Text style={[hd(t), { flex: 1 }]}>Повт</Text>
              </>
            )}
            <Text style={hd(t, 44)}>RIR</Text>
            <View style={{ width: 38 }} />
          </View>
          {rows.map((r) => (
            <Animated.View key={r.id} entering={FadeIn.duration(250)} layout={LinearTransition}>
              <SetRow
                row={r} label={labelOf(r)} prev={prevOf(r)} def={def} plan={plan} active={r.id === activeRowId}
                onEdit={(f) => onEdit(r, f)} onToggle={() => onToggle(r)} onLong={() => onLongRow(r)} repsPlaceholder={repsPh(r)}
              />
            </Animated.View>
          ))}
        </View>
        <Row gap={8}>
          <Btn small kind="secondary" icon="plus" title="Подход" onPress={onAddSet} style={{ flex: 1 }} />
          {onWarmup && <Btn small kind="secondary" icon="flame" title="Разминка" onPress={onWarmup} style={{ flex: 1 }} />}
        </Row>
        {range.time ? null : null}
      </View>
    </Animated.View>
  );
}

const hd = (t: ReturnType<typeof useTheme>, width?: number) => ({ width, textAlign: 'center' as const, fontFamily: t.f.medium, fontSize: 11.5, color: t.c.muted });

// ───────── Таймер отдыха ─────────

export function RestBar({ pending, onStart }: { pending: { setId: number; plannedS: number; label: string } | null; onStart: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const rest = useRest();
  if (!rest && !pending) return null;
  const wrap = { position: 'absolute' as const, left: 12, right: 12, bottom: insets.bottom + 12 };
  if (!rest && pending) {
    return (
      <Animated.View entering={FadeInDown.duration(150)} style={wrap}>
        <Press onPress={onStart} style={{ backgroundColor: t.c.accent, borderRadius: t.r.lg, height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <Icon name="timer" size={22} color={t.c.onAccent} />
          <Text style={{ fontFamily: t.f.bold, fontSize: 17, color: t.c.onAccent }}>Начать отдых · {clock(pending.plannedS)}</Text>
        </Press>
      </Animated.View>
    );
  }
  if (!rest) return null;
  const left = (rest.endsAt - Date.now()) / 1000;
  const over = left <= 0;
  const progress = Math.min(1, (Date.now() - rest.startedAt) / (rest.endsAt - rest.startedAt));
  return (
    <Animated.View entering={FadeInDown.duration(150)} style={wrap}>
      <View style={{ backgroundColor: t.dark ? t.c.raised : '#15171a', borderRadius: t.r.lg, padding: 12, gap: 10 }}>
        <Row>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: t.f.num, fontSize: 34, color: over ? t.c.warm : '#ffffff', fontVariant: ['tabular-nums'], lineHeight: 38 }}>
              {over ? `+${clock(-left)}` : clock(left)}
            </Text>
            <Text numberOfLines={1} style={{ fontFamily: t.f.medium, fontSize: 12.5, color: '#9aa0ab' }}>
              {over ? 'Отдых закончился, пора работать' : `Отдых из ${clock(rest.plannedS)} · дальше ${rest.label}`}
            </Text>
          </View>
          <RestBtn label="−15" onPress={() => addRest(-15)} />
          <RestBtn label="+15" onPress={() => addRest(15)} />
          <Press onPress={() => { tap(); stopRest(); }} style={{ height: 44, paddingHorizontal: 14, borderRadius: t.r.md, backgroundColor: t.c.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: t.f.bold, fontSize: 15, color: t.c.onAccent }}>Стоп</Text>
          </Press>
        </Row>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
          <View style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: over ? t.c.warm : t.c.accent }} />
        </View>
      </View>
    </Animated.View>
  );
}

function RestBtn({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Press onPress={onPress} style={{ height: 44, width: 50, borderRadius: t.r.md, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: t.f.bold, fontSize: 15, color: '#ffffff' }}>{label}</Text>
    </Press>
  );
}
