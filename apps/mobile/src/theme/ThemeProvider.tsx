import { createContext, useContext, type PropsWithChildren } from 'react';
import { DefaultTheme, type Theme } from 'expo-router';
import { lightTheme, type AppTheme } from './tokens';

const ThemeContext = createContext<AppTheme>(lightTheme);

export function ThemeProvider({
  children,
  theme = lightTheme,
}: PropsWithChildren<{ theme?: AppTheme }>) {
  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}

export const useAppTheme = () => useContext(ThemeContext);

export function navigationTheme(theme: AppTheme): Theme {
  return {
    ...DefaultTheme,
    dark: theme.dark,
    colors: {
      primary: theme.colors.primary,
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.text,
      border: theme.colors.border,
      notification: theme.colors.unread,
    },
  };
}
