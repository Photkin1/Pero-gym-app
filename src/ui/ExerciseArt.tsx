// Обложка упражнения: рисунок снаряда и подсветка рабочей мышцы.
// Своя графика, без чужих картинок. Фото и видео техники открываются по кнопке «Как делать».
import Svg, { Circle, Path, Rect, G } from 'react-native-svg';
import type { ExerciseDef, Muscle } from '../core/program';
import { useTheme } from '../theme';

type Gear = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'body';

export function gearOf(def: ExerciseDef | undefined, variantId: string | null): Gear {
  const v = `${variantId ?? ''} ${def?.id ?? ''}`;
  if (/dumbbell|db-/.test(v)) return 'dumbbell';
  if (/barbell|smith|ez|t-bar|squat|deadlift|row|bench|thrust|shrug|skull|close-grip/.test(v) && !/machine|cable/.test(v)) return 'barbell';
  if (/cable|rope|pulldown|pushdown|face-pull|crunch/.test(v)) return 'cable';
  if (def?.type === 'bodyweight' || def?.type === 'time') return 'body';
  return 'machine';
}

const ZONE: Partial<Record<Muscle, 'upper' | 'mid' | 'lower' | 'arm'>> = {
  chest: 'upper', lats: 'upper', upper_back: 'upper', traps: 'upper', front_delts: 'upper', side_delts: 'upper', rear_delts: 'upper',
  biceps: 'arm', triceps: 'arm', forearms: 'arm', abs: 'mid', lower_back: 'mid',
  quads: 'lower', hamstrings: 'lower', glutes: 'lower', adductors: 'lower', abductors: 'lower', calves: 'lower',
};

export function ExerciseArt({ def, variantId, size = 48 }: { def?: ExerciseDef; variantId?: string | null; size?: number }) {
  const t = useTheme();
  const gear = gearOf(def, variantId ?? null);
  const zone = ZONE[def?.muscles.primary[0] ?? 'chest'] ?? 'upper';
  const ink = t.c.ink;
  const acc = t.c.accent;
  const sw = 2.2;
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Rect x={0} y={0} width={48} height={48} rx={size > 60 ? 18 : 12} fill={t.c.chip} />
      {/* Силуэт: голова и корпус, рабочая зона подсвечена */}
      <G opacity={0.9}>
        <Circle cx={36} cy={11} r={3.2} fill={zone === 'upper' ? acc : t.c.faint} />
        <Path d="M36 15v10" stroke={zone === 'upper' || zone === 'mid' ? acc : t.c.faint} strokeWidth={3} strokeLinecap="round" />
        <Path d="M36 25l-3 8M36 25l3 8" stroke={zone === 'lower' ? acc : t.c.faint} strokeWidth={3} strokeLinecap="round" />
        <Path d="M36 17l-4 5M36 17l4 5" stroke={zone === 'arm' ? acc : t.c.faint} strokeWidth={2.4} strokeLinecap="round" />
      </G>
      {/* Снаряд */}
      <G>
        {gear === 'barbell' && (
          <>
            <Path d="M5 36h22" stroke={ink} strokeWidth={sw} strokeLinecap="round" />
            <Rect x={7} y={30} width={4} height={12} rx={1.5} fill={ink} />
            <Rect x={21} y={30} width={4} height={12} rx={1.5} fill={ink} />
          </>
        )}
        {gear === 'dumbbell' && (
          <>
            <Path d="M9 36h12" stroke={ink} strokeWidth={sw} strokeLinecap="round" />
            <Rect x={6} y={31.5} width={5} height={9} rx={2} fill={ink} />
            <Rect x={19} y={31.5} width={5} height={9} rx={2} fill={ink} />
          </>
        )}
        {gear === 'machine' && (
          <>
            <Rect x={7} y={24} width={14} height={18} rx={2.5} stroke={ink} strokeWidth={sw} fill="none" />
            <Path d="M10 29h8M10 33h8M10 37h8" stroke={ink} strokeWidth={1.6} strokeLinecap="round" />
            <Path d="M21 28h5" stroke={ink} strokeWidth={sw} strokeLinecap="round" />
          </>
        )}
        {gear === 'cable' && (
          <>
            <Path d="M8 8v34M8 10l14 16" stroke={ink} strokeWidth={sw} strokeLinecap="round" />
            <Circle cx={8} cy={10} r={2.4} fill={ink} />
            <Path d="M19 28l6-1" stroke={ink} strokeWidth={3} strokeLinecap="round" />
          </>
        )}
        {gear === 'body' && (
          <>
            <Path d="M5 14h24" stroke={ink} strokeWidth={sw} strokeLinecap="round" />
            <Path d="M9 14v28M25 14v28" stroke={ink} strokeWidth={1.6} strokeLinecap="round" opacity={0.6} />
          </>
        )}
      </G>
    </Svg>
  );
}
