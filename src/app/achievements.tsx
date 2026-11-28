import { Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../theme';
import { useLive } from '../db/hooks';
import { getSetting } from '../db/repo';
import { ACHIEVEMENTS, rankOf } from '../core/achievements';
import { Bar, Card, Row, Screen, SectionTitle, Txt } from '../ui/kit';

const GROUPS = [
  { id: 'habit', title: 'Привычка' },
  { id: 'progress', title: 'Прогресс' },
  { id: 'strength', title: 'Сила' },
] as const;

export default function Achievements() {
  const t = useTheme();
  const got = useLive(() => getSetting<Record<string, number>>('achievements', {}));
  const count = ACHIEVEMENTS.filter((a) => got[a.id]).length;
  const rank = rankOf(count);
  return (
    <Screen back title="Ачивки" subtitle={`${count} из ${ACHIEVEMENTS.length}`}>
      <Card style={{ gap: 10 }}>
        <Txt v="label">Звание</Txt>
        <Txt v="h2">{rank.title}</Txt>
        {rank.next && (
          <>
            <Bar value={count / rank.next.count} />
            <Txt v="small">До звания «{rank.next.title}»: ещё {rank.next.count - count}</Txt>
          </>
        )}
      </Card>
      {GROUPS.map((g) => (
        <View key={g.id} style={{ gap: 8 }}>
          <SectionTitle>{g.title}</SectionTitle>
          {ACHIEVEMENTS.filter((a) => a.group === g.id).map((a, i) => {
            const on = !!got[a.id];
            return (
              <Animated.View key={a.id} entering={FadeInDown.delay(Math.min(i, 8) * 30)}>
                <Card style={{ opacity: on ? 1 : 0.55 }}>
                  <Row gap={12}>
                    <Svg width={40} height={40} viewBox="0 0 40 40">
                      <Circle cx={20} cy={20} r={18} fill={on ? t.c.accent : t.c.chip} />
                      <Circle cx={20} cy={20} r={13} fill="none" stroke={on ? t.c.onAccent : t.c.faint} strokeOpacity={0.35} strokeWidth={2} />
                      <Circle cx={20} cy={20} r={4} fill={t.c.card} />
                    </Svg>
                    <View style={{ flex: 1 }}>
                      <Txt v="medium">{a.title}</Txt>
                      <Txt v="small">{a.desc}</Txt>
                    </View>
                    {on && <Text style={{ fontFamily: t.f.medium, fontSize: 11.5, color: t.c.muted }}>{new Date(got[a.id]).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</Text>}
                  </Row>
                </Card>
              </Animated.View>
            );
          })}
        </View>
      ))}
    </Screen>
  );
}
