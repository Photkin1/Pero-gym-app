// Заставка при запуске. Обычная: «pero» прописывается, сверху плавно падает перо и садится на «o».
// С 1 декабря по 14 января: ёлка из блинов с гирей вместо звезды и снегом.
// Тап по экрану пропускает заставку.
import { useEffect, useMemo } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing, cancelAnimation, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue,
  withDelay, withRepeat, withTiming, type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

const ACC = '#ff6b4a';

export function isNewYearSeason(d = new Date()) {
  return d.getMonth() === 11 || (d.getMonth() === 0 && d.getDate() <= 14);
}

export function Intro({ onDone }: { onDone: () => void }) {
  const reduced = useReducedMotion();
  const newYear = useMemo(() => isNewYearSeason(), []);
  useEffect(() => {
    if (reduced) onDone();
  }, [reduced, onDone]);
  if (reduced) return null;
  return newYear ? <NewYearIntro onDone={onDone} /> : <FeatherIntro onDone={onDone} />;
}

// Общая обёртка: плавно гасит заставку в конце и даёт пропустить её тапом
function useOutro(onDone: () => void, holdMs: number) {
  const out = useSharedValue(1);
  const finish = () => {
    'worklet';
    out.value = withTiming(0, { duration: 320 }, (fin) => {
      if (fin) runOnJS(onDone)();
    });
  };
  useEffect(() => {
    out.value = withDelay(holdMs, withTiming(0, { duration: 380 }, (fin) => {
      if (fin) runOnJS(onDone)();
    }));
    return () => cancelAnimation(out);
  }, [holdMs, onDone, out]);
  const style = useAnimatedStyle(() => ({ opacity: out.value, transform: [{ scale: 1 + (1 - out.value) * 0.06 }] }));
  const skip = () => {
    cancelAnimation(out);
    finish();
  };
  return { style, skip };
}

