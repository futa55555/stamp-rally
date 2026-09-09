import type { PropsWithChildren } from 'react';
import { ScrollView, RefreshControl } from 'react-native';

export function Screen({
  children,
  contentContainerClassName = '',
  refreshing = false,
  onRefresh,
}: PropsWithChildren<{
  contentContainerClassName?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
}>) {
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName={[
        'w-full grow gap-6 pb-12',
        contentContainerClassName,
      ].join(' ')}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}
