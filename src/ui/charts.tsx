// Графики: линия с подписями, полосы, календарь тренировок. Рисуются под реальный размер экрана.
import { useState } from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '../theme';
import { num } from '../core/units';

export type Point = { x: number; y: number; label?: string };

/** Линейный график: ось X — время, ось Y — значение. Последняя точка подписана. */
export function LineChart({ points, height = 180, unit = 'кг', secondary }: { points: Point[]; height?: number; unit?: string; secondary?: Point[] }) {
  const t = useTheme();
  const [w, setW] = useState(0);
  const pad = { l: 34, r: 14, t: 18, b: 22 };
  const all = [...points, ...(secondary ?? [])];
  if (points.length < 2) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: t.f.medium, color: t.c.muted, fontSize: 13.5 }}>Нужно хотя бы 2 тренировки для графика</Text>
      </View>
    );
  }
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  let y0 = Math.min(...ys);
  let y1 = Math.max(...ys);
  const span = Math.max(1, y1 - y0);
  y0 = Math.floor((y0 - span * 0.15) / 5) * 5;
  y1 = Math.ceil((y1 + span * 0.15) / 5) * 5;
  const W = w;
  const H = height;
  const sx = (x: number) => pad.l + ((x - x0) / Math.max(1, x1 - x0)) * (W - pad.l - pad.r);
  const sy = (y: number) => pad.t + (1 - (y - y0) / Math.max(1, y1 - y0)) * (H - pad.t - pad.b);
  const path = (ps: Point[]) => ps.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  const area = `${path(points)} L${sx(points[points.length - 1].x)},${H - pad.b} L${sx(points[0].x)},${H - pad.b} Z`;
  const ticks = [y0, (y0 + y1) / 2, y1];
  const last = points[points.length - 1];
  const fmtDate = (ms: number) => new Date(ms).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');
  return (
    <View style={{ height }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <Animated.View entering={FadeIn.duration(400)}>
          <Svg width={W} height={H}>
            <Defs>
              <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={t.c.accent} stopOpacity={0.28} />
                <Stop offset="1" stopColor={t.c.accent} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {ticks.map((v, i) => (
              <Line key={i} x1={pad.l} x2={W - pad.r} y1={sy(v)} y2={sy(v)} stroke={t.c.line} strokeWidth={1} />
            ))}
            {ticks.map((v, i) => (
              <SvgText key={`t${i}`} x={pad.l - 6} y={sy(v) + 4} fontSize={11} fill={t.c.muted} textAnchor="end" fontFamily={t.f.body}>
                {num(v, 0)}
              </SvgText>
            ))}
            <SvgText x={pad.l} y={H - 5} fontSize={11} fill={t.c.muted} fontFamily={t.f.body}>{fmtDate(x0)}</SvgText>
            <SvgText x={W - pad.r} y={H - 5} fontSize={11} fill={t.c.muted} textAnchor="end" fontFamily={t.f.body}>{fmtDate(x1)}</SvgText>
            {secondary && secondary.length > 1 && <Path d={path(secondary)} stroke={t.c.faint} strokeWidth={2} fill="none" strokeDasharray="4 4" />}
            <Path d={area} fill="url(#fill)" />
            <Path d={path(points)} stroke={t.c.accent} strokeWidth={2.6} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {points.length <= 24 && points.map((p, i) => <Circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={2.6} fill={t.c.card} stroke={t.c.accent} strokeWidth={1.6} />)}
            <Circle cx={sx(last.x)} cy={sy(last.y)} r={5} fill={t.c.accent} />
            {[{ stroke: t.c.card, w: 4 }, { stroke: 'none', w: 0 }].map((o, i) => (
              <SvgText key={i} x={Math.min(sx(last.x), W - pad.r - 4)} y={sy(last.y) - 10} fontSize={12.5} fill={t.c.ink} textAnchor="end" fontFamily={t.f.bold} stroke={o.stroke} strokeWidth={o.w}>
                {`${num(last.y)} ${unit}`}
              </SvgText>
            ))}
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}

/** Горизонтальные полосы с целевой зоной (например, 10–20 подходов в неделю) */
export function ZoneBars({ rows, zone: zoneAll = [10, 20], max }: { rows: { label: string; value: number; plan?: number; zone?: [number, number] }[]; zone?: [number, number]; max?: number }) {
  const t = useTheme();
  const m = max ?? Math.max(24, ...rows.map((r) => Math.max(r.value, r.plan ?? 0, (r.zone ?? zoneAll)[1] + 4)));
  return (
    <View style={{ gap: 10 }}>
      {rows.map((r) => {
        const zone = r.zone ?? zoneAll;
        const inZone = r.value >= zone[0] && r.value <= zone[1];
        const color = r.value === 0 ? t.c.faint : inZone ? t.c.good : r.value > zone[1] ? t.c.warm : t.c.accent;
        return (
          <View key={r.label} style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: t.f.medium, fontSize: 13.5, color: t.c.ink }}>{r.label}</Text>
              <Text style={{ fontFamily: t.f.bold, fontSize: 13.5, color: t.c.ink, fontVariant: ['tabular-nums'] }}>
                {num(r.value)}
                {r.plan != null && <Text style={{ fontFamily: t.f.body, color: t.c.muted }}>{` из ${num(r.plan)}`}</Text>}
              </Text>
            </View>
            <View style={{ height: 10, borderRadius: 5, backgroundColor: t.c.chip, overflow: 'hidden' }}>
              <View style={{ position: 'absolute', left: `${(zone[0] / m) * 100}%`, width: `${((zone[1] - zone[0]) / m) * 100}%`, top: 0, bottom: 0, backgroundColor: t.dark ? 'rgba(95,211,154,0.12)' : 'rgba(19,149,90,0.1)' }} />
              {r.plan != null && <View style={{ position: 'absolute', left: `${Math.min(100, (r.plan / m) * 100)}%`, width: 2, top: 0, bottom: 0, backgroundColor: t.c.muted }} />}
              <View style={{ width: `${Math.min(100, (r.value / m) * 100)}%`, height: '100%', borderRadius: 5, backgroundColor: color }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Вертикальные столбики по неделям */
export function ColumnChart({ data, height = 130, format = (v: number) => num(v, 0) }: { data: { label: string; value: number }[]; height?: number; format?: (v: number) => string }) {
  const t = useTheme();
  const m = Math.max(1, ...data.map((d) => d.value));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, gap: 6 }}>
      {data.map((d, i) => {
        const last = i === data.length - 1;
        return (
          <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
            {d.value > 0 && <Text numberOfLines={1} style={{ fontFamily: t.f.bold, fontSize: 10.5, color: last ? t.c.ink : t.c.muted }}>{format(d.value)}</Text>}
            <View style={{ width: '100%', height: `${Math.max(2, (d.value / m) * 70)}%`, borderRadius: 6, backgroundColor: last ? t.c.accent : t.c.chip }} />
            <Text style={{ fontFamily: t.f.medium, fontSize: 10.5, color: t.c.muted }}>{d.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** Календарь: недели столбцами, дни строками, закрашены дни с тренировками */
export function Heatmap({ days, weeks = 16 }: { days: Map<string, number>; weeks?: number }) {
  const t = useTheme();
  const [w, setW] = useState(0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dow = (today.getDay() + 6) % 7;
  const start = new Date(today);
  start.setDate(start.getDate() - dow - (weeks - 1) * 7);
  const gap = 4;
  const cell = w ? Math.floor((w - gap * (weeks - 1)) / weeks) : 0;
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: cell ? cell * 7 + gap * 6 : 120 }}>
      {cell > 0 && (
        <Svg width={w} height={cell * 7 + gap * 6}>
          {Array.from({ length: weeks * 7 }, (_, i) => {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            if (d > today) return null;
            const n = days.get(key(d)) ?? 0;
            const col = Math.floor(i / 7);
            const row = i % 7;
            return <Rect key={i} x={col * (cell + gap)} y={row * (cell + gap)} width={cell} height={cell} rx={Math.min(4, cell / 3)} fill={n ? t.c.accent : t.c.chip} opacity={n ? Math.min(1, 0.55 + n * 0.25) : 1} />;
          })}
        </Svg>
      )}
    </View>
  );
}

export const dayKey = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
