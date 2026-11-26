import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useTheme } from '../../theme';
import { useLive } from '../../db/hooks';
import { deleteSession, getActiveProgram, getSession, listSets, setsForExercise } from '../../db/repo';
import { defsFor } from '../../features/session';
import { e1rm } from '../../core/training';
import { clock, num, plural } from '../../core/units';
import { Btn, Card, Row, Screen, Sheet, Txt } from '../../ui/kit';
import { Icon } from '../../ui/Icon';
import { ExerciseArt } from '../../ui/ExerciseArt';

const MOOD = ['', 'Ужасно', 'Плохо', 'Норм', 'Хорошо', 'Отлично'];
const FAT = ['', 'Свежий', 'Легко', 'Средне', 'Устал', 'Выжат'];

export default function SessionDetail() {
  const t = useTheme();
  const router = useRouter();
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();
  const sid = Number(id);
  const s = useLive(() => getSession(sid), [sid]);
  const rows = useLive(() => listSets(sid), [sid]);
  const program = useLive(() => getActiveProgram());
  const defs = useMemo(() => defsFor(program), [program]);
  const [del, setDel] = useState(false);

  const groups = useMemo(() => {
    const m = new Map<number, typeof rows>();
    for (const r of rows) if (r.completedAt) m.set(r.position, [...(m.get(r.position) ?? []), r]);
    return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([, rs]) => rs);
  }, [rows]);

  // Рекорды: лучший расчётный максимум в этой тренировке выше всех прошлых
  const records = useMemo(() => {
    if (!s) return [];
    const out: { name: string; text: string }[] = [];
    for (const rs of groups) {
      const work = rs.filter((r) => r.kind === 'work' && r.weight && r.reps);
      if (!work.length) continue;
      const best = work.reduce((b, r) => (e1rm(r.weight!, r.reps!, r.rir ?? 0) > e1rm(b.weight!, b.reps!, b.rir ?? 0) ? r : b));
      const before = setsForExercise(best.exerciseId).filter((x) => x.startedAt < s.startedAt && x.kind === 'work' && x.weight && x.reps && x.variantId === best.variantId);
      if (!before.length) continue;
      const prev = Math.max(...before.map((x) => e1rm(x.weight!, x.reps!, x.rir ?? 0)));
      const cur = e1rm(best.weight!, best.reps!, best.rir ?? 0);
      if (cur > prev + 0.01) out.push({ name: defs.get(best.exerciseId)?.name ?? best.exerciseId, text: `${num(best.weight!)} × ${best.reps}, 1ПМ ${num(cur)} кг (+${num(cur - prev)})` });
    }
    return out;
  }, [groups, s, defs]);

  if (!s) return <Screen back title="Тренировка"><Txt>Не найдена</Txt></Screen>;
  const work = rows.filter((r) => r.kind === 'work' && r.completedAt);
  const tonnage = work.reduce((a, r) => a + (r.weight ?? 0) * (r.reps ?? 0), 0);
  const dur = ((s.finishedAt ?? Date.now()) - s.startedAt) / 1000;
  const date = new Date(s.startedAt).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <Screen back title={fresh ? 'Отличная работа!' : s.workoutName} subtitle={fresh ? `${s.workoutName} · ${date}` : date}>
      <Animated.View entering={fresh ? ZoomIn.springify().damping(14) : FadeInDown} style={{ flexDirection: 'row', gap: 8 }}>
        <Big label="время" value={clock(dur)} />
        <Big label={plural(work.length, 'подход', 'подхода', 'подходов')} value={String(work.length)} />
        <Big label="тоннаж" value={`${num(tonnage / 1000)} т`} />
      </Animated.View>

      {records.length > 0 && (
        <Animated.View entering={FadeInDown.delay(150)}>
          <Card style={{ gap: 10, backgroundColor: t.c.done }}>
            <Row gap={10}>
              <Icon name="trophy" size={22} color={t.c.accentText} />
              <Txt v="h3" color={t.c.accentText}>{records.length} {plural(records.length, 'рекорд', 'рекорда', 'рекордов')}</Txt>
            </Row>
            {records.map((r) => (
              <View key={r.name}>
                <Txt v="medium">{r.name}</Txt>
                <Txt v="small">{r.text}</Txt>
              </View>
            ))}
          </Card>
        </Animated.View>
      )}

      {(s.mood || s.fatigue || s.note) && (
        <Card style={{ gap: 6 }}>
          {(s.mood || s.fatigue) && <Txt v="medium">{[s.mood && `Самочувствие: ${MOOD[s.mood]}`, s.fatigue && `Усталость: ${FAT[s.fatigue]}`].filter(Boolean).join(' · ')}</Txt>}
          {s.note && <Txt v="small">{s.note}</Txt>}
        </Card>
      )}

      {groups.map((rs, i) => {
        const d = defs.get(rs[0].exerciseId);
        const v = d?.variants?.find((x) => x.id === rs[0].variantId);
        return (
          <Animated.View key={i} entering={FadeInDown.delay(100 + i * 40)}>
            <Card style={{ gap: 8 }} onPress={() => router.push(`/exercise/${rs[0].exerciseId}`)}>
              <Row gap={12}>
                <ExerciseArt def={d} variantId={rs[0].variantId} size={40} />
                <View style={{ flex: 1 }}>
                  <Txt v="medium">{d?.name ?? rs[0].exerciseId}</Txt>
                  {v && <Txt v="small">{v.name}</Txt>}
                </View>
              </Row>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {rs.map((r) => (
                  <View key={r.id} style={{ backgroundColor: r.kind === 'warmup' ? 'transparent' : t.c.chip, borderWidth: r.kind === 'warmup' ? 1 : 0, borderColor: t.c.line, borderRadius: t.r.sm, paddingHorizontal: 8, paddingVertical: 5 }}>
                    <Text style={{ fontFamily: t.f.bold, fontSize: 13, color: r.kind === 'warmup' ? t.c.muted : t.c.ink, fontVariant: ['tabular-nums'] }}>
                      {r.durationS != null ? `${r.durationS} с` : `${num(r.weight ?? 0)}×${r.reps}`}
                      {r.side === 'left' ? ' Л' : r.side === 'right' ? ' П' : ''}
                      {r.rir != null && <Text style={{ fontFamily: t.f.medium, color: t.c.muted }}>{`  @${r.rir >= 4 ? '4+' : r.rir}`}</Text>}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          </Animated.View>
        );
      })}

      <Row gap={8}>
        <Btn kind="secondary" icon="edit" title="Исправить" onPress={() => router.push(`/workout/${sid}`)} style={{ flex: 1 }} />
        <Btn kind="danger" icon="trash" title="Удалить" onPress={() => setDel(true)} style={{ flex: 1 }} />
      </Row>
      {fresh && <Btn title="На главную" onPress={() => router.dismissTo('/')} />}

      <Sheet open={del} onClose={() => setDel(false)} title="Удалить тренировку?">
        <Txt v="small">Все подходы этой тренировки удалятся. Отменить нельзя.</Txt>
        <Btn kind="danger" icon="trash" title="Удалить" onPress={() => { deleteSession(sid); setDel(false); router.back(); }} />
      </Sheet>
    </Screen>
  );
}

function Big({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.c.card, borderRadius: t.r.lg, paddingVertical: 14, alignItems: 'center', borderWidth: t.border, borderColor: t.c.line }}>
      <Text style={{ fontFamily: t.f.num, fontSize: 24, color: t.c.ink }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={{ fontFamily: t.f.medium, fontSize: 12, color: t.c.muted }}>{label}</Text>
    </View>
  );
}
