import { useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useEditor } from '../EditorProvider';

export function useEditorGuard(dirty: boolean, pending: boolean) {
  const navigation = useNavigation();
  const { finishing } = useEditor();
  const [departure, setDeparture] = useState<{ action: () => void } | null>(
    null,
  );
  usePreventRemove(
    (dirty || pending) && !finishing && !departure,
    ({ data }) => {
      if (pending) return;
      Alert.alert(
        '変更を破棄しますか？',
        '保存していない入力内容は失われます。',
        [
          { text: '入力を続ける', style: 'cancel' },
          {
            text: '破棄する',
            style: 'destructive',
            onPress: () => navigation.dispatch(data.action),
          },
        ],
      );
    },
  );
  useEffect(() => {
    if (!departure) return;
    const frame = requestAnimationFrame(departure.action);
    return () => cancelAnimationFrame(frame);
  }, [departure]);
  return (action: () => void) => setDeparture({ action });
}
