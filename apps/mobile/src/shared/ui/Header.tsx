import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { IconButton } from './IconButton';

// The same growing text row and 48pt actions keep every header the same height,
// including with larger system text. Only this frame owns the top safe inset.
function HeaderFrame({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="bg-background">
      <View className="flex-row items-center gap-2 border-b border-border px-4 py-2">
        {children}
      </View>
    </SafeAreaView>
  );
}
function HeaderTitle({
  title,
  centered = false,
}: {
  title: string;
  centered?: boolean;
}) {
  return (
    <AppText
      variant="heading"
      numberOfLines={1}
      ellipsizeMode="tail"
      accessibilityRole="header"
      accessibilityLabel={title}
      className={['min-w-0 flex-1', centered ? 'text-center' : ''].join(' ')}
    >
      {title}
    </AppText>
  );
}
export function TopHeader({ onPost }: { onPost: () => void }) {
  return (
    <HeaderFrame>
      <View className="shrink-0">
        <Icon name="postage-stamp" tone="primary" size={26} />
      </View>
      <HeaderTitle title="Stamp Rally" />
      <IconButton
        icon="camera-plus-outline"
        label="投稿を作成"
        align="end"
        onPress={onPost}
      />
    </HeaderFrame>
  );
}
export function PageHeader({
  title,
  onBack,
  onPost,
  backLabel = title + 'へ戻る',
}: {
  title: string;
  onBack: () => void;
  onPost?: () => void;
  backLabel?: string;
}) {
  return (
    <HeaderFrame>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        onPress={onBack}
        className="min-h-12 min-w-0 flex-1 flex-row items-center gap-2 active:opacity-pressed"
      >
        <Icon name="arrow-left" tone="text" />
        <HeaderTitle title={title} />
      </Pressable>
      {onPost ? (
        <IconButton
          icon="camera-plus-outline"
          label="投稿を作成"
          align="end"
          onPress={onPost}
        />
      ) : (
        <View className="w-12" />
      )}
    </HeaderFrame>
  );
}
export function FormHeader({
  title,
  onClose,
  disabled = false,
}: {
  title: string;
  onClose: () => void;
  disabled?: boolean;
}) {
  return (
    <HeaderFrame>
      <IconButton
        icon="close"
        label="閉じる"
        align="start"
        onPress={onClose}
        disabled={disabled}
      />
      <HeaderTitle title={title} centered />
      <View className="w-12" />
    </HeaderFrame>
  );
}
