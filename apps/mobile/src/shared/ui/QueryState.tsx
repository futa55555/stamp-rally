import { ApiError } from '../api/errors';
import { StateView } from './StateView';

export function QueryState({
  query,
}: {
  query: { isPending: boolean; error: Error | null; refetch: () => unknown };
}) {
  const missing = query.error instanceof ApiError && query.error.status === 404;
  return (
    <StateView
      title={
        query.error
          ? missing
            ? '対象が見つかりません'
            : '読み込めませんでした'
          : '読み込み中…'
      }
      loading={!query.error && query.isPending}
      description={query.error?.message}
      action={
        query.error
          ? {
              label: '再試行',
              onPress: () => {
                void query.refetch();
              },
            }
          : undefined
      }
    />
  );
}
