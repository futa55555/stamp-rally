import { useHeaderHeight } from 'expo-router/react-navigation';
import { useState } from 'react';
import { FlatList, Platform, type FlatListProps } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

type ListScreenProps<Item> = Pick<
  FlatListProps<Item>,
  | 'data'
  | 'renderItem'
  | 'keyExtractor'
  | 'ListEmptyComponent'
  | 'ListHeaderComponent'
  | 'ListFooterComponent'
  | 'refreshing'
  | 'onRefresh'
>;

export function ListScreen<Item>(props: ListScreenProps<Item>) {
  const [height, setHeight] = useState(0);
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const empty = !props.data?.length;
  // On iOS the transparent header and native tab bar inset the scroll view,
  // but flexGrow would still fill its entire frame and add those insets again.
  const visibleHeight = Math.max(
    0,
    height - (Platform.OS === 'ios' ? headerHeight + insets.bottom : 0),
  );

  return (
    <SafeAreaView edges={['left', 'right']} className="flex-1 bg-background">
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        {...props}
        className="flex-1"
        onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
        contentContainerStyle={empty ? { minHeight: visibleHeight } : undefined}
        contentContainerClassName={[
          'w-full max-w-page self-center px-4 pt-6 pb-12 gap-4',
          empty ? 'justify-center' : '',
        ].join(' ')}
        keyboardShouldPersistTaps="handled"
      />
    </SafeAreaView>
  );
}
