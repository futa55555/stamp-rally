import { useState } from 'react';
import { Share, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useData } from '../../features/app-data/AppDataProvider';
import { combineQueries } from '../../features/app-data/api/queries';
import {
  useInvitationLinks,
  useTripInvitations,
} from '../../features/invitations/hooks';
import {
  canShareInvitation,
  publicInvitationOrigin,
} from '../../features/invitations/runtime';
import { invitationUrl } from '../../features/invitations/links';
import { Screen } from '../../shared/ui/Screen';
import { QueryState } from '../../shared/ui/QueryState';
import { AppText } from '../../shared/ui/AppText';
import { Button } from '../../shared/ui/Button';
import { ErrorMessage } from '../../shared/ui/ErrorMessage';
import { useTask } from '../../shared/hooks/useTask';
import { usePullToRefresh } from '../../shared/hooks/usePullToRefresh';
import { InvitationRow } from './InvitationParts';

export function TripInvitationsScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { actions, userId, client } = useData();
  const links = useInvitationLinks(tripId);
  const invitations = useTripInvitations(tripId);
  const query = combineQueries(links, invitations);
  const refresh = usePullToRefresh(query.invalidate);
  const task = useTask();
  const [issued, setIssued] = useState<{
    id: string;
    token: string;
    expiresAt: string;
  } | null>(null);
  const share = (token: string) =>
    Share.share({
      message:
        '旅行への招待です。参加を申請してください。\n' +
        invitationUrl(token, publicInvitationOrigin),
    });
  if (query.isPending || query.error) return <QueryState query={query} />;
  return (
    <Screen {...refresh} contentContainerClassName="px-4 pt-6">
      <AppText variant="title">仲間を招待</AppText>
      <AppText tone="textSecondary">
        リンクは7日間有効です。複数人に共有できます。参加申請は、旅行の参加者が確認して承認します。
      </AppText>
      {canShareInvitation ? (
        <Button
          label="招待リンクを作成して共有"
          pending={task.pending}
          onPress={() => {
            void task.run(async () => {
              const assertCurrent = client.sessionGuard();
              const result = await actions.createInvitationLink(tripId);
              assertCurrent();
              setIssued({
                id: result.id,
                token: result.token,
                expiresAt: result.expiresAt,
              });
              await share(result.token);
            });
          }}
        />
      ) : (
        <AppText>招待リンクの共有は準備中です。</AppText>
      )}
      {issued &&
      new Date(issued.expiresAt).getTime() > Date.now() &&
      !links.data?.find((link) => link.id === issued.id)?.revokedAt ? (
        <Button
          label="作成したリンクをもう一度共有"
          variant="secondary"
          disabled={task.pending}
          onPress={() => {
            void task.run(async () => {
              if (new Date(issued.expiresAt).getTime() <= Date.now())
                throw new Error(
                  'このリンクは期限切れです。新しいリンクを作成してください。',
                );
              await share(issued.token);
            });
          }}
        />
      ) : null}
      <ErrorMessage message={task.error} />
      <View className="gap-3">
        <AppText variant="title">参加申請</AppText>
        {invitations.data?.length ? (
          invitations.data.map((item) => (
            <InvitationRow key={item.id} invitation={item} />
          ))
        ) : (
          <AppText tone="textSecondary">参加申請はまだありません。</AppText>
        )}
      </View>
      <View className="gap-3">
        <AppText variant="title">発行したリンク</AppText>
        {links.data?.map((link) => {
          const active =
            !link.revokedAt && new Date(link.expiresAt).getTime() > Date.now();
          return (
            <View
              key={link.id}
              className="gap-3 p-4 rounded-2xl bg-surface border border-border"
            >
              <AppText>{link.createdBy.name}さんが発行</AppText>
              <AppText tone="textSecondary">
                {link.revokedAt
                  ? '無効化済み'
                  : active
                    ? '有効期限：' +
                      new Date(link.expiresAt).toLocaleString('ja-JP')
                    : '期限切れ'}
              </AppText>
              {active && link.createdById === userId ? (
                <Button
                  label="このリンクを無効化"
                  variant="danger"
                  disabled={task.pending}
                  onPress={() => {
                    void task.run(async () => {
                      await actions.revokeInvitationLink(link.id);
                      if (issued?.id === link.id) setIssued(null);
                    });
                  }}
                />
              ) : null}
            </View>
          );
        })}
      </View>
    </Screen>
  );
}
