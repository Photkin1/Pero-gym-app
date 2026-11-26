import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../theme';
import { useLive } from '../../db/hooks';
import { listSessions } from '../../db/repo';
import { clock, num, plural } from '../../core/units';
import { Card, Empty, Row, Screen, SectionTitle, Txt } from '../../ui/kit';
import { Icon } from '../../ui/Icon';

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MOOD = ['', 'ужасно', 'плохо', 'норм', 'хорошо', 'отлично'];

export default function History() {
  const t = useTheme();
  const router = useRouter();
  const sessions = useLive(() => listSessions(500));
  const groups = useMemo(() => {
    const m = new Map<string, typeof sessions>();
    for (const s of sessions) {
      const d = new Date(s.startedAt);
      const k = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
      m.set(k, [...(m.get(k) ?? []), s]);
    }
    return [...m.entries()];
  }, [sessions]);

  return (
    <Screen headerBand title="История" subtitle={`${sessions.length} ${plural(sessions.length, 'тренировка', 'тренировки', 'тренировок')}`}>
      {!sessions.length && <Empty icon="clock" title="Здесь будут тренировки" text="После первой тренировки тут появится её запись со всеми подходами" />}
      {groups.map(([month, list]) => (
        <View key={month} style={{ gap: 10 }}>
          <SectionTitle right={<Txt v="small">{list.length}</Txt>}>{month}</SectionTitle>
          {list.map((s, i) => {
            const d = new Date(s.startedAt);
            return (
              <Animated.View key={s.id} entering={FadeInDown.delay(Math.min(i, 8) * 40).duration(300)}>
                <Card onPress={() => router.push(`/history/${s.id}`)}>
                  <Row gap={14}>
                    <View style={{ width: 46, alignItems: 'center', backgroundColor: t.c.chip, borderRadius: t.r.md, paddingVertical: 6 }}>
                      <Text style={{ fontFamily: t.f.num, fontSize: 19, color: t.c.ink }}>{d.getDate()}</Text>
                      <Text style={{ fontFamily: t.f.medium, fontSize: 11, color: t.c.muted }}>{d.toLocaleDateString('ru-RU', { weekday: 'short' })}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Txt v="medium" numberOfLines={1}>{s.workoutName}</Txt>
                      <Txt v="small" numberOfLines={1}>
                        {clock(((s.finishedAt ?? s.startedAt) - s.startedAt) / 1000)} · {s.sets} {plural(s.sets, 'подход', 'подхода', 'подходов')} · {num(s.tonnage / 1000)} т
                        {s.mood ? ` · ${MOOD[s.mood]}` : ''}
                      </Txt>
                    </View>
                    <Icon name="chevron" size={18} color={t.c.muted} />
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
