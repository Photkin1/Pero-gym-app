import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { THEMES, type Theme, type ThemeChoice } from './themes';
import { getSetting, setSetting } from '../db/repo';
import { useLive } from '../db/hooks';

const Ctx = createContext<Theme>(THEMES.graphite);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const choice = useLive(() => getSetting<ThemeChoice>('theme', 'system'));
  const theme = useMemo(() => {
    if (choice === 'system') return scheme === 'light' ? THEMES.chalk : THEMES.graphite;
    return THEMES[choice] ?? THEMES.graphite;
  }, [choice, scheme]);
  return <Ctx.Provider value={theme}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
export const useThemeChoice = () => useLive(() => getSetting<ThemeChoice>('theme', 'system'));
export const setThemeChoice = (c: ThemeChoice) => setSetting('theme', c);
export { THEMES };
export type { Theme };
