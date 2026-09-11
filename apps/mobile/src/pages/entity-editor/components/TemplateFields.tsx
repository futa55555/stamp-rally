import { Pressable, View } from 'react-native';
import { AppText } from '../../../shared/ui/AppText';
import { Button } from '../../../shared/ui/Button';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage';
import { Icon } from '../../../shared/ui/Icon';
import {
  genreChecked,
  stampSelectionKey,
} from '../../../features/trip-templates/selection';
import type { useTripTemplates } from '../../../features/trip-templates/useTripTemplates';
import { TextField } from './TextField';

type Templates = ReturnType<typeof useTripTemplates>;

function CheckRow({
  label,
  checked,
  disabled,
  onPress,
}: {
  label: string;
  checked: boolean | 'mixed';
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onPress}
      className="min-h-12 flex-row items-center gap-3 py-3 active:opacity-pressed"
    >
      <Icon
        name={
          checked === 'mixed'
            ? 'minus-box'
            : checked
              ? 'checkbox-marked'
              : 'checkbox-blank-outline'
        }
        tone={disabled ? 'textMuted' : checked ? 'primary' : 'textSecondary'}
      />
      <AppText className="min-w-0 flex-1">{label}</AppText>
    </Pressable>
  );
}

export function ActivitiesField({
  templates,
  selected,
  custom,
  disabled,
  onChange,
  onCustomChange,
}: {
  templates: Templates;
  selected: string[];
  custom: string[];
  disabled: boolean;
  onChange: (values: string[]) => void;
  onCustomChange: (values: string[]) => void;
}) {
  return (
    <View className="gap-2">
      <AppText variant="label">やりたいこと（任意）</AppText>
      <AppText variant="caption" tone="textSecondary">
        複数選べます。
      </AppText>
      {templates.presetsPending ? (
        <AppText tone="textSecondary">やりたいことを読み込み中…</AppText>
      ) : null}
      {templates.presets?.activities.map(({ name }) => (
        <CheckRow
          key={name}
          label={name}
          checked={selected.includes(name)}
          disabled={disabled}
          onPress={() =>
            onChange(
              selected.includes(name)
                ? selected.filter((value) => value !== name)
                : [...selected, name],
            )
          }
        />
      ))}
      <ErrorMessage message={templates.presetsError} />
      {templates.presetsError ? (
        <Button
          label="やりたいことを再読み込み"
          variant="secondary"
          onPress={templates.retryPresets}
          disabled={disabled}
        />
      ) : null}
      <TextField
        label="その他のやりたいこと（任意）"
        value={custom.join('\n')}
        onChangeText={(text) => onCustomChange(text.split('\n'))}
        multiline
        disabled={disabled}
        hint="1行に1つ、100文字以内。自由入力した内容は旅のメモとして保存されます。"
      />
    </View>
  );
}

export function TemplateCandidatesField({
  templates,
  useTemplate,
  onUseTemplateChange,
  disabled,
}: {
  templates: Templates;
  useTemplate: boolean;
  onUseTemplateChange: (value: boolean) => void;
  disabled: boolean;
}) {
  return (
    <View className="gap-3">
      <AppText variant="label">旅のスタンプ</AppText>
      <CheckRow
        label="テンプレートを使う"
        checked={useTemplate}
        disabled={disabled}
        onPress={() => onUseTemplateChange(!useTemplate)}
      />
      {!useTemplate ? (
        <AppText tone="textSecondary">
          ジャンル・スタンプを追加せずに旅行を作成します。
        </AppText>
      ) : (
        <>
          <AppText variant="caption" tone="textSecondary">
            作成するスタンプを選んでください。ジャンルを選ぶと、まとめて切り替えられます。
          </AppText>
          {templates.pending ? (
            <AppText tone="textSecondary">スタンプ候補を読み込み中…</AppText>
          ) : null}
          <ErrorMessage message={templates.error} />
          {templates.error ? (
            <Button
              label="候補を再読み込み"
              variant="secondary"
              onPress={templates.retry}
              disabled={disabled}
            />
          ) : null}
          {templates.genres.map((genre) => {
            const checked = genreChecked(genre, templates.selection);
            return (
              <View
                key={genre.name}
                className="rounded-2xl border border-border px-4 py-2"
              >
                <CheckRow
                  label={genre.name}
                  checked={checked}
                  disabled={disabled || !templates.ready}
                  onPress={() => templates.toggleGenre(genre, checked !== true)}
                />
                <View className="pl-6">
                  {genre.stamps.map(({ title }) => (
                    <CheckRow
                      key={title}
                      label={title}
                      checked={
                        !!templates.selection[
                          stampSelectionKey(genre.name, title)
                        ]
                      }
                      disabled={disabled || !templates.ready}
                      onPress={() => templates.toggleStamp(genre.name, title)}
                    />
                  ))}
                </View>
              </View>
            );
          })}
          {templates.ready && !templates.genres.length ? (
            <AppText tone="textSecondary">
              行き先ややりたいことに合う候補があると、ここに表示されます。そのまま旅行を作成することもできます。
            </AppText>
          ) : null}
        </>
      )}
    </View>
  );
}
