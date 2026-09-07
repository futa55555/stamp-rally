import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import appConfig from '../../../app.json';
import { useData } from '../../data/AppDataProvider';
import { useAppTheme } from '../../theme/ThemeProvider';
import {
  AppText,
  Badge,
  Button,
  ErrorMessage,
  Icon,
  IconButton,
  ListRow,
  Screen,
  SectionHeading,
} from '../../components/ui';
import { useTask } from '../hooks';

export function SettingsScreen() {
  const theme = useAppTheme();
  const { data, userId, actions } = useData();
  const user = data.users.find((u) => u.id === userId);
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
      <Screen>
        <View
          style={{
            alignItems: 'center',
            gap: theme.spacing.sm,
            paddingVertical: theme.spacing.lg,
          }}
        >
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.surfaceSubtle,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="account-outline" size={40} tone="primary" />
          </View>
          <AppText variant="title" accessibilityRole="header">
            {user?.name ?? '旅の仲間'}
          </AppText>
          <Badge label="旅の仲間" icon="bag-suitcase-outline" />
        </View>
        <View style={{ gap: theme.spacing.sm }}>
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
        <View style={{ gap: theme.spacing.sm }}>
          <SectionHeading title="アプリについて" />
          <ListRow
            title="バージョン"
            subtitle={`Stamp Rally ${appConfig.expo.version}`}
            icon="information-outline"
          />
        </View>
        <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
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
          <AppText
            variant="caption"
            tone="textMuted"
            style={{ textAlign: 'center' }}
          >
            サンプルの変更はアプリを再起動するとリセットされます。
          </AppText>
        </View>
      </Screen>
      <Modal
        visible={editing}
        transparent
        animationType="fade"
        onRequestClose={close}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{
            flex: 1,
            backgroundColor: theme.colors.overlay,
            justifyContent: 'center',
            padding: theme.spacing.lg,
          }}
        >
          <View
            accessibilityViewIsModal
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.lg,
              maxHeight: '90%',
              width: '100%',
              maxWidth: 480,
              alignSelf: 'center',
            }}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                padding: theme.spacing.lg,
                gap: theme.spacing.md,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <AppText
                  variant="heading"
                  accessibilityRole="header"
                  style={{ flex: 1 }}
                >
                  名前を変更
                </AppText>
                <IconButton
                  icon="close"
                  label="名前の変更を閉じる"
                  onPress={close}
                  disabled={saveTask.pending}
                />
              </View>
              <AppText variant="caption" tone="textSecondary">
                旅の仲間に表示される名前です。1〜20文字で入力してください。
              </AppText>
              <TextInput
                value={name}
                onChangeText={setName}
                accessibilityLabel="名前"
                autoFocus
                editable={!saveTask.pending}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={() => {
                  void save();
                }}
                selectionColor={theme.colors.primary}
                placeholder="名前を入力"
                placeholderTextColor={theme.colors.textMuted}
                style={{
                  ...theme.typography.body,
                  color: theme.colors.text,
                  backgroundColor: theme.colors.background,
                  borderColor: saveTask.error
                    ? theme.colors.error
                    : theme.colors.border,
                  borderWidth: 1,
                  borderRadius: theme.radius.sm,
                  padding: theme.spacing.md,
                  minHeight: theme.layout.touchTarget,
                }}
              />
              <ErrorMessage message={saveTask.error} />
              <Button
                label="保存する"
                pending={saveTask.pending}
                onPress={() => {
                  void save();
                }}
              />
              <Button
                label="キャンセル"
                variant="secondary"
                disabled={saveTask.pending}
                onPress={close}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
