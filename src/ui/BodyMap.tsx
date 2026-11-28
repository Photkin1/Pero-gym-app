// Человечек спереди и сзади: мышцы подсвечены по числу подходов.
// mode 'heat': чем больше подходов, тем ярче (цвет акцента темы).
// mode 'zones': цвет по зоне объёма мышцы (мало / в зоне / много), как полоски на экране программы.
import { memo, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import type { Muscle } from '../core/program';
import { MUSCLE_RU, MUSCLE_ZONE } from '../core/training';
import { num } from '../core/units';
import { useTheme } from '../theme';
import { BODY, VIEWBOX } from './bodyPaths';

export type Sex = 'm' | 'f';
type Side = 'front' | 'back';

const SKIN = new Set(['head', 'hair', 'hands', 'feet', 'neck', 'knees', 'ankles', 'tibialis']);

// Какие наши мышцы рисуются каким контуром. Дельта спереди — передняя и средняя, сзади — задняя и средняя.
const SLUG: Record<Side, Record<string, Muscle[]>> = {
  front: {
    chest: ['chest'], deltoids: ['front_delts', 'side_delts'], biceps: ['biceps'], triceps: ['triceps'], forearm: ['forearms'],
    abs: ['abs'], obliques: ['abs'], quadriceps: ['quads'], adductors: ['adductors'], calves: ['calves'], trapezius: ['traps'],
  },
  back: {
    'upper-back': ['lats', 'upper_back'], 'lower-back': ['lower_back'], trapezius: ['traps', 'upper_back'], deltoids: ['rear_delts', 'side_delts'],
    triceps: ['triceps'], forearm: ['forearms'], gluteal: ['glutes', 'abductors'], hamstring: ['hamstrings'], adductors: ['adductors'], calves: ['calves'],
  },
};

function hex(c: string) {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a: string, b: string, t: number) {
  const A = hex(a);
  const B = hex(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
}

type Pick = { side: Side; slug: string } | null;

export const BodyMap = memo(function BodyMap({ load, mode = 'heat', sex = 'm', height = 300, interactive = true }: { load: Map<Muscle, number>; mode?: 'heat' | 'zones'; sex?: Sex; height?: number; interactive?: boolean }) {
  const t = useTheme();
  const [pick, setPick] = useState<Pick>(null);
  // Яркость считаем от самой нагруженной мышцы, но не меньше 6 подходов, чтобы 1–2 подхода не горели во всю силу
  const max = Math.max(6, ...load.values());
  const base = t.dark ? '#2b2f37' : '#dfe3ea';
  const skin = t.dark ? '#1d2026' : '#eceff3';
  const lo = t.dark ? mix(base, t.c.accent, 0.25) : mix(base, t.c.accent, 0.3);

  const valueOf = (side: Side, slug: string) => {
    const ms = SLUG[side][slug];
    if (!ms) return { v: 0, m: null as Muscle | null };
    let best: Muscle = ms[0];
    for (const m of ms) if ((load.get(m) ?? 0) > (load.get(best) ?? 0)) best = m;
    return { v: load.get(best) ?? 0, m: best };
  };
  const colorOf = (side: Side, slug: string) => {
    if (SKIN.has(slug)) return skin;
    const { v, m } = valueOf(side, slug);
    if (!v || !m) return base;
    if (mode === 'zones') {
      const [a, b] = MUSCLE_ZONE[m];
      return v < a ? (t.dark ? '#5b7cff' : '#7f9bff') : v > b ? t.c.warm : t.c.good;
    }
    return mix(lo, t.c.accent, Math.min(1, v / max));
  };

  const figure = (side: Side) => {
    const key = `${sex === 'm' ? 'body' : 'bodyFemale'}${side === 'front' ? 'Front' : 'Back'}` as keyof typeof BODY;
    return (
      <Svg height={height} width={height / 2} viewBox={VIEWBOX[sex][side]} pointerEvents={interactive ? 'auto' : 'none'}>
        {BODY[key].map((part, i) => {
          const fill = colorOf(side, part.slug);
          const on = pick?.side === side && pick.slug === part.slug;
          return (
            <G key={`${part.slug}${i}`} onPress={!interactive || SKIN.has(part.slug) ? undefined : () => setPick(on ? null : { side, slug: part.slug })}>
              {part.d.map((d, j) => (
                <Path key={j} d={d} fill={fill} stroke={on ? t.c.ink : t.dark ? '#121316' : '#f6f7f9'} strokeWidth={on ? 6 : 2} />
              ))}
            </G>
          );
        })}
      </Svg>
    );
  };

  const info = useMemo(() => {
    if (!pick) return null;
    const ms = SLUG[pick.side][pick.slug] ?? [];
    return ms.map((m) => `${MUSCLE_RU[m]}: ${load.get(m) ? `${num(load.get(m)!)} подх.` : 'нет'}`).join(' · ');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pick, load]);

  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
        {figure('front')}
        {figure('back')}
      </View>
      <View style={{ minHeight: 34, justifyContent: 'center' }}>
        {info ? (
          <Animated.View key={info} entering={FadeIn.duration(150)} exiting={FadeOut.duration(100)} style={{ backgroundColor: t.c.chip, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 }}>
            <Text style={{ fontFamily: t.f.semibold, fontSize: 13, color: t.c.ink, textAlign: 'center' }}>{info}</Text>
          </Animated.View>
        ) : (
          <Text style={{ fontFamily: t.f.body, fontSize: 12.5, color: t.c.faint }}>Нажми на мышцу, чтобы увидеть подходы</Text>
        )}
      </View>
    </View>
  );
});
