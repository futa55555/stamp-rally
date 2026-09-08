import { View } from 'react-native';
import { AppText } from './AppText';
import type { IconName } from './Icon';
import { Icon } from './Icon';

export function Badge({
  label,
  icon,
  kind = 'active',
}: {
  label: string;
  icon?: IconName;
  kind?: 'active' | 'neutral' | 'favorite';
}) {
  const tone =
    kind === 'active'
      ? 'active'
      : kind === 'favorite'
        ? 'favorite'
        : 'textSecondary';
  return (
    <View
      className={[
        'flex-row items-center gap-1 px-3 py-1 rounded-full self-start',
        kind === 'favorite'
          ? 'bg-favoriteBackground'
          : kind === 'active'
            ? 'bg-activeBackground'
            : 'bg-background',
      ].join(' ')}
    >
      {icon ? <Icon name={icon} size={14} tone={tone} /> : null}
      <AppText variant="caption" tone={tone} className="font-semibold">
        {label}
      </AppText>
    </View>
  );
}
