import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useData } from '../../features/app-data/AppDataProvider';
import type {
  Invitation,
  InvitationAction,
} from '../../features/invitations/types';
import { invitationStatusLabels } from '../../features/invitations/types';
import { AppText } from '../../shared/ui/AppText';
import { Button } from '../../shared/ui/Button';
import { ErrorMessage } from '../../shared/ui/ErrorMessage';
import { useTask } from '../../shared/hooks/useTask';
import { PhotoImage } from '../../shared/ui/PhotoImage';

export function InvitationSummary({ trip }: { trip: Invitation['trip'] }) {
  return (
    <View className="gap-3">
      {trip.coverImageUrl ? (
        <PhotoImage
          url={trip.coverImageUrl}
          label={trip.name}
          className="h-44 rounded-2xl"
        />
      ) : null}
      <AppText variant="title">{trip.name}</AppText>
      <AppText tone="textSecondary">
        {trip.startDate} 〜 {trip.endDate}
      </AppText>
    </View>
  );
}
export function InvitationRow({ invitation }: { invitation: Invitation }) {
  const router = useRouter();
  return (
    <View className="gap-3 p-4 rounded-2xl bg-surface border border-border">
      <AppText variant="label">{invitation.trip.name}</AppText>
      <AppText>{invitation.invitee.name}さん</AppText>
      <AppText tone="textSecondary">
        {invitationStatusLabels[invitation.status]}
      </AppText>
      <Button
        label="申請を確認"
        variant="secondary"
        onPress={() =>
          router.push({
            pathname: '/invitations/[id]',
            params: { id: invitation.id },
          })
        }
      />
    </View>
  );
}
export function InvitationControls({
  invitation,
  refresh,
}: {
  invitation: Invitation;
  refresh: () => Promise<unknown>;
}) {
  const { actions } = useData();
  const task = useTask();
  const labels: Record<InvitationAction, string> = {
    confirm: '参加を承認',
    decline: '申請を撤回',
    cancel: '申請を取り消す',
  };
  return (
    <View className="gap-3">
      <AppText variant="label">
        {invitationStatusLabels[invitation.status]}
      </AppText>
      {invitation.status === 'PENDING_CONFIRMATION' ? (
        <AppText tone="textSecondary">
          旅行の参加者が承認すると、参加が確定します。
        </AppText>
      ) : null}
      {invitation.allowedActions.map((action) => (
        <Button
          key={action}
          label={labels[action]}
          variant={action === 'confirm' ? 'primary' : 'danger'}
          pending={task.pending}
          onPress={() => {
            void task.run(async () => {
              try {
                await actions.decideInvitation(
                  invitation.id,
                  action,
                  invitation.generation,
                );
              } finally {
                await refresh();
              }
            });
          }}
        />
      ))}
      <ErrorMessage message={task.error} />
    </View>
  );
}
