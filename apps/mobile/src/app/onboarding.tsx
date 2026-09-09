import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useData } from '../features/app-data/AppDataProvider';
import { TextField } from '../pages/entity-editor/components/TextField';
import { useTask } from '../shared/hooks/useTask';
import { Screen } from '../shared/ui/Screen';
import { AppText } from '../shared/ui/AppText';
import { Button } from '../shared/ui/Button';
import { ErrorMessage } from '../shared/ui/ErrorMessage';

export default function Onboarding() {
  const { userId, actions } = useData();
  const [name, setName] = useState('');
  const task = useTask();
  return (
    <SafeAreaView className="flex-1 bg-background">
      <Screen contentContainerClassName="px-4 pt-6">
        <AppText variant="title">名前を設定</AppText>
        <AppText>旅の仲間に表示する名前を入力してください。</AppText>
        <TextField
          label="名前"
          value={name}
          onChangeText={setName}
          hint="1〜20文字"
          disabled={task.pending}
        />
        <Button
          label="はじめる"
          pending={task.pending}
          disabled={!name.trim()}
          onPress={() => {
            void task.run(() => actions.updateName(userId!, name.trim()));
          }}
        />
        <ErrorMessage message={task.error} />
        <Button
          label="ログアウト"
          variant="secondary"
          disabled={task.pending}
          onPress={() => {
            void task.run(actions.signOut);
          }}
        />
      </Screen>
    </SafeAreaView>
  );
}
