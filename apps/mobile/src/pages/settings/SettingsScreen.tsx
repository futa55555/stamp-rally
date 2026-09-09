import { useState } from 'react';
import { View } from 'react-native';
import appConfig from '../../../app.json';
import { useData } from '../../features/app-data/AppDataProvider';
import { useTask } from '../../shared/hooks/useTask';
import { AppText } from '../../shared/ui/AppText';
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { ErrorMessage } from '../../shared/ui/ErrorMessage';
import { Icon } from '../../shared/ui/Icon';
import { ListRow } from '../../shared/ui/ListRow';
import { Screen } from '../../shared/ui/Screen';
import { SectionHeading } from '../../shared/ui/SectionHeading';
import { NameEditModal } from './components/NameEditModal';

export function SettingsScreen() {
  const { user, userId, actions } = useData();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const saveTask = useTask();
  const logoutTask = useTask();
  const close = () => {
    if (!saveTask.pending) setEditing(false);
  };
  const save = async () => {
    if (!userId) return;
    if (await saveTask.run(() => actions.updateName(userId, name))) {
      setEditing(false);
      setNotice('名前を更新しました。');
    }
  };
  return (
    <>
      <Screen contentContainerClassName="px-4 pt-6">
        <View className="items-center gap-3 py-6">
          <View className="w-20 h-20 rounded-full bg-surfaceSubtle items-center justify-center">
            <Icon name="account-outline" size={40} tone="primary" />
          </View>
          <AppText variant="title" accessibilityRole="header">
            {user?.name ?? '旅の仲間'}
          </AppText>
          <Badge label="旅の仲間" icon="bag-suitcase-outline" />
        </View>
        <View className="gap-3">
          <SectionHeading title="アカウント" />
          <ListRow
            title="名前"
            subtitle={user?.name ?? '未設定'}
            icon="account-edit-outline"
            onPress={() => {
              setName(user?.name ?? '');
              setNotice(null);
              saveTask.clearError();
              setEditing(true);
            }}
            trailing={<Icon name="pencil-outline" size={20} tone="primary" />}
          />
          {notice ? (
            <AppText
              variant="caption"
              tone="primary"
              accessibilityLiveRegion="polite"
            >
              {notice}
            </AppText>
          ) : null}
        </View>
        <View className="gap-3">
          <SectionHeading title="アプリについて" />
          <ListRow
            title="バージョン"
            subtitle={`Stamp Rally ${appConfig.expo.version}`}
            icon="information-outline"
          />
        </View>
        <View className="gap-3 mt-6">
          <Button
            label="ログアウト"
            icon="logout"
            variant="danger"
            pending={logoutTask.pending}
            onPress={() => {
              void logoutTask.run(actions.signOut);
            }}
          />
          <ErrorMessage message={logoutTask.error} />
          <AppText variant="caption" tone="textMuted" className="text-center">
            変更内容はアカウントに保存されます。
          </AppText>
        </View>
      </Screen>
      <NameEditModal
        editing={editing}
        name={name}
        setName={setName}
        saveTask={saveTask}
        close={close}
        save={save}
      />
    </>
  );
}
