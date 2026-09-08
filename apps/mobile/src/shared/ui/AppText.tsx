import type { TextProps } from 'react-native';
import { Text } from 'react-native';
import { useAppTheme } from '../theme/ThemeProvider';
import type { AppTheme, ColorToken } from '../theme/tokens';

export function AppText({
  variant = 'body',
  tone = 'text',
  style,
  ...props
}: TextProps & { variant?: keyof AppTheme['typography']; tone?: ColorToken }) {
  const theme = useAppTheme();
  return (
    <Text
      {...props}
      style={[theme.typography[variant], { color: theme.colors[tone] }, style]}
    />
  );
}
