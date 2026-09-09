import { FlatList, Platform, type FlatListProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
  return (
    <SafeAreaView
      // NativeTabs already handles the bottom safe area on Android.
      // On iOS, place the list inside it so the inset isn't added to its content.
      edges={
        Platform.OS === 'ios' ? ['bottom', 'left', 'right'] : ['left', 'right']
      }
      className="flex-1 bg-background"
    >
      <FlatList
        {...props}
        className="flex-1"
        contentContainerClassName={[
          'w-full grow max-w-page self-center px-4 py-6 gap-4',
          props.data?.length ? '' : 'justify-center',
        ].join(' ')}
        keyboardShouldPersistTaps="handled"
      />
    </SafeAreaView>
  );
}
