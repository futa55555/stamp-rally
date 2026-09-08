import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/ThemeProvider';
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
  const theme = useAppTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
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
