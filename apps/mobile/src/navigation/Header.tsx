import { View } from 'react-native';
import type { NativeStackNavigationOptions } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/ThemeProvider';
import { AppText, Icon, IconButton } from '../components/ui';

export function Header({
  title,
  onBack,
}: {
  title: string;
  onBack?: () => void;
}) {
  const theme = useAppTheme();
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={{ backgroundColor: theme.colors.background }}
    >
      <View
        style={{
          minHeight: 56,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: theme.spacing.sm,
          gap: theme.spacing.xxs,
        }}
      >
        {onBack ? (
          <IconButton icon="arrow-left" label="戻る" onPress={onBack} />
        ) : (
          <View
            style={{ width: theme.layout.touchTarget, alignItems: 'center' }}
          >
            <Icon name="postage-stamp" tone="primary" size={26} />
          </View>
        )}
        <AppText
          variant="label"
          numberOfLines={1}
          accessibilityRole="header"
          style={{ flex: 1 }}
        >
          {title}
        </AppText>
      </View>
    </SafeAreaView>
  );
}

export function useStackScreenOptions(): NativeStackNavigationOptions {
  const theme = useAppTheme();
  return {
    contentStyle: { backgroundColor: theme.colors.background },
    header: ({ options, navigation, back }) => (
      <Header
        title={options.title ?? 'Stamp Rally'}
        onBack={back ? () => navigation.goBack() : undefined}
      />
    ),
  };
}
