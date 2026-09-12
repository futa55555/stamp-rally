import { Alert, View } from 'react-native';
import type { TemplateEditPreview } from '../../../features/trip-templates/edit-types';
import type { useTripTemplateEdit } from '../../../features/trip-templates/useTripTemplateEdit';
import { AppText } from '../../../shared/ui/AppText';
import { Button } from '../../../shared/ui/Button';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage';
import { CheckRow } from './TemplateFields';

export function confirmTemplateEdit(
  preview: TemplateEditPreview,
): Promise<boolean> {
  const { stampCount, postCount } = preview.impact;
  return new Promise((resolve) =>
    Alert.alert(
      'スタンプの選択を変更しますか？',
      stampCount > 0
        ? `${stampCount}件のスタンプと、付属する${postCount}件の投稿（ゴミ箱内・アップロード中を含む）を永久に削除します。復元できません。変更を保存するまでは反映されません。`
        : 'このカテゴリーからスタンプを外します。別のカテゴリーにも属するスタンプと投稿は残ります。変更を保存するまでは反映されません。',
      [
        { text: 'キャンセル', style: 'cancel', onPress: () => resolve(false) },
        {
          text: '選択を変更',
          style: stampCount ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}

export function EditTemplateFields({
  templates,
  disabled,
}: {
  templates: ReturnType<typeof useTripTemplateEdit>;
  disabled: boolean;
}) {
  return (
    <View className="gap-2">
      <AppText variant="label">旅のスタンプ</AppText>
      <AppText variant="caption" tone="textSecondary">
        場所ややりたいことを外しても、投稿があるスタンプは残ります。ここで選択を外すと、保存時に削除されます。
      </AppText>
      {templates.pending ? (
        <AppText tone="textSecondary">スタンプを読み込み中…</AppText>
      ) : null}
      <ErrorMessage message={templates.error} />
      {templates.error ? (
        <Button
          label="スタンプを再読み込み"
          variant="secondary"
          onPress={templates.retry}
          disabled={disabled}
        />
      ) : null}
      {templates.categories.map((category) => {
        const selectedCount = category.stamps.filter(
          (stamp) => stamp.selected,
        ).length;
        const checked =
          selectedCount && selectedCount < category.stamps.length
            ? 'mixed'
            : category.selected;
        return (
          <View
            key={category.ref}
            className="rounded-xl border border-border px-3 py-1"
          >
            <CheckRow
              label={category.name}
              checked={checked}
              emphasized
              disabled={disabled || !templates.ready}
              onPress={() => {
                void templates.toggle({
                  categoryRef: category.ref,
                  selected: checked !== true,
                });
              }}
            />
            <View className="gap-1 pl-5">
              {category.stamps.map((stamp) => (
                <View key={stamp.ref}>
                  <CheckRow
                    label={stamp.name}
                    checked={stamp.selected}
                    disabled={disabled || !templates.ready}
                    onPress={() => {
                      void templates.toggle({
                        categoryRef: category.ref,
                        stampRef: stamp.ref,
                        selected: !stamp.selected,
                      });
                    }}
                  />
                  {stamp.retained && stamp.selected ? (
                    <AppText variant="caption" tone="textSecondary">
                      投稿があるため残しています（ゴミ箱・処理中を含む）
                    </AppText>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        );
      })}
      {templates.ready && !templates.categories.length ? (
        <AppText variant="caption" tone="textSecondary">
          場所ややりたいことを追加すると、候補がここに表示されます。
        </AppText>
      ) : null}
    </View>
  );
}
