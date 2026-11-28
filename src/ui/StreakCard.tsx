// Огонёк серии: недели подряд по плану и прогресс текущей недели.
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, Easing } from 'react-native-reanimated';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '../theme';
import type { Streak } from '../core/streak';
import { plural } from '../core/units';
import { Card, Row } from './kit';

export function Flame({ size = 54, lit = true }: { size?: number; lit?: boolean }) {
  const t = useTheme();
  const s = useSharedValue(1);
  useEffect(() => {
    if (!lit) return;
    s.value = withRepeat(withSequence(withTiming(1.07, { duration: 700, easing: Easing.inOut(Easing.quad) }), withTiming(0.97, { duration: 700, easing: Easing.inOut(Easing.quad) })), -1, true);
  }, [s, lit]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Animated.View style={a}>
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Defs>
          <LinearGradient id="fl" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={lit ? '#ffcc00' : t.c.faint} />
            <Stop offset="1" stopColor={lit ? t.c.accent : t.c.chip} />
          </LinearGradient>
        </Defs>
        <Path d="M24 45c9 0 15-6 15-14 0-9-8-13-9-22-6 3-9 9-8 15-3-1-5-4-5-7-4 4-8 9-8 14 0 8 6 14 15 14z" fill="url(#fl)" />
        <Path d="M24 45c4 0 7-3 7-7 0-4-3-6-4-10-3 2-4 5-4 8-2-1-3-2-3-4-2 2-3 4-3 6 0 4 3 7 7 7z" fill="#fff" opacity={lit ? 0.55 : 0.2} />
      </Svg>
    </Animated.View>
  );
}

export function StreakCard({ s, onPress }: { s: Streak; onPress?: () => void }) {
  const t = useTheme();
  const lit = s.weeks > 0 || s.thisWeek > 0;
  return (
    <Card onPress={onPress} style={{ gap: 12 }}>
      <Row gap={14}>
        <Flame lit={lit} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: t.f.num, fontSize: 28, lineHeight: 32, color: t.c.ink }}>
            {s.weeks} <Text style={{ fontFamily: t.f.semibold, fontSize: 15, color: t.c.muted }}>{plural(s.weeks, 'неделя', 'недели', 'недель')} подряд</Text>
          </Text>
          <Text style={{ fontFamily: t.f.medium, fontSize: 13, color: s.weekDone ? t.c.good : t.c.muted }}>
            {s.weekDone ? 'Неделя засчитана, огонь горит' : `Ещё ${s.goal - s.thisWeek} ${plural(s.goal - s.thisWeek, 'тренировка', 'тренировки', 'тренировок')} до зачёта недели`}
          </Text>
        </View>
      </Row>
      <Row gap={6}>
        {Array.from({ length: s.goal }, (_, i) => (
          <View key={i} style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: i < s.thisWeek ? t.c.accent : t.c.chip }} />
        ))}
      </Row>
      <Text style={{ fontFamily: t.f.body, fontSize: 12, color: t.c.faint }}>
        {s.freezeReady ? 'Заморозка готова: одну неделю можно пропустить без потери серии' : 'Заморозка уже использована, снова будет доступна через месяц'}
        {s.best > s.weeks ? ` · рекорд ${s.best}` : ''}
      </Text>
    </Card>
  );
}
