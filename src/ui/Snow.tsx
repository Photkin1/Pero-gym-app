// Новогодний снег поверх приложения: только в тёмной теме и только в сезон (см. isNewYearSeason).
// Редкий и полупрозрачный, чтобы не мешать читать цифры; касания проходят насквозь.
import { useEffect, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';

type F = { x: number; r: number; speed: number; phase: number; drift: number; op: number };

export function Snow({ count = 22 }: { count?: number }) {
  const reduced = useReducedMotion();
  const { width: W, height: H } = useWindowDimensions();
  const loop = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    loop.value = withRepeat(withTiming(1, { duration: 30000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(loop);
  }, [loop, reduced]);
  const flakes = useMemo<F[]>(
    () => Array.from({ length: count }, () => {
      const r = 1 + Math.random() * 2;
      return { x: Math.random() * W, r, speed: 2 + Math.floor(Math.random() * 3), phase: Math.random(), drift: 8 + Math.random() * 18, op: 0.15 + (r / 3) * 0.3 };
    }),
    [W, count],
  );
  if (reduced) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {flakes.map((f, i) => <Flake key={i} f={f} loop={loop} H={H} />)}
    </View>
  );
}

function Flake({ f, loop, H }: { f: F; loop: SharedValue<number>; H: number }) {
  const style = useAnimatedStyle(() => {
    const p = (loop.value * f.speed + f.phase) % 1;
    return { transform: [{ translateX: f.x + f.drift * Math.sin(p * Math.PI * 6 + f.phase * 6) }, { translateY: -10 + p * (H + 20) }] };
  });
  return <Animated.View style={[{ position: 'absolute', width: f.r * 2, height: f.r * 2, borderRadius: f.r, backgroundColor: '#fff', opacity: f.op }, style]} />;
}
