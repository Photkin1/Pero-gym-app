import { Platform } from 'react-native';
import { requestWidgetUpdate, type WidgetTaskHandlerProps } from 'react-native-android-widget';
import { StreakWidget } from './StreakWidget';
import { widgetData } from './data';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  if (props.widgetAction === 'WIDGET_DELETED') return;
  props.renderWidget(<StreakWidget {...widgetData()} />);
}

/** Обновить виджет после тренировки */
export function refreshWidget() {
  if (Platform.OS !== 'android') return;
  requestWidgetUpdate({ widgetName: 'Streak', renderWidget: () => <StreakWidget {...widgetData()} /> }).catch(() => {});
}
