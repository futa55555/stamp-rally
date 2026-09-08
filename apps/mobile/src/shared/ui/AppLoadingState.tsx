import { SafeAreaView } from 'react-native-safe-area-context';
import { StateView } from './StateView';

export function AppLoadingState({
  fontError,
  error,
  reload,
}: {
  fontError: Error | null;
  error: string | null;
  reload: () => Promise<void>;
}) {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <StateView
        title={
          fontError
            ? 'アイコンを読み込めませんでした'
            : error
              ? '読み込みに失敗しました'
              : '旅の準備をしています'
        }
        description={
          fontError ? 'アプリを再起動してください。' : (error ?? undefined)
        }
        loading={!fontError && !error}
        action={
          !fontError && error
            ? {
                label: '再試行',
                onPress: () => {
                  void reload();
                },
              }
            : undefined
        }
      />
    </SafeAreaView>
  );
}
