import { View } from 'react-native';
import { useAppTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';

export function ErrorMessage({ message }: { message: string | null }) {
  const theme = useAppTheme();
  return message ? (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        backgroundColor: theme.colors.errorBackground,
        padding: theme.spacing.sm,
        borderRadius: theme.radius.sm,
      }}
    >
      <AppText variant="caption" tone="error">
        {message}
      </AppText>
    </View>
  ) : null;
}
