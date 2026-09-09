import { useEffect, useSyncExternalStore } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useData } from '../../features/app-data/AppDataProvider';
import { useInvitationPreview } from '../../features/invitations/hooks';
import { isInvitationToken } from '../../features/invitations/links';
import { pendingInvitation } from '../../features/invitations/runtime';
import { LoginScreen } from '../login/LoginScreen';
import Onboarding from '../../app/onboarding';
import { Screen } from '../../shared/ui/Screen';
import { AppText } from '../../shared/ui/AppText';
import { Button } from '../../shared/ui/Button';
import { ErrorMessage } from '../../shared/ui/ErrorMessage';
import { QueryState } from '../../shared/ui/QueryState';
import { useTask } from '../../shared/hooks/useTask';
import { ApiError } from '../../shared/api/errors';
import { usePullToRefresh } from '../../shared/hooks/usePullToRefresh';
import { InvitationSummary } from './InvitationParts';

export function InviteScreen() {
  const { token = '', linkId } = useLocalSearchParams<{
    token?: string;
    linkId?: string;
  }>();
  const { user, actions, client } = useData();
  const router = useRouter();
  const task = useTask();
  const pending = useSyncExternalStore(
    pendingInvitation.subscribe,
    pendingInvitation.snapshot,
  );
  const query = useInvitationPreview(token, linkId);
  const refresh = usePullToRefresh(query.invalidate);
  const preview = query.data;
  const resolved =
    user?.status === 'ACTIVE' &&
    !query.isPending &&
    !query.isFetching &&
    !query.error
      ? preview
      : undefined;
  const tripId = resolved?.isMember ? resolved.trip.id : undefined;
  const invitationId =
    !tripId &&
    resolved?.invitation &&
    (resolved.invitation.status === 'PENDING_CONFIRMATION' ||
      (resolved.linkStatus === 'ACTIVE' && !resolved.canRequest))
      ? resolved.invitation.id
      : undefined;
  useEffect(() => {
    if (isInvitationToken(token) && client.snapshot().user?.status !== 'ACTIVE')
      void pendingInvitation.capture(token).catch(() => {});
  }, [token, client]);
  useEffect(() => {
    if (user?.status === 'ACTIVE' && pending.token === token)
      void pendingInvitation.clear().catch(() => {});
  }, [token, user?.status, pending.token]);
  useEffect(() => {
    if (tripId)
      router.replace({ pathname: '/trips/trip/[tripId]', params: { tripId } });
    else if (invitationId)
      router.replace({
        pathname: '/invitations/[id]',
        params: { id: invitationId },
      });
  }, [tripId, invitationId, router]);
  const cancel = () => {
    void task.run(async () => {
      await pendingInvitation.clear();
      router.replace('/trips');
    });
  };
  if (!linkId && !isInvitationToken(token))
    return (
      <Screen contentContainerClassName="px-4 pt-6">
        <AppText>招待リンクが正しくありません。</AppText>
        <ErrorMessage message={task.error} />
        <Button label="トップに戻る" onPress={cancel} />
      </Screen>
    );
  if (!user || user.status === 'ONBOARDING')
    return (
      <>
        <AppText className="px-4 py-3">
          ログインと名前の設定後に、招待内容を確認できます。
        </AppText>
        {!user ? <LoginScreen /> : <Onboarding />}
        <ErrorMessage message={pending.error ?? task.error} />
        <Button label="トップに戻る" variant="secondary" onPress={cancel} />
      </>
    );
  if (tripId || invitationId) return null;
  if (
    (query.error instanceof ApiError &&
      [404, 410].includes(query.error.status ?? 0)) ||
    (resolved && resolved.linkStatus !== 'ACTIVE')
  )
    return (
      <Screen contentContainerClassName="px-4 pt-6">
        <AppText>この招待リンクは利用できません。</AppText>
        <AppText tone="textSecondary">
          期限切れ、または無効化されている可能性があります。招待した人から新しいリンクを受け取ってください。
        </AppText>
        <ErrorMessage message={task.error} />
        <Button label="トップに戻る" onPress={cancel} />
      </Screen>
    );
  if (query.isPending || query.isFetching || query.error || !preview)
    return (
      <>
        <QueryState query={query} />
        <Button label="トップに戻る" variant="secondary" onPress={cancel} />
        <ErrorMessage message={task.error} />
      </>
    );
  return (
    <Screen {...refresh} contentContainerClassName="px-4 pt-6">
      <InvitationSummary trip={preview.trip} />
      <AppText>{preview.createdBy.name}さんからの招待</AppText>
      <AppText tone="textSecondary">
        参加を申請した後、旅行の参加者が承認すると参加が確定します。
      </AppText>
      {preview.canRequest ? (
        <Button
          label="参加を申請"
          pending={task.pending}
          onPress={() => {
            void task.run(async () => {
              const assertCurrent = client.sessionGuard();
              const result = linkId
                ? await actions.requestReceivedInvitation(linkId)
                : await actions.requestInvitation(token);
              assertCurrent();
              await pendingInvitation.clear();
              assertCurrent();
              router.replace({
                pathname: '/invitations/[id]',
                params: { id: result.id },
              });
            });
          }}
        />
      ) : null}
      {!preview.isMember &&
      !preview.canRequest &&
      preview.linkStatus === 'ACTIVE' &&
      preview.invitation?.status !== 'PENDING_CONFIRMATION' ? (
        <AppText>
          再申請する場合は、新しい招待リンクを受け取ってください。
        </AppText>
      ) : null}
      <ErrorMessage message={task.error ?? pending.error} />
      <Button label="トップに戻る" variant="secondary" onPress={cancel} />
    </Screen>
  );
}
