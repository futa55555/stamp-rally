import { View } from 'react-native';
import { AppText } from '../../../shared/ui/AppText';
export function TripHero() {
  return (
    <View className="gap-2 px-4">
      <AppText variant="eyebrow" tone="primary">
        YOUR TRAVEL JOURNAL
      </AppText>
      <AppText variant="hero" accessibilityRole="header">
        次の思い出を、{'\n'}ここに。
      </AppText>
      <AppText tone="textSecondary">
        いつもの仲間と、まだ知らない景色へ。
      </AppText>
    </View>
  );
}
