import { View } from 'react-native';
import { useInvitations } from '../../features/invitations/hooks';
import { combineQueries } from '../../features/app-data/api/queries';
import { Screen } from '../../shared/ui/Screen';
import { QueryState } from '../../shared/ui/QueryState';
import { AppText } from '../../shared/ui/AppText';
import { usePullToRefresh } from '../../shared/hooks/usePullToRefresh';
import { InvitationRow } from './InvitationParts';

export function InvitationsScreen() {
  const mine = useInvitations('mine');
  const review = useInvitations('review');
  const query = combineQueries(mine, review);
  const refresh = usePullToRefresh(query.invalidate);
  if (query.isPending || query.error) return <QueryState query={query} />;
  return (
    <Screen {...refresh} contentContainerClassName="px-4 pt-6">
      <View className="gap-3">
        <AppText variant="title">最終承認待ち</AppText>
        {review.data?.length ? (
          review.data.map((item) => (
            <InvitationRow key={item.id} invitation={item} />
          ))
        ) : (
          <AppText tone="textSecondary">確認が必要な申請はありません。</AppText>
        )}
      </View>
      <View className="gap-3">
        <AppText variant="title">自分の参加申請</AppText>
        {mine.data?.length ? (
          mine.data.map((item) => (
            <InvitationRow key={item.id} invitation={item} />
          ))
        ) : (
          <AppText tone="textSecondary">
            招待リンクから参加を申請できます。
          </AppText>
        )}
      </View>
    </Screen>
  );
}
