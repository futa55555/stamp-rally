import { View } from 'react-native';
import { AppText } from './AppText';

export function ErrorMessage({ message }: { message: string | null }) {
  return message ? (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      className="bg-errorBackground p-3 rounded-lg"
    >
      <AppText variant="caption" tone="error">
        {message}
      </AppText>
    </View>
  ) : null;
}
