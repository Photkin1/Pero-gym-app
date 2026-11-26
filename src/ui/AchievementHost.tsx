// Торжественное поздравление с новой ачивкой: медаль, лучи, конфетти и вибрация.
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { Dimensions, Modal, Text, View } from 'react-native';
import Animated, {
  Easing, FadeIn, FadeOut, ZoomIn, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path, G } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme';
import { peekQueue, shiftQueue, subscribeQueue } from '../features/achievements';
import { Btn } from './kit';

const GROUP_LABEL = { habit: 'Привычка', progress: 'Прогресс', strength: 'Сила' };

export function AchievementHost() {
  const a = useSyncExternalStore(subscribeQueue, peekQueue);
  useEffect(() => {
    if (!a) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const id = setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}), 260);
    return () => clearTimeout(id);
  }, [a]);
  if (!a) return null;
  return (
    <Modal transparent visible animationType="none" onRequestClose={shiftQueue} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Confetti key={`c-${a.id}`} />
        <Medal key={a.id} title={a.title} desc={a.desc} group={GROUP_LABEL[a.group]} />
      </Animated.View>
    </Modal>
  );
}

function Medal({ title, desc, group }: { title: string; desc: string; group: string }) {
  const t = useTheme();
  const spin = useSharedValue(0);
  useEffect(() => {
    spin.value = withRepeat(withTiming(360, { duration: 14000, easing: Easing.linear }), -1);
  }, [spin]);
  const rays = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));
  return (
    <Animated.View entering={ZoomIn.springify().damping(12)} style={{ width: '100%', maxWidth: 360, backgroundColor: t.c.card, borderRadius: 28, padding: 22, alignItems: 'center', gap: 8 }}>
      <View style={{ width: 160, height: 160, alignItems: 'center', justifyContent: 'center', marginTop: -70 }}>
        <Animated.View style={[{ position: 'absolute' }, rays]}>
          <Svg width={160} height={160} viewBox="0 0 160 160">
            <G opacity={0.4}>
              {Array.from({ length: 14 }, (_, i) => (
                <Path key={i} d="M80 80 L76 2 L84 2 Z" fill={t.c.accent} transform={`rotate(${(i * 360) / 14} 80 80)`} />
              ))}
            </G>
          </Svg>
        </Animated.View>
        {/* Медаль в виде блина штанги */}
        <Svg width={104} height={104} viewBox="0 0 104 104">
          <Circle cx={52} cy={54} r={48} fill="#000" opacity={0.18} />
          <Circle cx={52} cy={50} r={48} fill={t.c.accent} />
          <Circle cx={52} cy={50} r={38} fill="none" stroke={t.c.onAccent} strokeOpacity={0.3} strokeWidth={3} />
          <Circle cx={52} cy={50} r={27} fill="none" stroke={t.c.onAccent} strokeOpacity={0.18} strokeWidth={2} />
          <Circle cx={52} cy={50} r={10} fill={t.c.card} />
          <Path d="M24 30 A34 34 0 0 1 52 16" stroke="#fff" strokeOpacity={0.45} strokeWidth={4} strokeLinecap="round" fill="none" />
        </Svg>
      </View>
      <Text style={{ fontFamily: t.f.semibold, fontSize: 13, color: t.c.accentText }}>Новая ачивка · {group}</Text>
      <Text style={{ fontFamily: t.f.display, fontSize: 26, lineHeight: 30, color: t.c.ink, textAlign: 'center' }}>{title}</Text>
      <Text style={{ fontFamily: t.f.body, fontSize: 15.5, lineHeight: 21, color: t.c.muted, textAlign: 'center' }}>{desc}</Text>
      <Btn title="Красота" onPress={shiftQueue} style={{ alignSelf: 'stretch', marginTop: 8 }} />
    </Animated.View>
  );
}

const COLORS = ['#ff6b4a', '#ffcc00', '#2f5bff', '#5fd39a', '#ff5a1f', '#7b61ff', '#ffffff'];

function Piece({ x, delay, color, size, drift, spin }: { x: number; delay: number; color: string; size: number; drift: number; spin: number }) {
  const H = Dimensions.get('window').height;
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withTiming(1, { duration: 2600, easing: Easing.out(Easing.quad) }));
  }, [p, delay]);
  const st = useAnimatedStyle(() => ({
    opacity: 1 - p.value * 0.6,
    transform: [{ translateY: -40 + p.value * (H + 80) }, { translateX: Math.sin(p.value * 6) * drift }, { rotate: `${p.value * spin}deg` }],
  }));
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: x, width: size, height: size * 0.45, borderRadius: 2, backgroundColor: color }, st]} />;
}

function Confetti() {
  const W = Dimensions.get('window').width;
  // Детерминированный «случайный» разброс
  const pieces = useMemo(() => {
    let s = 7;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    return Array.from({ length: 46 }, (_, i) => ({ x: r() * W, delay: r() * 500, color: COLORS[i % COLORS.length], size: 8 + r() * 8, drift: 10 + r() * 30, spin: 360 + r() * 720 }));
  }, [W]);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      {pieces.map((p, i) => <Piece key={i} {...p} />)}
    </View>
  );
}
