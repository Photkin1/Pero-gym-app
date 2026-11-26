import { useState } from 'react';
import { Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useTheme, useThemeChoice, setThemeChoice, THEMES } from '../theme';
import type { ThemeChoice, ThemeId } from '../theme/themes';
import { useLive } from '../db/hooks';
import { getSetting, setSetting } from '../db/repo';
import { exportExcel, importBackup, shareAiKit, shareBackup } from '../features/files';
import { startRest, stopRest } from '../features/timer';
import { num } from '../core/units';
import { Btn, Card, Chip, Press, Row, Screen, SectionTitle, Sheet, Txt, toast } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { RirExplainer } from '../ui/workout';

export default function Settings() {
  const t = useTheme();
  const choice = useThemeChoice();
  const step = useLive(() => getSetting('weightStep', 0.5));
  const [restoreOpen, setRestoreOpen] = useState(false);
  const run = (f: () => Promise<unknown>) => f().catch((e) => toast((e as Error).message, 'info'));

  const options: { id: ThemeChoice; name: string; note: string }[] = [
    { id: 'system', name: 'Как в системе', note: 'Днём Мел, ночью Графит' },
    { id: 'graphite', name: 'Графит', note: 'Тёмная' },
    { id: 'chalk', name: 'Мел', note: 'Светлая' },
    { id: 'energy', name: 'Энергия', note: 'Яркая' },
  ];

  return (
    <Screen back title="Настройки">
      <SectionTitle>Оформление</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {options.map((o) => {
          const on = choice === o.id;
          const preview = o.id === 'system' ? null : THEMES[o.id as ThemeId];
          return (
            <Press key={o.id} onPress={() => setThemeChoice(o.id)} style={{ width: '47%', flexGrow: 1 }}>
              <View style={{ borderRadius: t.r.lg, borderWidth: 2, borderColor: on ? t.c.accent : t.c.line, overflow: 'hidden', backgroundColor: t.c.card }}>
                <View style={{ height: 76, flexDirection: 'row' }}>
                  {preview ? (
                    <View style={{ flex: 1, backgroundColor: preview.c.bg, padding: 10, gap: 6 }}>
                      <View style={{ height: 12, width: '60%', borderRadius: 4, backgroundColor: preview.c.ink }} />
                      <View style={{ flex: 1, borderRadius: 8, backgroundColor: preview.c.card, borderWidth: preview.border, borderColor: preview.c.line, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 6 }}>
                        <View style={{ height: 6, flex: 1, borderRadius: 3, backgroundColor: preview.c.chip }} />
                        <View style={{ height: 18, width: 18, borderRadius: 5, backgroundColor: preview.c.accent }} />
                      </View>
                    </View>
                  ) : (
                    <>
                      <View style={{ flex: 1, backgroundColor: THEMES.chalk.c.bg }} />
                      <View style={{ flex: 1, backgroundColor: THEMES.graphite.c.bg }} />
                    </>
                  )}
                </View>
                <Row style={{ padding: 10 }} gap={6}>
                  <View style={{ flex: 1 }}>
                    <Txt v="medium">{o.name}</Txt>
                    <Txt v="small">{o.note}</Txt>
                  </View>
                  {on && <Icon name="check" size={18} color={t.c.accentText} strokeWidth={2.6} />}
                </Row>
              </View>
            </Press>
          );
        })}
      </View>

      <SectionTitle>Тренировка</SectionTitle>
      <Card style={{ gap: 10 }}>
        <Txt v="label">Шаг кнопок веса (± при вводе)</Txt>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {[0.5, 1, 1.25, 2.5].map((s) => <Chip key={s} label={`${num(s, 2)} кг`} on={step === s} onPress={() => setSetting('weightStep', s)} />)}
        </View>
        <Txt v="small">Вторая кнопка всегда равна шагу прибавки упражнения (штанга 2,5, гантели 2, тренажёр 5). Его можно поменять на странице упражнения.</Txt>
        <Btn kind="secondary" small icon="timer" title="Проверить сигнал таймера (5 с)" onPress={async () => { await startRest(-1, 5, 'проверка'); setTimeout(() => stopRest(), 9000); }} />
      </Card>

      <SectionTitle>Данные</SectionTitle>
      <Card style={{ gap: 10 }}>
        <Txt v="small">Всё хранится только на этом телефоне. Делай бэкап раз в пару недель и кидай его себе в Telegram или на Google Диск.</Txt>
        <Btn kind="secondary" icon="file" title="Выгрузить в Excel" onPress={() => run(exportExcel)} />
        <Btn kind="secondary" icon="share" title="Сохранить бэкап" onPress={() => run(shareBackup)} />
        <Btn kind="secondary" icon="import" title="Восстановить из бэкапа" onPress={() => setRestoreOpen(true)} />
        <Btn kind="secondary" icon="link" title="Инструкция для нейросети" onPress={() => run(shareAiKit)} />
      </Card>

      <SectionTitle>Что такое RIR</SectionTitle>
      <Card>
        <RirExplainer />
      </Card>

      <SectionTitle>О приложении</SectionTitle>
      <Card style={{ gap: 6 }}>
        <Txt v="medium">Pero {Constants.expoConfig?.version ?? ''}</Txt>
        <Txt v="small">Дневник тренировок с двойной прогрессией, расчётом 1ПМ по формуле Эпли и объёмом по мышцам. Рекомендации основаны на исследованиях, ссылки есть в подсказках и в инструкции к формату программ.</Txt>
        <Text style={{ fontFamily: t.f.body, fontSize: 12, color: t.c.faint, marginTop: 6 }}>Тяжело в зале, легко в записи.</Text>
      </Card>

      <Sheet open={restoreOpen} onClose={() => setRestoreOpen(false)} title="Восстановить из бэкапа?">
        <Txt v="small">Все текущие данные на телефоне заменятся данными из файла. Если сомневаешься, сначала сохрани текущий бэкап.</Txt>
        <Btn kind="danger" icon="import" title="Выбрать файл и заменить" onPress={() => { setRestoreOpen(false); run(async () => { if (await importBackup()) toast('Данные восстановлены', 'check'); }); }} />
      </Sheet>
    </Screen>
  );
}
