import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useData } from '../../features/app-data/AppDataProvider';
import { useTask } from '../../shared/hooks/useTask';
import { AppText } from '../../shared/ui/AppText';
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { ErrorMessage } from '../../shared/ui/ErrorMessage';
import { Icon } from '../../shared/ui/Icon';
import { PhotoImage } from '../../shared/ui/PhotoImage';
import { Screen } from '../../shared/ui/Screen';

export function LoginScreen() {
  const { data, actions } = useData();
  const task = useTask();
  return (
    <SafeAreaView className="flex-1 bg-background">
      <Screen contentContainerClassName="gap-6 px-4 pt-3">
        <View className="flex-row items-center gap-2">
          <Icon name="postage-stamp" tone="primary" size={28} />
          <AppText variant="label" className="tracking-[1px]">
            STAMP RALLY
          </AppText>
        </View>
        <View>
          <PhotoImage
            url={data.trips[0]?.coverImageUrl ?? null}
            label="旅先の風景"
            className="h-64 rounded-3xl"
          />
          <View className="absolute bottom-4 left-4">
            <Badge
              label="思い出を、みんなで。"
              icon="camera-outline"
              kind="neutral"
            />
          </View>
        </View>
        <View className="gap-3">
          <AppText variant="hero" accessibilityRole="header">
            旅のかけらを、{'\n'}集めよう。
          </AppText>
          <AppText tone="textSecondary">
            寄り道も、おいしい一杯も。{'\n'}仲間と残す、あなただけの旅の記録。
          </AppText>
        </View>
        <View className="gap-3">
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
            className="text-center mt-2"
          >
            サンプルアカウントで体験できます。{'\n'}
            実際のアカウントへの接続は行いません。
          </AppText>
        </View>
      </Screen>
    </SafeAreaView>
  );
}
