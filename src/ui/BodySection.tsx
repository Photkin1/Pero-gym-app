// Раздел «Тело» во вкладке «Прогресс»: вес (среднее за неделю + скользящее среднее за 7 дней) и замеры плитками.
import { useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme';
import { num, parseNum } from '../core/units';
import { MEASURES, MEASURE_RU, upsertBody, type BodyMetric, type Measure } from '../db/repo';
import { Btn, Card, Chip, Press, Row, Sheet, Txt, toast, success } from './kit';
import { LineChart, dayKey, type Point } from './charts';

const DAY = 86400000;
const ts = (date: string) => new Date(date + 'T00:00:00').getTime();
const weekStart = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
};
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

type Period = '1m' | '3m' | 'all';
const PERIOD_DAYS: Record<Period, number> = { '1m': 31, '3m': 92, all: 1e5 };

/** Для каждого взвешивания — среднее за 7 дней до него включительно */
export function rollingAvg(pts: Point[], days = 7): Point[] {
  return pts.map((p) => {
    const win = pts.filter((q) => q.x <= p.x && q.x > p.x - days * DAY);
    return { x: p.x, y: mean(win.map((q) => q.y)) };
  });
}

/** Каждая точка — среднее взвешиваний за 3 дня (окна считаются от сегодняшнего дня назад) */
export function bucketAvg(pts: Point[], days = 3): Point[] {
  if (!pts.length) return [];
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const endMs = end.getTime() + DAY;
  const groups = new Map<number, Point[]>();
  for (const p of pts) {
    const k = Math.floor((endMs - p.x - 1) / (days * DAY));
    groups.set(k, [...(groups.get(k) ?? []), p]);
  }
  return [...groups.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, g]) => ({ x: mean(g.map((p) => p.x)), y: mean(g.map((p) => p.y)) }));
}

const monthsAgo = (ms: number) => {
  const d = Math.round((Date.now() - ms) / DAY);
  if (d < 14) return `за ${d || 1} дн`;
  if (d < 60) return `за ${Math.round(d / 7)} нед`;
  return `за ${Math.round(d / 30)} мес`;
};
const signed = (v: number, digits = 1) => (Math.abs(v) < 0.05 ? '0' : `${v > 0 ? '+' : '−'}${num(Math.abs(v), digits)}`);

