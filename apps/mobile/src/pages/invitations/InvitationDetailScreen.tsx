import { useLocalSearchParams, useRouter } from 'expo-router';
import { useInvitation } from '../../features/invitations/hooks';
import { Screen } from '../../shared/ui/Screen';
import { QueryState } from '../../shared/ui/QueryState';
import { AppText } from '../../shared/ui/AppText';
import { Button } from '../../shared/ui/Button';
import { usePullToRefresh } from '../../shared/hooks/usePullToRefresh';
import { InvitationControls, InvitationSummary } from './InvitationParts';

export function InvitationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const query = useInvitation(id);
  const refresh = usePullToRefresh(query.invalidate);
  if (query.isPending || query.error || !query.data)
    return <QueryState query={query} />;
  const invitation = query.data;
  return (
    <Screen {...refresh} contentContainerClassName="px-4 pt-6">
      <InvitationSummary trip={invitation.trip} />
      <AppText>申請者：{invitation.invitee.name}さん</AppText>
      <AppText tone="textSecondary">
        招待者：{invitation.invitedBy.name}さん
      </AppText>
      <InvitationControls invitation={invitation} refresh={query.invalidate} />
      {invitation.status === 'ACCEPTED' ? (
        <Button
          label="旅行を開く"
          onPress={() =>
            router.dismissTo({
              pathname: '/trips/trip/[tripId]',
              params: { tripId: invitation.tripId },
            })
          }
        />
      ) : null}
    </Screen>
  );
}
