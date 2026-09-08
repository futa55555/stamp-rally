import { View } from 'react-native';

export function UnreadBadge({
  label = '未読の写真があります',
}: {
  label?: string;
}) {
  return (
    <View
      accessibilityLabel={label}
      className="w-2 h-2 rounded-full bg-unread"
    />
  );
}