export function BodySection({ body }: { body: BodyMetric[] }) {
  const t = useTheme();
  const [period, setPeriod] = useState<Period>('3m');
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Measure | null>(null);

  const weights = useMemo(() => body.filter((b) => b.weight != null).map((b) => ({ x: ts(b.date), y: b.weight! })), [body]);

  // Среднее за текущую неделю; если на этой неделе ещё не взвешивался, берём прошлую
  const week = useMemo(() => {
    const ws = weekStart(Date.now());
    let cur = weights.filter((p) => p.x >= ws);
    let label = 'среднее за эту неделю';
    if (!cur.length) {
      cur = weights.filter((p) => p.x >= ws - 7 * DAY && p.x < ws);
      label = 'среднее за прошлую неделю';
    }
    if (!cur.length) return null;
    const avg = mean(cur.map((p) => p.y));
    const monthAgo = weights.filter((p) => p.x >= ws - 35 * DAY && p.x < ws - 21 * DAY);
    return { avg, n: cur.length, label, delta: monthAgo.length ? avg - mean(monthAgo.map((p) => p.y)) : null };
  }, [weights]);

  const chartPts = useMemo(() => {
    const from = Date.now() - PERIOD_DAYS[period] * DAY;
    return { avg: rollingAvg(weights).filter((p) => p.x >= from), raw: weights.filter((p) => p.x >= from) };
  }, [weights, period]);

  const series = (m: Measure) => body.filter((b) => b[m] != null).map((b) => ({ x: ts(b.date), y: b[m]! }));

  return (
    <Animated.View entering={FadeIn} style={{ gap: 12 }}>
      <Card style={{ gap: 8 }}>
        <Row style={{ alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Txt v="label">Вес, {week?.label ?? 'пока нет взвешиваний'}</Txt>
            <Row gap={4} style={{ alignItems: 'baseline' }}>
              <Txt v="bignum">{week ? num(week.avg) : '—'}</Txt>
              <Txt v="medium" color={t.c.muted}>кг</Txt>
            </Row>
          </View>
          {week && (
            <View style={{ alignItems: 'flex-end' }}>
              {week.delta != null && <Txt v="medium" color={t.c.accent}>{signed(week.delta)} за месяц</Txt>}
              <Txt v="small">{week.n} {week.n === 1 ? 'взвешивание' : week.n < 5 ? 'взвешивания' : 'взвешиваний'}</Txt>
            </View>
          )}
        </Row>
        <Row gap={6}>
          {(['1m', '3m', 'all'] as Period[]).map((p) => (
            <Chip key={p} small label={p === '1m' ? '1 мес' : p === '3m' ? '3 мес' : 'Всё'} on={period === p} onPress={() => setPeriod(p)} />
          ))}
        </Row>
        <LineChart points={chartPts.avg} secondary={chartPts.raw} height={170} step={1} emptyText="Взвесься пару раз, и здесь появится график" />
        <Txt v="small">Линия — среднее за последние 7 дней, пунктир — сами взвешивания. Так скачки из-за воды и соли не мешают видеть тренд.</Txt>
      </Card>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {MEASURES.map((m) => (
          <MeasureTile key={m} m={m} pts={series(m)} onPress={() => setDetail(m)} />
        ))}
      </View>

      <Btn title="+ Замер" onPress={() => setOpen(true)} full />

      <MeasureSheet open={open} onClose={() => setOpen(false)} body={body} />

      <Sheet open={detail != null} onClose={() => setDetail(null)} title={detail ? MEASURE_RU[detail] : ''}>
        {detail && <LineChart points={series(detail)} unit="см" step={1} emptyText="Нужно хотя бы 2 замера для графика" />}
        <Txt v="small">{detail ? HOWTO[detail] : ''}</Txt>
      </Sheet>
    </Animated.View>
  );
}

export const HOWTO: Record<'weight' | Measure, string> = {
  weight: 'Взвешивайся утром, после туалета и до еды, в одной и той же одежде или без неё.',
  waist: 'Талию меряй по пупку, на спокойном выдохе, не втягивая живот.',
  chest: 'Грудь — по самой широкой части, под мышками, руки опущены.',
  arm: 'Бицепс — в самой толстой точке, рука согнута и напряжена.',
  hips: 'Ягодицы — по самой выступающей точке, ноги вместе.',
  thigh: 'Бедро — на ладонь ниже ягодичной складки, нога расслаблена.',
};

function MeasureTile({ m, pts, onPress }: { m: Measure; pts: Point[]; onPress: () => void }) {
  const t = useTheme();
  const last = pts[pts.length - 1];
  const first = pts[0];
  const d = last && pts.length > 1 ? last.y - first.y : null;
  // Талия растёт — это скорее плохо, остальное растёт — хорошо
  const color = d == null || Math.abs(d) < 0.05 ? t.c.muted : (d > 0) !== (m === 'waist') ? t.c.good : t.c.bad;
  return (
    <Press onPress={onPress} style={{ width: '48%', flexGrow: 1 }}>
      <View style={{ backgroundColor: t.c.card, borderRadius: t.r.md, padding: 12, borderWidth: t.border, borderColor: t.c.line, gap: 2 }}>
        <Txt v="label">{MEASURE_RU[m]}</Txt>
        <Row gap={4} style={{ alignItems: 'baseline' }}>
          <Text style={{ fontFamily: t.f.num, fontSize: 20, color: last ? t.c.ink : t.c.faint }}>{last ? num(last.y) : '—'}</Text>
          <Txt v="small">см</Txt>
        </Row>
        <Text style={{ fontFamily: t.f.bold, fontSize: 12, color }}>{d == null ? (last ? 'первый замер' : 'нет замеров') : Math.abs(d) < 0.05 ? 'без изменений' : `${signed(d)} ${monthsAgo(first.x)}`}</Text>
        <Spark pts={pts} color={color} />
      </View>
    </Press>
  );
}

function Spark({ pts, color }: { pts: Point[]; color: string }) {
  const [w, setW] = useState(0);
  const H = 22;
  if (pts.length < 2) return <View style={{ height: H }} />;
  const x0 = pts[0].x, x1 = pts[pts.length - 1].x;
  const ys = pts.map((p) => p.y);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const sx = (x: number) => 2 + ((x - x0) / Math.max(1, x1 - x0)) * (w - 4);
  const sy = (y: number) => (y1 === y0 ? H / 2 : 3 + (1 - (y - y0) / (y1 - y0)) * (H - 6));
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  return (
    <View style={{ height: H }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <Svg width={w} height={H}>
          <Path d={d} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
    </View>
  );
}

// ───────── Ввод замера ─────────

export type Draft = Record<'weight' | Measure, string>;
export const FIELDS: { k: 'weight' | Measure; label: string; unit: string; step: number }[] = [
  { k: 'weight', label: 'Вес', unit: 'кг', step: 0.1 },
  ...MEASURES.map((m) => ({ k: m, label: MEASURE_RU[m], unit: 'см', step: 0.5 })),
];

/** Черновик из полей ввода в запись замера; строка — ошибка */
export function draftToPatch(draft: Draft): Partial<Record<'weight' | Measure, number>> | string {
  const patch: Partial<Record<'weight' | Measure, number>> = {};
  for (const f of FIELDS) {
    const v = parseNum(draft[f.k]);
    if (v == null) continue;
    const ok = f.k === 'weight' ? v >= 30 && v <= 300 : v >= 10 && v <= 250;
    if (!ok) return `Проверь поле «${f.label}»`;
    patch[f.k] = v;
  }
  return patch;
}

function MeasureSheet({ open, onClose, body }: { open: boolean; onClose: () => void; body: BodyMetric[] }) {
  const lastOf = (k: 'weight' | Measure) => {
    for (let i = body.length - 1; i >= 0; i--) if (body[i][k] != null) return body[i][k]!;
    return null;
  };
  const [draft, setDraft] = useState<Draft | null>(null);
  // Черновик заполняется прошлыми значениями при каждом открытии
  if (open && !draft) {
    const d = {} as Draft;
    for (const f of FIELDS) {
      const v = lastOf(f.k);
      d[f.k] = v == null ? '' : num(v);
    }
    setDraft(d);
  }
  if (!open && draft) setDraft(null);

  const save = () => {
    if (!draft) return;
    const patch = draftToPatch(draft);
    if (typeof patch === 'string') return toast(patch, 'info');
    if (!Object.keys(patch).length) return toast('Заполни хотя бы вес', 'info');
    upsertBody(dayKey(Date.now()), patch);
    success();
    toast('Замер сохранён', 'check');
    onClose();
  };

  const today = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  return (
    <Sheet open={open} onClose={onClose} title="Новый замер">
      <Txt v="small">{today} · лучше утром, до еды. Пустые поля не сохранятся.</Txt>
      {draft &&
        FIELDS.map((f) => (
          <Stepper
            key={f.k}
            label={f.label}
            unit={f.unit}
            value={draft[f.k]}
            onChange={(v) => setDraft({ ...draft, [f.k]: v })}
            step={f.step}
            bold={f.k === 'weight'}
            hint={HOWTO[f.k]}
          />
        ))}
      <Btn title="Сохранить" onPress={save} full />
    </Sheet>
  );
}

export function Stepper({ label, unit, value, onChange, step, bold, hint }: { label: string; unit: string; value: string; onChange: (v: string) => void; step: number; bold?: boolean; hint?: string }) {
  const t = useTheme();
  const [info, setInfo] = useState(false);
  const bump = (dir: number) => {
    const v = parseNum(value);
    if (v == null) return;
    onChange(num(Math.round((v + dir * step) * 10) / 10));
  };
  const btn = (dir: number) => (
    <Press onPress={() => bump(dir)} style={{ width: 40, height: 40, borderRadius: t.r.md, backgroundColor: t.c.chip, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: t.f.bold, fontSize: 20, color: t.c.ink }}>{dir > 0 ? '+' : '−'}</Text>
    </Press>
  );
  return (
    <View style={{ gap: 6 }}>
    <Row gap={8}>
      <Press onPress={() => hint && setInfo(!info)} hitSlop={6} style={{ flex: 1 }} haptic={!!hint}>
        <Row gap={6}>
          <Text style={{ fontFamily: bold ? t.f.bold : t.f.medium, fontSize: 15, color: t.c.ink }}>
            {label}
            <Text style={{ color: t.c.muted, fontFamily: t.f.body }}>, {unit}</Text>
          </Text>
          {hint && <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: info ? t.c.accent : t.c.faint, backgroundColor: info ? t.c.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: t.f.bold, fontSize: 11, lineHeight: 13, color: info ? t.c.onAccent : t.c.muted }}>i</Text>
          </View>}
        </Row>
      </Press>
      {btn(-1)}
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        placeholder="—"
        placeholderTextColor={t.c.faint}
        selectionColor={t.c.accent}
        style={{ width: 70, textAlign: 'center', fontFamily: t.f.num, fontSize: 18, color: t.c.ink, backgroundColor: t.c.input, borderRadius: t.r.md, paddingVertical: 8 }}
      />
      {btn(1)}
    </Row>
    {info && hint && (
      <Animated.View entering={FadeIn.duration(180)} style={{ backgroundColor: t.c.chip, borderRadius: t.r.md, padding: 10 }}>
        <Txt v="small" color={t.c.ink}>{hint}</Txt>
      </Animated.View>
    )}
    </View>
  );
}