function clamp01(x: number) {
  'worklet';
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

// ───────────── Обычная заставка: pero studio + перо ─────────────

const BG = '#121316';
const S = 100; // кегль «pero»
// Метрики Dancing Script Bold (на 1 единицу кегля): ширина «pero», начало и ширина «o», верх «o»
const WORD_W = 1.489 * S;
const LINE_H = 1.2 * S; // ascent + descent шрифта, базовая линия на 0.92·S
const LAND_X = 1.407 * S; // куда садится перо: над «o», ближе к правому краю
const LAND_Y = 0.216 * S;
const FS = (0.413 * S) / 100; // масштаб пера
const FW = 60 * FS;
const FH = 200 * FS;

const WRITE_MS = 1700;
const FALL_MS = 2700;
const FALL_DELAY = 150;

function Feather() {
  return (
    <Svg width={FW} height={FH} viewBox="-30 -100 60 200">
      <Defs>
        <LinearGradient id="vane" x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor="#ff5a3a" />
          <Stop offset="0.6" stopColor="#ff7a55" />
          <Stop offset="1" stopColor="#ffa184" />
        </LinearGradient>
      </Defs>
      <Path d="M0 64 C-7 34 -26 6 -23 -30 C-21 -58 -9 -80 0 -92 C11 -79 24 -56 24 -26 C24 2 12 36 0 64Z" fill="url(#vane)" />
      <Path d="M-21 -14 C-15 -12 -11 -8 -8 -3 M18 -40 C12 -38 8 -34 6 -30" stroke={BG} strokeWidth={2.2} fill="none" strokeLinecap="round" />
      <Path d="M0 40 L-12 22 M0 20 L-17 -2 M0 -2 L-18 -26 M0 -26 L-14 -52 M0 30 L13 10 M0 8 L18 -16 M0 -16 L18 -44 M0 -44 L11 -66" stroke="#fff" strokeOpacity={0.28} strokeWidth={1} fill="none" />
      <Path d="M0 92 C1 40 1 -30 0 -88" stroke="#fff" strokeOpacity={0.85} strokeWidth={2} fill="none" strokeLinecap="round" />
      <Path d="M0 92 L0 64" stroke="#f1f2f4" strokeOpacity={0.55} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

function FeatherIntro({ onDone }: { onDone: () => void }) {
  const write = useSharedValue(0);
  const fall = useSharedValue(0);
  const settle = useSharedValue(0);
  const studio = useSharedValue(0);
  const { style: wrap, skip } = useOutro(onDone, FALL_DELAY + FALL_MS + 700);

  useEffect(() => {
    write.value = withTiming(1, { duration: WRITE_MS, easing: Easing.bezier(0.45, 0.05, 0.4, 1) });
    fall.value = withDelay(FALL_DELAY, withTiming(1, { duration: FALL_MS, easing: Easing.linear }));
    settle.value = withDelay(FALL_DELAY + FALL_MS, withTiming(1, { duration: 800, easing: Easing.inOut(Easing.quad) }));
    studio.value = withDelay(WRITE_MS + 300, withTiming(1, { duration: 900, easing: Easing.bezier(0.2, 0.7, 0.2, 1) }));
  }, [write, fall, settle, studio]);

  // Шторка цвета фона уезжает вправо и открывает надпись, как будто её пишут
  const cover = useAnimatedStyle(() => ({ transform: [{ translateX: write.value * (WORD_W + 60) }] }));

  // Перо падает затухающим маятником: качание по x, наклон следует за движением
  const featherSt = useAnimatedStyle(() => {
    const p = fall.value;
    const ease = 1 - Math.pow(1 - p, 2.2);
    const damp = Math.pow(1 - p, 1.6);
    const ph = 2 * Math.PI * 1.6 * p;
    const x = LAND_X - 0.12 * S * (1 - ease) + 0.31 * S * damp * Math.sin(ph);
    const y = LAND_Y - 1.67 * S * (1 - ease);
    const s = settle.value;
    const bounce = s === 0 ? 0 : -2.5 * Math.sin(Math.PI * s) * (1 - s);
    const r = 34 + 16 * damp * Math.cos(ph) + bounce;
    return {
      opacity: clamp01(p / 0.12),
      transform: [{ translateX: x - FW / 2 }, { translateY: y - FH / 2 }, { rotate: `${r}deg` }],
    };
  });
  const studioSt = useAnimatedStyle(() => ({
    opacity: studio.value,
    transform: [{ translateY: (1 - studio.value) * 8 }],
    letterSpacing: 1 + (1 - studio.value) * 6,
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: BG }, wrap]}>
      <Pressable style={st.center} onPress={skip}>
        <View style={{ width: WORD_W, height: LINE_H }}>
          {/* Без обрезки: в Safari рукописный шрифт выходит чуть шире расчётного */}
          <Text style={[st.word, { position: 'absolute', left: 0, top: 0, width: WORD_W * 1.4 }]}>pero</Text>
          <Animated.View style={[st.cover, cover]}>
            <Svg width={40} height={LINE_H} style={{ position: 'absolute', left: -40 }}>
              <Defs>
                <LinearGradient id="edge" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor={BG} stopOpacity={0} />
                  <Stop offset="1" stopColor={BG} stopOpacity={1} />
                </LinearGradient>
              </Defs>
              <Rect x={0} y={0} width={40} height={LINE_H} fill="url(#edge)" />
            </Svg>
          </Animated.View>
          <Animated.View style={[st.feather, featherSt]}>
            <Feather />
          </Animated.View>
        </View>
        <Animated.Text style={[st.studio, studioSt]}>studio</Animated.Text>
      </Pressable>
    </Animated.View>
  );
}

// ───────────── Новогодняя: ёлка из блинов ─────────────

const NY_BG = '#11161f';
const PLATES: [number, string][] = [
  [230, '#e5484d'], [184, '#3b82f6'], [140, '#f5c03b'], [98, '#22a06b'], [60, '#e5484d'],
];
const LIGHTS = ['#ffd76b', '#ff7a90', '#7cc8ff', '#9dffb0'];
const PT = 20; // толщина блина
const PG = 22; // зазор, в нём виден гриф
const DROP_MS = 620;
const STEP_MS = 300;
const T_PLATES = 420;
const T_KB = T_PLATES + PLATES.length * STEP_MS + 300;
const T_TOTAL = T_KB + 2000;

// Падение с отскоком: 0..0.72 падает, затем подпрыгивает на 10 и снова на место
function dropY(t: number, start: number, dur: number, h: number) {
  'worklet';
  const q = clamp01((t - start) / dur);
  if (q < 0.72) {
    const k = q / 0.72;
    return -h * (1 - k * k);
  }
  if (q < 0.84) return -10 * Math.sin(((q - 0.72) / 0.12) * (Math.PI / 2));
  return -10 * Math.cos(((q - 0.84) / 0.16) * (Math.PI / 2));
}

function NewYearIntro({ onDone }: { onDone: () => void }) {
  const { width: W, height: H } = Dimensions.get('window');
  const k = Math.min((W * 0.7) / 240, 1.25);
  const t = useSharedValue(0); // общие часы заставки, мс
  const loop = useSharedValue(0); // бесконечный цикл для снега и гирлянды
  const { style: wrap, skip } = useOutro(onDone, T_TOTAL);

  useEffect(() => {
    t.value = withTiming(T_TOTAL, { duration: T_TOTAL, easing: Easing.linear });
    loop.value = withRepeat(withTiming(1, { duration: 12000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(loop);
  }, [t, loop]);

  const treeH = PLATES.length * (PT + PG) * k;
  const base = treeH + 40 * k; // нижний край ёлки внутри контейнера
  const flakes = useMemo(
    () => Array.from({ length: 34 }, (_, i) => ({
      x: Math.random() * W, r: i < 24 ? 1 + Math.random() * 1.4 : 2.2 + Math.random() * 1.4,
      speed: 1 + Math.floor(Math.random() * 3), phase: Math.random(), drift: 10 + Math.random() * 20, front: i >= 24,
    })),
    [W],
  );

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: NY_BG }, wrap]}>
      <Pressable style={st.center} onPress={skip}>
        {flakes.filter((f) => !f.front).map((f, i) => <Flake key={i} f={f} loop={loop} H={H} />)}
        <View style={{ width: 340 * k, height: base + 12 * k }}>
          <View style={[st.shadow, { top: base - 6 * k, width: 280 * k, left: 30 * k, height: 16 * k, borderRadius: 16 * k }]} />
          <Rod t={t} k={k} base={base} />
          {PLATES.map(([w, c], i) => (
            <Plate key={i} i={i} w={w * k} color={c} k={k} top={base - (i + 1) * PT * k - i * PG * k} t={t} loop={loop} />
          ))}
          <Kettlebell t={t} k={k} top={base - PLATES.length * (PT + PG) * k - 52 * k} />
        </View>
        <NyTitle t={t} />
        {flakes.filter((f) => f.front).map((f, i) => <Flake key={i} f={f} loop={loop} H={H} />)}
      </Pressable>
    </Animated.View>
  );
}

function Rod({ t, k, base }: { t: SharedValue<number>; k: number; base: number }) {
  const h = PLATES.length * (PT + PG) * k + 26 * k;
  const style = useAnimatedStyle(() => {
    const q = clamp01(t.value / 500);
    const e = 1 - Math.pow(1 - q, 3);
    return { height: h * e, top: base + 10 * k - h * e };
  });
  return (
    <Animated.View style={[st.rod, { left: 170 * k - 5 * k, width: 10 * k, borderRadius: 2 * k }, style]}>
      <View style={{ position: 'absolute', left: 2.5 * k, width: 2 * k, top: 0, bottom: 0, backgroundColor: '#eef1f5' }} />
      <View style={{ position: 'absolute', right: 0, width: 3 * k, top: 0, bottom: 0, backgroundColor: '#7d8492' }} />
    </Animated.View>
  );
}

function Plate({ i, w, color, k, top, t, loop }: { i: number; w: number; color: string; k: number; top: number; t: SharedValue<number>; loop: SharedValue<number> }) {
  const start = T_PLATES + i * STEP_MS;
  const style = useAnimatedStyle(() => ({
    opacity: t.value < start ? 0 : 1,
    transform: [{ translateY: dropY(t.value, start, DROP_MS, 560) }],
  }));
  const n = Math.max(2, Math.round(w / k / 40));
  return (
    <Animated.View style={[{ position: 'absolute', left: 170 * k - w / 2, top, width: w, height: PT * k + 6 }, style]}>
      <View style={{ width: w, height: PT * k, borderRadius: 7 * k, backgroundColor: color, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', left: 6 * k, right: 6 * k, top: 3 * k, height: 5 * k, borderRadius: 3, backgroundColor: '#fff', opacity: 0.28 }} />
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 6 * k, backgroundColor: '#000', opacity: 0.18 }} />
      </View>
      <View style={{ position: 'absolute', left: w / 2 - 12 * k, width: 24 * k, top: -3 * k, height: 3 * k, borderRadius: 1.5 * k, backgroundColor: '#d6dae1' }} />
      {Array.from({ length: n }, (_, j) => (
        <Light key={j} t={t} loop={loop} idx={i * 5 + j} color={LIGHTS[(i + j) % 4]} left={10 * k + (j * (w - 20 * k)) / (n - 1) - 3.2 * k} top={PT * k - 1} size={6.4 * k} />
      ))}
    </Animated.View>
  );
}

function Light({ t, loop, idx, color, left, top, size }: { t: SharedValue<number>; loop: SharedValue<number>; idx: number; color: string; left: number; top: number; size: number }) {
  const on = T_KB + 900 + idx * 25;
  const style = useAnimatedStyle(() => {
    const appear = clamp01((t.value - on) / 200);
    const blink = 0.62 + 0.38 * Math.cos(2 * Math.PI * (loop.value * 8 + (idx % 3) / 3));
    return { opacity: appear * (t.value > on + 1000 ? blink : 1) };
  });
  return <Animated.View style={[{ position: 'absolute', left, top, width: size, height: size, borderRadius: size, backgroundColor: color }, style]} />;
}

function Kettlebell({ t, k, top }: { t: SharedValue<number>; k: number; top: number }) {
  const style = useAnimatedStyle(() => {
    const q = clamp01((t.value - T_KB) / 800);
    const y = dropY(t.value, T_KB, 800, 560);
    const r = q < 0.75 ? -20 + 24 * (q / 0.75) : q < 0.88 ? 4 - 6 * ((q - 0.75) / 0.13) : -2 + 2 * ((q - 0.88) / 0.12);
    return { opacity: t.value < T_KB ? 0 : 1, transform: [{ translateY: y }, { rotate: `${r}deg` }] };
  });
  const spark = useAnimatedStyle(() => {
    const q = clamp01((t.value - T_KB - 800) / 700);
    return { opacity: q, transform: [{ scale: q < 0.3 ? 0.2 + (q / 0.3) * 1.1 : 1.3 - ((q - 0.3) / 0.7) * 0.3 }] };
  });
  const s = 120 * k;
  return (
    <Animated.View style={[{ position: 'absolute', left: 170 * k - s / 2, top: top - s / 2 + 26 * k, width: s, height: s }, style]}>
      <Svg width={s} height={s} viewBox="-60 -60 120 120">
        <Defs>
          <LinearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#ffe39a" />
            <Stop offset="0.5" stopColor="#ffbf3f" />
            <Stop offset="1" stopColor="#c98612" />
          </LinearGradient>
          <RadialGradient id="glow">
            <Stop offset="0" stopColor="#ffd76b" stopOpacity={0.55} />
            <Stop offset="1" stopColor="#ffd76b" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={0} cy={0} r={60} fill="url(#glow)" />
        <Path d="M-15 -22 C-15 -44 15 -44 15 -22" stroke="url(#gold)" strokeWidth={8} fill="none" strokeLinecap="round" />
        <Circle cx={0} cy={0} r={24} fill="url(#gold)" />
        <Ellipse cx={-8} cy={-8} rx={7} ry={5} fill="#fff" opacity={0.45} />
        <Rect x={-16} y={20} width={32} height={6} rx={3} fill="#c98612" />
      </Svg>
      <Animated.View style={[{ position: 'absolute', left: s / 2 + 18 * k, top: s / 2 - 52 * k, width: 24 * k, height: 24 * k }, spark]}>
        <Svg width={24 * k} height={24 * k} viewBox="-12 -12 24 24">
          <Path d="M0 -12 l3 9 9 3 -9 3 -3 9 -3 -9 -9 -3 9 -3z" fill="#fff" />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

function NyTitle({ t }: { t: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const q = clamp01((t.value - T_KB - 1000) / 900);
    const e = 1 - Math.pow(1 - q, 3);
    return { opacity: e, transform: [{ translateY: (1 - e) * 10 }] };
  });
  return (
    <Animated.View style={[{ alignItems: 'center', marginTop: 28 }, style]}>
      <Text style={[st.word, { fontSize: 60, lineHeight: 72 }]}>pero</Text>
      <Text style={[st.studio, { marginTop: -8, fontSize: 22 }]}>studio</Text>
    </Animated.View>
  );
}

type FlakeT = { x: number; r: number; speed: number; phase: number; drift: number };
function Flake({ f, loop, H }: { f: FlakeT; loop: SharedValue<number>; H: number }) {
  const style = useAnimatedStyle(() => {
    const p = (loop.value * f.speed + f.phase) % 1;
    return { transform: [{ translateX: f.x + f.drift * Math.sin(p * Math.PI * 4 + f.phase * 6) }, { translateY: -20 + p * (H + 40) }] };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: 0, top: 0, width: f.r * 2, height: f.r * 2, borderRadius: f.r, backgroundColor: '#fff', opacity: f.r > 2.2 ? 0.85 : 0.45 }, style]}
    />
  );
}

const st = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  word: { fontFamily: 'DancingScript_700Bold', fontSize: S, lineHeight: LINE_H, color: '#f1f2f4', includeFontPadding: false, textAlignVertical: 'center' },
  cover: { position: 'absolute', left: -6, top: -10, bottom: -10, width: WORD_W + 70, backgroundColor: BG },
  feather: { position: 'absolute', left: 0, top: 0 },
  studio: { fontFamily: 'CormorantGaramond_500Medium_Italic', fontSize: 30, color: '#a9b0be', marginTop: 2 },
  rod: { position: 'absolute', backgroundColor: '#aeb4bf', overflow: 'hidden' },
  shadow: { position: 'absolute', backgroundColor: '#fff', opacity: 0.07 },
});
