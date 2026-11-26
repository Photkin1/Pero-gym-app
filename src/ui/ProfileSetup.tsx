// Знакомство: пол и рост, затем стартовые вес и замеры. Оба шага можно пропустить.
// Показывается один раз после заставки; из настроек открывается снова.
import { useState } from 'react';
import { Keyboard, KeyboardAvoidingView, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { num } from '../core/units';
import { getSetting, listBody, setSetting, upsertBody, type BodyMetric } from '../db/repo';
import { dayKey } from './charts';
import { BodyMap, type Sex } from './BodyMap';
import { FIELDS, HOWTO, Stepper, draftToPatch, type Draft } from './BodySection';
import { Btn, Press, Row, Txt, success, toast } from './kit';

const EMPTY = new Map();

export const profileDone = () => getSetting('profile.done', false);

export function ProfileSetup({ onDone }: { onDone: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [sex, setSex] = useState<Sex | null>(() => getSetting<Sex | null>('profile.sex', null));
  const [height, setHeight] = useState(() => {
    const h = getSetting<number | null>('profile.height', null);
    return h ? String(h) : '';
  });
  const [draft, setDraft] = useState<Draft>(() => {
    const body = listBody();
    const lastOf = (k: keyof BodyMetric) => {
      for (let i = body.length - 1; i >= 0; i--) if (body[i][k] != null) return body[i][k] as number;
      return null;
    };
    const d = {} as Draft;
    for (const f of FIELDS) {
      const v = lastOf(f.k);
      d[f.k] = v == null ? '' : num(v);
    }
    return d;
  });

  const finish = () => {
    setSetting('profile.done', true);
    onDone();
  };
  const saveFirst = () => {
    Keyboard.dismiss();
    if (sex) setSetting('profile.sex', sex);
    const h = Number(height.replace(',', '.'));
    if (height && (!h || h < 120 || h > 230)) return toast('Рост в сантиметрах, например 180', 'info');
    if (h) setSetting('profile.height', Math.round(h));
    setStep(1);
  };
  const saveSecond = () => {
    Keyboard.dismiss();
    const patch = draftToPatch(draft);
    if (typeof patch === 'string') return toast(patch, 'info');
    if (Object.keys(patch).length) {
      upsertBody(dayKey(Date.now()), patch);
      success();
    }
    finish();
  };

  return (
    <Animated.View entering={FadeIn.duration(300)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.c.bg, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 14 }}>
      <Row style={{ paddingHorizontal: 18, minHeight: 40 }}>
        <Row gap={6} style={{ flex: 1 }}>
          {[0, 1].map((i) => (
            <View key={i} style={{ width: i === step ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i <= step ? t.c.accent : t.c.chip }} />
          ))}
        </Row>
        <Press onPress={finish} hitSlop={10}>
          <Text style={{ fontFamily: t.f.semibold, fontSize: 15, color: t.c.muted }}>Позже</Text>
        </Press>
      </Row>

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14, flexGrow: 1 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets showsVerticalScrollIndicator={false}>
        {step === 0 ? (
          <Animated.View key="s0" entering={FadeInRight.duration(280)} exiting={FadeOutLeft.duration(180)} style={{ gap: 14 }}>
            <Txt v="title">Немного о тебе</Txt>
            <Txt v="body" color={t.c.muted}>Пол нужен, чтобы нарисовать правильную фигуру на карте мышц. Рост пригодится в статистике. Это можно поменять в настройках.</Txt>
            <Row gap={10}>
              {(['m', 'f'] as Sex[]).map((s) => {
                const on = sex === s;
                return (
                  <Press key={s} onPress={() => setSex(s)} style={{ flex: 1 }}>
                    <View style={{ backgroundColor: t.c.card, borderRadius: t.r.lg, borderWidth: 2, borderColor: on ? t.c.accent : t.c.line, paddingVertical: 12, alignItems: 'center', gap: 6 }}>
                      <View pointerEvents="none" style={{ height: 150, width: '100%', overflow: 'hidden' }}>
                        <BodyMap load={EMPTY} sex={s} height={150} interactive={false} />
                      </View>
                      <Text style={{ fontFamily: t.f.bold, fontSize: 15, color: on ? t.c.accentText : t.c.ink }}>{s === 'm' ? 'Мужской' : 'Женский'}</Text>
                    </View>
                  </Press>
                );
              })}
            </Row>
            <View style={{ backgroundColor: t.c.card, borderRadius: t.r.md, padding: 14, borderWidth: t.border, borderColor: t.c.line }}>
              <Stepper label="Рост" unit="см" value={height} onChange={setHeight} step={1} bold />
            </View>
          </Animated.View>
        ) : (
          <Animated.View key="s1" entering={FadeInRight.duration(280)} style={{ gap: 14 }}>
            <Txt v="title">Стартовые замеры</Txt>
            <Txt v="body" color={t.c.muted}>С них начнутся графики в «Прогресс → Тело». Заполни что знаешь, остальное можно добавить потом. Нажми ⓘ, чтобы узнать, как мерить.</Txt>
            <View style={{ backgroundColor: t.c.card, borderRadius: t.r.md, padding: 14, gap: 12, borderWidth: t.border, borderColor: t.c.line }}>
              {FIELDS.map((f) => (
                <Stepper key={f.k} label={f.label} unit={f.unit} value={draft[f.k]} onChange={(v) => setDraft({ ...draft, [f.k]: v })} step={f.step} bold={f.k === 'weight'} hint={HOWTO[f.k]} />
              ))}
            </View>
          </Animated.View>
        )}
        <View style={{ gap: 8, marginTop: 'auto', paddingTop: 8 }}>
          {step === 0 ? (
            <Btn title="Дальше" onPress={saveFirst} full />
          ) : (
            <Row gap={10}>
              <Btn kind="secondary" title="Назад" onPress={() => setStep(0)} />
              <Btn title="Готово" onPress={saveSecond} style={{ flex: 1 }} />
            </Row>
          )}
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

    </Animated.View>
  );
}
