// Три темы оформления. Все цвета и шрифты приложения берутся только отсюда.
// Импорт по одному начертанию, чтобы в сборку не попали лишние шрифты
import { Manrope_400Regular } from '@expo-google-fonts/manrope/400Regular';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { Manrope_800ExtraBold } from '@expo-google-fonts/manrope/800ExtraBold';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import { Unbounded_600SemiBold } from '@expo-google-fonts/unbounded/600SemiBold';
import { Unbounded_700Bold } from '@expo-google-fonts/unbounded/700Bold';
import { Onest_400Regular } from '@expo-google-fonts/onest/400Regular';
import { Onest_500Medium } from '@expo-google-fonts/onest/500Medium';
import { Onest_600SemiBold } from '@expo-google-fonts/onest/600SemiBold';
import { Onest_700Bold } from '@expo-google-fonts/onest/700Bold';

export const FONTS = {
  Manrope_400Regular, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold,
  Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold,
  Unbounded_600SemiBold, Unbounded_700Bold,
  Onest_400Regular, Onest_500Medium, Onest_600SemiBold, Onest_700Bold,
};

export type ThemeId = 'graphite' | 'chalk' | 'energy';
export type ThemeChoice = ThemeId | 'system';

export type Theme = {
  id: ThemeId;
  name: string;
  dark: boolean;
  c: {
    bg: string; card: string; raised: string; ink: string; muted: string; faint: string;
    accent: string; accentText: string; onAccent: string;
    chip: string; input: string; line: string; done: string; warm: string; good: string; bad: string;
    nav: string; header: string; onHeader: string; onHeaderMuted: string; scrim: string;
  };
  f: { display: string; displayBold: string; body: string; medium: string; semibold: string; bold: string; num: string };
  r: { lg: number; md: number; sm: number };
  border: number;
  shadow: boolean;
};

export const THEMES: Record<ThemeId, Theme> = {
  graphite: {
    id: 'graphite',
    name: 'Графит',
    dark: true,
    c: {
      bg: '#121316', card: '#1b1d22', raised: '#23262d', ink: '#f1f2f4', muted: '#8d93a0', faint: '#5b606b',
      accent: '#ff6b4a', accentText: '#ff8a6e', onAccent: '#1a0d08',
      chip: '#262931', input: '#2c3039', line: '#262931', done: 'rgba(255,107,74,0.09)', warm: '#e8b04b', good: '#5fd39a', bad: '#ff5d6c',
      nav: '#16171b', header: '#121316', onHeader: '#f1f2f4', onHeaderMuted: '#8d93a0', scrim: 'rgba(0,0,0,0.6)',
    },
    f: { display: 'Manrope_800ExtraBold', displayBold: 'Manrope_700Bold', body: 'Manrope_400Regular', medium: 'Manrope_600SemiBold', semibold: 'Manrope_600SemiBold', bold: 'Manrope_700Bold', num: 'Manrope_800ExtraBold' },
    r: { lg: 18, md: 12, sm: 9 },
    border: 0,
    shadow: false,
  },
  chalk: {
    id: 'chalk',
    name: 'Мел',
    dark: false,
    c: {
      bg: '#f6f7f9', card: '#ffffff', raised: '#ffffff', ink: '#101114', muted: '#6b707b', faint: '#a4a8b1',
      accent: '#2f5bff', accentText: '#2f5bff', onAccent: '#ffffff',
      chip: '#eef0f4', input: '#f0f2f6', line: '#eaecf0', done: '#f1f5ff', warm: '#b86e00', good: '#13955a', bad: '#e5383b',
      nav: '#ffffff', header: '#f6f7f9', onHeader: '#101114', onHeaderMuted: '#6b707b', scrim: 'rgba(16,17,20,0.35)',
    },
    f: { display: 'Inter_800ExtraBold', displayBold: 'Inter_700Bold', body: 'Inter_400Regular', medium: 'Inter_500Medium', semibold: 'Inter_600SemiBold', bold: 'Inter_700Bold', num: 'Inter_700Bold' },
    r: { lg: 14, md: 10, sm: 8 },
    border: 1,
    shadow: false,
  },
  energy: {
    id: 'energy',
    name: 'Энергия',
    dark: false,
    c: {
      bg: '#eef0ff', card: '#ffffff', raised: '#ffffff', ink: '#14163a', muted: '#6a6e95', faint: '#a9acc9',
      accent: '#ff5a1f', accentText: '#ff5a1f', onAccent: '#ffffff',
      chip: '#eceefe', input: '#eceefe', line: '#e6e8fb', done: '#fff1ea', warm: '#7b61ff', good: '#14a06a', bad: '#e5383b',
      nav: '#ffffff', header: '#1f3cff', onHeader: '#ffffff', onHeaderMuted: '#c9d0ff', scrim: 'rgba(20,22,58,0.45)',
    },
    f: { display: 'Unbounded_700Bold', displayBold: 'Unbounded_600SemiBold', body: 'Onest_400Regular', medium: 'Onest_500Medium', semibold: 'Onest_600SemiBold', bold: 'Onest_700Bold', num: 'Unbounded_700Bold' },
    r: { lg: 22, md: 14, sm: 12 },
    border: 0,
    shadow: true,
  },
};
