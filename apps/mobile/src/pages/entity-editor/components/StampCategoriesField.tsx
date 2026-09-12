import { Pressable, View } from 'react-native';
import type { Category } from '../../../features/trips/model/types';
import { AppText } from '../../../shared/ui/AppText';
import { Icon } from '../../../shared/ui/Icon';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage';
import { Button } from '../../../shared/ui/Button';

export function StampCategoriesField({
  categories,
  selected,
  onChange,
  disabled,
  pending,
  error,
  onRetry,
}: {
  categories: Category[];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled: boolean;
  pending: boolean;
  error: string | null;
  onRetry: () => Promise<unknown>;
}) {
  return (
    <View className="gap-2">
      <AppText variant="label">所属カテゴリー</AppText>
      <AppText variant="caption" tone="textSecondary">
        1つ以上選択してください。複数選べます。
      </AppText>
      {pending ? (
        <AppText variant="caption">カテゴリーを読み込み中…</AppText>
      ) : null}
      <View className="flex-row flex-wrap gap-2">
        {categories.map((category) => {
          const checked = selected.includes(category.id);
          return (
            <Pressable
              key={category.id}
              accessibilityRole="checkbox"
              accessibilityLabel={category.name}
              accessibilityState={{ checked, disabled }}
              disabled={disabled}
              hitSlop={6}
              onPress={() =>
                onChange(
                  checked
                    ? selected.filter((id) => id !== category.id)
                    : [...selected, category.id],
                )
              }
              className={[
                'min-h-8 max-w-full flex-row items-center gap-1 rounded-full px-3 py-1.5 active:opacity-pressed',
                checked ? 'bg-primary' : 'bg-chipBackground',
                disabled ? 'opacity-disabled' : '',
              ].join(' ')}
            >
              {checked ? (
                <Icon name="check" size={14} tone="onPrimary" />
              ) : null}
              <AppText
                variant="caption"
                tone={checked ? 'onPrimary' : 'onChip'}
                className="shrink font-semibold"
              >
                {category.name}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <ErrorMessage message={error} />
      {error ? (
        <Button
          label="カテゴリーを再読み込み"
          variant="secondary"
          onPress={() => {
            void onRetry();
          }}
        />
      ) : null}
    </View>
  );
}
