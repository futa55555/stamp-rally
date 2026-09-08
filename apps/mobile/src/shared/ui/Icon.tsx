import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import { useAppTheme } from '../theme/ThemeProvider';
import type { ColorToken } from '../theme/tokens';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export function Icon({
  name,
  size = 24,
  tone = 'textSecondary',
}: {
  name: IconName;
  size?: number;
  tone?: ColorToken;
}) {
  const theme = useAppTheme();
  return (
    <MaterialCommunityIcons
      name={name}
      size={size}
      color={theme.colors[tone]}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
