import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useData } from '../../features/app-data/AppDataProvider';
import { useTask } from '../../shared/hooks/useTask';
import { useAppTheme } from '../../shared/theme/ThemeProvider';
import { AppText } from '../../shared/ui/AppText';
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { ErrorMessage } from '../../shared/ui/ErrorMessage';
import { Icon } from '../../shared/ui/Icon';
import { PhotoImage } from '../../shared/ui/PhotoImage';
import { Screen } from '../../shared/ui/Screen';

export function LoginScreen() {
  const theme = useAppTheme();
  const { data, actions } = useData();
  const task = useTask();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Screen style={{ gap: theme.spacing.lg, paddingTop: theme.spacing.sm }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.xs,
          }}
        >
          <Icon name="postage-stamp" tone="primary" size={28} />
          <AppText variant="label" style={{ letterSpacing: 1 }}>
            STAMP RALLY
          </AppText>
        </View>
        <View>
          <PhotoImage
            url={data.trips[0]?.coverImageUrl ?? null}
            label="旅先の風景"
            style={{ height: 256, borderRadius: theme.radius.lg }}
          />
          <View
            style={{
              position: 'absolute',
              bottom: theme.spacing.md,
              left: theme.spacing.md,
            }}
          >
            <Badge
              label="思い出を、みんなで。"
              icon="camera-outline"
              kind="neutral"
            />
          </View>
        </View>
        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="hero" accessibilityRole="header">
            旅のかけらを、{'\n'}集めよう。
          </AppText>
          <AppText tone="textSecondary">
            寄り道も、おいしい一杯も。{'\n'}仲間と残す、あなただけの旅の記録。
          </AppText>
        </View>
        <View style={{ gap: theme.spacing.sm }}>
          <Button
            label="Google で続ける"
            icon="google"
            pending={task.pending}
            onPress={() => {
              void task.run(() => actions.signIn('google'));
            }}
          />
          <Button
            label="Apple で続ける"
            icon="apple"
            variant="secondary"
            disabled={task.pending}
            onPress={() => {
              void task.run(() => actions.signIn('apple'));
            }}
          />
          <ErrorMessage message={task.error} />
          <AppText
            variant="caption"
            tone="textMuted"
            style={{ textAlign: 'center', marginTop: theme.spacing.xs }}
          >
            サンプルアカウントで体験できます。{'\n'}
            実際のアカウントへの接続は行いません。
          </AppText>
        </View>
      </Screen>
    </SafeAreaView>
  );
}
