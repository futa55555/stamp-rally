import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { ScrollView } from 'react-native';
import { useAppTheme } from '../theme/ThemeProvider';

export function Screen({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const theme = useAppTheme();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={[
        {
          padding: theme.spacing.lg,
          paddingBottom: theme.spacing.xxl,
          gap: theme.spacing.lg,
          width: '100%',
          maxWidth: theme.layout.pageMaxWidth,
          alignSelf: 'center',
          flexGrow: 1,
        },
        style,
      ]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}
