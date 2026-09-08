import { View } from 'react-native';
import { useAppTheme } from '../theme/ThemeProvider';

export function UnreadBadge({
  label = '未読の写真があります',
}: {
  label?: string;
}) {
  const theme = useAppTheme();
  return (
    <View
      accessibilityLabel={label}
      style={{
        width: 8,
        height: 8,
        borderRadius: theme.radius.pill,
        backgroundColor: theme.colors.unread,
      }}
    />
  );
}
