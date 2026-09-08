import type { PropsWithChildren } from 'react';
import { ScrollView } from 'react-native';

export function Screen({
  children,
  contentContainerClassName = '',
}: PropsWithChildren<{ contentContainerClassName?: string }>) {
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName={[
        'w-full grow gap-6 pb-12',
        contentContainerClassName,
      ].join(' ')}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}
