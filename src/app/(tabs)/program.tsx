import { useMemo, useState } from 'react';
import { Share, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useTheme } from '../../theme';
import { useLive } from '../../db/hooks';
import { activateProgram, deleteProgram, getLibrary, listPrograms, saveProgram } from '../../db/repo';
import { exerciseIndex, parseProgram, WEEKDAYS, type ProgramIssue } from '../../core/program';
import { emptyProgram } from '../../core/templates';
import { MUSCLE_RU, plannedWeeklySets, WEEKDAY_RU } from '../../core/training';
import { plural, rangeLabel } from '../../core/units';
import { pickTextFile, shareAiKit, shareProgram } from '../../features/files';
import { Btn, Card, Chip, IconBtn, Row, Screen, SectionTitle, Sheet, Txt, toast } from '../../ui/kit';
import { ZoneBars } from '../../ui/charts';
import { Icon } from '../../ui/Icon';

const LEVEL: Record<string, string> = { beginner: 'новичок', intermediate: 'средний', advanced: 'опытный' };

export default function ProgramTab() {
  const t = useTheme();
  const router = useRouter();
  const programs = useLive(() => listPrograms());
  const lib = useLive(() => getLibrary());
  const active = programs.find((p) => p.isActive) ?? null;
  const others = programs.filter((p) => !p.isActive);
  const [issues, setIssues] = useState<{ name: string; list: ProgramIssue[] } | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState<number | null>(null);

  const defs = useMemo(() => exerciseIndex(lib, active?.program), [lib, active]);
  const volume = useMemo(() => {
    if (!active) return [];
    const m = plannedWeeklySets(active.program, defs);
    return [...m.entries()].filter(([, v]) => v >= 2).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: MUSCLE_RU[k], value: v }));
  }, [active, defs]);

  const importFile = async () => {
    try {
      const f = await pickTextFile();
      if (!f) return;
      const r = parseProgram(f.text, lib);
      if (!r.ok) {
        setIssues({ name: f.name, list: r.issues });
        return;
      }
      const id = saveProgram(r.program, { activate: false });
      toast(`Программа «${r.program.name}» добавлена${r.warnings.length ? `, замечаний: ${r.warnings.length}` : ''}`, 'check');
      router.push(`/program/${id}`);
    } catch (e) {
      toast((e as Error).message, 'info');
    }
  };

  const issuesText = issues ? `Приложение Pero не принимает файл программы ${issues.name}. Исправь, пожалуйста, ошибки и пришли весь файл заново:\n${issues.list.map((i) => `- ${i.line ? `строка ${i.line}: ` : ''}${i.path ? `${i.path}: ` : ''}${i.message}`).join('\n')}` : '';

  return (
    <Screen headerBand title="Программа" subtitle={active ? active.program.name : 'Не выбрана'}>
      {active && (
        <Animated.View entering={FadeInDown.duration(350)} style={{ gap: 12 }}>
          <Card style={{ gap: 12 }}>
            <View style={{ gap: 4 }}>
              <Txt v="h2">{active.program.name}</Txt>
              <Txt v="small">
                {[active.program.author && `Автор: ${active.program.author}`, active.program.level && `уровень ${LEVEL[active.program.level]}`].filter(Boolean).join(' · ')}
              </Txt>
              {active.program.description && <Txt v="small" style={{ marginTop: 4 }}>{active.program.description.trim()}</Txt>}
            </View>
            {active.program.schedule.type === 'weekly' ? (
              <Row gap={6}>
                {WEEKDAYS.map((wd) => {
                  const sched = active.program.schedule;
                  const w = sched.type === 'weekly' ? sched.days[wd] : undefined;
                  return (
                    <View key={wd} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: t.r.sm, backgroundColor: w ? t.c.accent : t.c.chip }}>
                      <Text style={{ fontFamily: t.f.bold, fontSize: 12, color: w ? t.c.onAccent : t.c.muted }}>{WEEKDAY_RU[wd]}</Text>
                    </View>
                  );
                })}
              </Row>
            ) : (
              <Txt v="small">По кругу: {active.program.schedule.order.map((id) => (id === 'rest' ? 'отдых' : active.program.workouts.find((w) => w.id === id)?.name ?? id)).join(' → ')}</Txt>
            )}
            <Row gap={8}>
              <Btn small icon="edit" title="Изменить" onPress={() => router.push(`/program/${active.id}`)} style={{ flex: 1 }} />
              <Btn small kind="secondary" icon="share" title="Файлом" onPress={() => shareProgram(active.program).catch((e) => toast(e.message))} style={{ flex: 1 }} />
            </Row>
          </Card>

          {active.program.workouts.map((w, i) => (
            <Animated.View key={w.id} entering={FadeInDown.delay(60 * (i + 1)).duration(350)}>
              <Card onPress={() => router.push(`/program/${active.id}?workout=${w.id}`)} style={{ gap: 8 }}>
                <Row>
                  <Txt v="h3" style={{ flex: 1 }}>{w.name}</Txt>
                  <Txt v="small">{w.exercises.length} {plural(w.exercises.length, 'упражнение', 'упражнения', 'упражнений')}</Txt>
                  <Icon name="chevron" size={18} color={t.c.muted} />
                </Row>
                {w.exercises.map((x, j) => (
                  <Row key={j} gap={8}>
                    <Text style={{ width: 18, fontFamily: t.f.bold, fontSize: 12.5, color: x.group ? t.c.warm : t.c.faint }}>{x.group ?? j + 1}</Text>
                    <Txt v="small" style={{ flex: 1, color: t.c.ink }} numberOfLines={1}>{defs.get(x.exercise)?.name ?? x.exercise}</Txt>
                    <Txt v="small">{x.sets} × {rangeLabel(x.reps)}</Txt>
                  </Row>
                ))}
              </Card>
            </Animated.View>
          ))}

          <SectionTitle>Подходов в неделю на мышцу</SectionTitle>
          <Card style={{ gap: 10 }}>
            <Txt v="small">Зелёная зона 10–20 рабочих подходов в неделю: в этом диапазоне рост мышц лучший для большинства (Schoenfeld 2017, Pelland 2024). Вспомогательная мышца считается за половину подхода.</Txt>
            <ZoneBars rows={volume} />
          </Card>
        </Animated.View>
      )}

      <SectionTitle>Другие программы</SectionTitle>
      {others.map((p) => (
        <Animated.View key={p.id} layout={LinearTransition}>
          <Card style={{ gap: 10 }}>
            <Row>
              <View style={{ flex: 1 }}>
                <Txt v="medium">{p.program.name}</Txt>
                <Txt v="small">{p.program.workouts.length} {plural(p.program.workouts.length, 'тренировка', 'тренировки', 'тренировок')}{p.program.level ? ` · ${LEVEL[p.program.level]}` : ''}</Txt>
              </View>
              <IconBtn name="edit" onPress={() => router.push(`/program/${p.id}`)} color={t.c.muted} size={36} label="Изменить" />
              <IconBtn name="trash" onPress={() => setConfirmDel(p.id)} color={t.c.muted} size={36} label="Удалить" />
            </Row>
            <Btn small kind="secondary" title="Сделать основной" onPress={() => { activateProgram(p.id); toast(`Теперь основная: ${p.program.name}`, 'check'); }} />
          </Card>
        </Animated.View>
      ))}

      <Row gap={8}>
        <Btn kind="secondary" icon="plus" title="Новая" onPress={() => { const id = saveProgram(emptyProgram()); router.push(`/program/${id}`); }} style={{ flex: 1 }} />
        <Btn kind="secondary" icon="import" title="Из файла" onPress={importFile} style={{ flex: 1 }} />
      </Row>
      <Card onPress={() => setHelpOpen(true)} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Icon name="file" size={22} color={t.c.accentText} />
        <View style={{ flex: 1 }}>
          <Txt v="medium">Составить программу с нейросетью</Txt>
          <Txt v="small">Отправь инструкцию ChatGPT или Claude, получи файл и импортируй</Txt>
        </View>
        <Icon name="chevron" size={18} color={t.c.muted} />
      </Card>

      <Sheet open={!!issues} onClose={() => setIssues(null)} title="Файл не подошёл">
        {issues && (
          <>
            <Txt v="small">{issues.name}: {issues.list.length} {plural(issues.list.length, 'ошибка', 'ошибки', 'ошибок')}. Отправь этот список нейросети, которая писала файл, она исправит.</Txt>
            {issues.list.slice(0, 12).map((i, k) => (
              <Row key={k} gap={10} style={{ alignItems: 'flex-start' }}>
                <Text style={{ fontFamily: t.f.bold, color: t.c.bad, fontSize: 13, minWidth: 64 }}>{i.line ? `строка ${i.line}` : 'файл'}</Text>
                <Txt v="small" style={{ flex: 1, color: t.c.ink }}>{i.message}</Txt>
              </Row>
            ))}
            <Btn icon="share" title="Отправить ошибки нейросети" onPress={() => Share.share({ message: issuesText })} />
          </>
        )}
      </Sheet>

      <Sheet open={helpOpen} onClose={() => setHelpOpen(false)} title="Программа с помощью нейросети">
        <Step n={1} text="Нажми «Отправить инструкцию» и перешли файл в ChatGPT, Claude или DeepSeek." />
        <Step n={2} text="Напиши о себе: возраст, рост, вес, опыт, цель, сколько дней в неделю, оборудование, травмы. Готовый шаблон запроса есть в начале файла." />
        <Step n={3} text="Сохрани ответ нейросети в файл .yaml (или попроси её прислать файлом)." />
        <Step n={4} text="Нажми «Из файла» и выбери его. Если что-то не так, приложение покажет ошибки по строкам, их можно отправить нейросети обратно." />
        <Btn icon="share" title="Отправить инструкцию" onPress={() => shareAiKit().catch((e) => toast(e.message))} />
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          <Chip small label="Фулбади" />
          <Chip small label="Верх/низ" />
          <Chip small label="Тяни-толкай-ноги" />
          <Chip small label="Сплит" />
        </Row>
        <Txt v="small">Примеры всех этих сплитов уже лежат в «Другие программы», их можно взять за основу.</Txt>
      </Sheet>

      <Sheet open={confirmDel !== null} onClose={() => setConfirmDel(null)} title="Удалить программу?">
        <Txt v="small">История тренировок останется, удалится только сама программа.</Txt>
        <Btn kind="danger" icon="trash" title="Удалить" onPress={() => { if (confirmDel) deleteProgram(confirmDel); setConfirmDel(null); }} />
      </Sheet>
    </Screen>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  const t = useTheme();
  return (
    <Row gap={12} style={{ alignItems: 'flex-start' }}>
      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: t.c.accent, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: t.f.bold, color: t.c.onAccent, fontSize: 13 }}>{n}</Text>
      </View>
      <Txt style={{ flex: 1 }}>{text}</Txt>
    </Row>
  );
}
