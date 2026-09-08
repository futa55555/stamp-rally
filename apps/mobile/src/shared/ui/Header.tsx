import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { IconButton } from './IconButton';

export function Header({
  title,
  onBack,
  action,
  backDisabled,
}: {
  title: string;
  onBack?: () => void;
  action?: ReactNode;
  backDisabled?: boolean;
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
          <IconButton
            icon="arrow-left"
            label="戻る"
            onPress={onBack}
            disabled={backDisabled}
          />
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
        {action}
      </View>
    </SafeAreaView>
  );
}
