// Виджет рабочего стола Android: огонёк серии, неделя и следующая тренировка.
import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';

export type WidgetData = { weeks: number; thisWeek: number; goal: number; next: string | null; done: boolean[] };

const BG = '#121316';
const INK = '#f1f2f4';
const MUTED = '#8d93a0';
const ACC = '#ff6b4a';
const CHIP = '#262931';
const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const flame = (lit: boolean) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${lit ? '#ffcc00' : '#5b606b'}"/><stop offset="1" stop-color="${lit ? ACC : CHIP}"/></linearGradient></defs><path d="M24 45c9 0 15-6 15-14 0-9-8-13-9-22-6 3-9 9-8 15-3-1-5-4-5-7-4 4-8 9-8 14 0 8 6 14 15 14z" fill="url(#g)"/></svg>`;

export function StreakWidget({ weeks, thisWeek, goal, next, done }: WidgetData) {
  const lit = weeks > 0 || thisWeek > 0;
  return (
    <FlexWidget clickAction="OPEN_APP" style={{ height: 'match_parent', width: 'match_parent', backgroundColor: BG, borderRadius: 24, padding: 14, flexDirection: 'column', justifyContent: 'space-between' }}>
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent' }}>
        <SvgWidget svg={flame(lit)} style={{ width: 40, height: 40 }} />
        <FlexWidget style={{ flexDirection: 'column', marginLeft: 10 }}>
          <TextWidget text={`${weeks} нед. подряд`} style={{ fontSize: 18, color: INK, fontWeight: '800' }} />
          <TextWidget text={`${thisWeek} из ${goal} на этой неделе`} style={{ fontSize: 12, color: MUTED }} />
        </FlexWidget>
      </FlexWidget>
      <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', justifyContent: 'space-between', marginTop: 10 }}>
        {DAYS.map((d, i) => (
          <FlexWidget key={d} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: done[i] ? ACC : CHIP, alignItems: 'center', justifyContent: 'center' }}>
            <TextWidget text={d} style={{ fontSize: 10, color: done[i] ? '#1a0d08' : MUTED, fontWeight: '700' }} />
          </FlexWidget>
        ))}
      </FlexWidget>
      <TextWidget text={next ? `Дальше: ${next}` : 'Открыть Pero'} style={{ fontSize: 12.5, color: INK, marginTop: 10 }} maxLines={1} truncate="END" />
    </FlexWidget>
  );
}
