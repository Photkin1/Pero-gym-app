import { useMemo, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../theme';
import { useLive } from '../../db/hooks';
import { getActiveProgram, getPref, setPref, setsForExercise } from '../../db/repo';
import { defsFor } from '../../features/session';
import { MUSCLE_RU, e1rm, incrementFor } from '../../core/training';
import { num } from '../../core/units';
import { Btn, Card, Chip, Row, Screen, SectionTitle, Segmented, Txt } from '../../ui/kit';
import { ExerciseArt, ExercisePhoto, hasPhoto } from '../../ui/ExerciseArt';
import { LineChart } from '../../ui/charts';
import { Icon } from '../../ui/Icon';

export default function ExerciseScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const program = useLive(() => getActiveProgram());
  const def = useMemo(() => defsFor(program).get(id), [program, id]);
  const pref = useLive(() => getPref(id), [id]);
  const history = useLive(() => setsForExercise(id), [id]);
  const [variant, setVariant] = useState<string | null>(pref.variantId ?? def?.variants?.[0]?.id ?? null);
  const [metric, setMetric] = useState<'e1rm' | 'top'>('e1rm');

  if (!def) {
    return (
      <Screen back title="Упражнение">
        <Txt>Упражнение не найдено</Txt>
      </Screen>
    );
  }

  const rows = history.filter((s) => s.kind === 'work' && (variant == null || s.variantId === variant));
  const bySession = new Map<number, typeof rows>();
  for (const r of rows) bySession.set(r.sessionId, [...(bySession.get(r.sessionId) ?? []), r]);
  const sessions = [...bySession.values()].map((ss) => {
    const best = ss.reduce((b, s) => (e1rm(s.weight ?? 0, s.reps ?? 0, s.rir ?? 0) > e1rm(b.weight ?? 0, b.reps ?? 0, b.rir ?? 0) ? s : b), ss[0]);
    return {
      at: ss[0].startedAt,
      e1rm: e1rm(best.weight ?? 0, best.reps ?? 0, best.rir ?? 0),
      top: Math.max(...ss.map((s) => s.weight ?? 0)),
      sets: ss,
      volume: ss.reduce((a, s) => a + (s.weight ?? 0) * (s.reps ?? 0), 0),
    };
  });
  const points = sessions.map((s) => ({ x: s.at, y: metric === 'e1rm' ? s.e1rm : s.top }));
  const bestE = Math.max(0, ...sessions.map((s) => s.e1rm));
  const bestW = Math.max(0, ...rows.map((s) => s.weight ?? 0));
  const bestReps = Math.max(0, ...rows.map((s) => s.reps ?? 0));
  const isTime = def.type === 'time';
  const query = encodeURIComponent(`${def.name}${variant ? ` ${def.variants?.find((v) => v.id === variant)?.name ?? ''}` : ''} техника`);
  const video = def.video ?? `https://www.youtube.com/results?search_query=${query}`;
  const inc = incrementFor(def, variant, pref.increment);

  return (
    <Screen back title={def.name} subtitle={[...def.muscles.primary.map((m) => MUSCLE_RU[m]), ...(def.muscles.secondary ?? []).map((m) => MUSCLE_RU[m].toLowerCase())].join(', ')}>
      <Animated.View entering={FadeInDown.duration(350)} style={{ alignItems: 'center', paddingVertical: 4 }}>
        {hasPhoto(def, variant) ? <ExercisePhoto def={def} variantId={variant} /> : <ExerciseArt def={def} variantId={variant} size={132} />}
      </Animated.View>

      {def.variants && def.variants.length > 1 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {def.variants.map((v) => (
            <Chip key={v.id} label={v.name} on={variant === v.id} onPress={() => { setVariant(v.id); setPref(id, { variantId: v.id }); }} />
          ))}
        </View>
      )}

      <Btn kind="secondary" icon="video" title="Видео с техникой" onPress={() => Linking.openURL(video)} />

      {def.tips && def.tips.length > 0 && (
        <>
          <SectionTitle>За чем следить</SectionTitle>
          <Card style={{ gap: 12 }}>
            {def.tips.map((tip, i) => (
              <Row key={i} gap={12} style={{ alignItems: 'flex-start' }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: t.c.chip, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: t.f.bold, fontSize: 12.5, color: t.c.accentText }}>{i + 1}</Text>
                </View>
                <Txt style={{ flex: 1 }}>{tip}</Txt>
              </Row>
            ))}
          </Card>
        </>
      )}

      {!isTime && (
        <>
          <SectionTitle>Прогресс</SectionTitle>
          <Row gap={8}>
            <Mini label="Расчётный 1ПМ" value={bestE ? `${num(bestE)} кг` : '—'} />
            <Mini label="Макс. вес" value={bestW ? `${num(bestW)} кг` : '—'} />
            <Mini label="Макс. повт" value={bestReps ? String(bestReps) : '—'} />
          </Row>
          <Card style={{ gap: 12 }}>
            <Segmented value={metric} onChange={setMetric} options={[{ id: 'e1rm', label: 'Расчётный 1ПМ' }, { id: 'top', label: 'Рабочий вес' }]} />
            <LineChart points={points} />
            {metric === 'e1rm' && (
              <Row gap={8} style={{ alignItems: 'flex-start' }}>
                <Icon name="info" size={16} color={t.c.muted} />
                <Txt v="small" style={{ flex: 1 }}>
                  1ПМ это вес, который можно поднять один раз. Он считается по лучшему подходу тренировки (формула Эпли с учётом RIR), так что «70 × 10» и «80 × 6» можно сравнивать.
                </Txt>
              </Row>
            )}
          </Card>
        </>
      )}

      {sessions.length > 0 && (
        <>
          <SectionTitle>История</SectionTitle>
          <Card style={{ gap: 12 }}>
            {[...sessions].reverse().slice(0, 12).map((s) => (
              <View key={s.at} style={{ gap: 4 }}>
                <Row>
                  <Txt v="medium" style={{ flex: 1 }}>{new Date(s.at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</Txt>
                  {!isTime && <Txt v="small">1ПМ {num(s.e1rm)}</Txt>}
                </Row>
                <Txt v="small">
                  {s.sets.map((x) => (isTime ? `${x.durationS} с` : `${num(x.weight ?? 0)}×${x.reps}${x.side === 'left' ? 'Л' : x.side === 'right' ? 'П' : ''}`)).join('   ')}
                </Txt>
              </View>
            ))}
          </Card>
        </>
      )}

      {def.type !== 'time' && (
        <>
          <SectionTitle>Шаг прибавки</SectionTitle>
          <Card style={{ gap: 10 }}>
            <Txt v="small">Когда пора прибавлять, приложение предложит +{num(inc, 2)} кг. Поменяй под блины и тренажёры своего зала.</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[0.5, 1, 1.25, 2, 2.5, 5, 10].map((s) => (
                <Chip key={s} label={`${num(s, 2)} кг`} on={inc === s} onPress={() => setPref(id, { increment: s })} />
              ))}
            </View>
          </Card>
        </>
      )}
    </Screen>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.c.card, borderRadius: t.r.md, padding: 12, borderWidth: t.border, borderColor: t.c.line }}>
      <Text style={{ fontFamily: t.f.num, fontSize: 18, color: t.c.ink }}>{value}</Text>
      <Text style={{ fontFamily: t.f.medium, fontSize: 11.5, color: t.c.muted, marginTop: 2 }}>{label}</Text>
    </View>
  );
}
