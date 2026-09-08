import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';
import { AppText } from '../../../shared/ui/AppText';
import { Button } from '../../../shared/ui/Button';
import { SectionHeading } from '../../../shared/ui/SectionHeading';

export function TripListHeader({ tripCount }: { tripCount: number }) {
  const theme = useAppTheme();
  const router = useRouter();
  return (
    <View style={{ gap: theme.spacing.xs, marginBottom: theme.spacing.xs }}>
      <AppText variant="eyebrow" tone="primary">
        YOUR TRAVEL JOURNAL
      </AppText>
      <AppText variant="hero" accessibilityRole="header">
        次の思い出を、{'\n'}ここに。
      </AppText>
      <AppText tone="textSecondary">
        いつもの仲間と、まだ知らない景色へ。
      </AppText>
      <View style={{ marginTop: theme.spacing.lg, gap: theme.spacing.sm }}>
        <SectionHeading title="あなたの旅行" count={tripCount} />
        <Button
          label="旅行を作成"
          icon="plus"
          onPress={() => router.push('/editor/trip')}
        />
      </View>
    </View>
  );
}
