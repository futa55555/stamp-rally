import { FlatList, type FlatListProps } from 'react-native';
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
    <SafeAreaView edges={['left', 'right']} className="flex-1 bg-background">
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
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
