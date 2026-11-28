// Таймер отдыха в шторке и на экране блокировки (только Android). На остальных платформах ничего не делает.
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

type Native = { show(endsAt: number, title: string, body: string, overtime: boolean): void; hide(): void };
const M = Platform.OS === 'android' ? requireOptionalNativeModule<Native>('RestTimer') : null;

export function showRestNotification(endsAt: number, title: string, body: string, overtime: boolean) {
  try {
    M?.show(endsAt, title, body, overtime);
  } catch {}
}
export function hideRestNotification() {
  try {
    M?.hide();
  } catch {}
}
