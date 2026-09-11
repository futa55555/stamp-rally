import { useRef, useState } from 'react';
import type { TextInput } from 'react-native';
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

function ActivityChip({
  label,
  selected,
  expanded,
  removable = false,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  expanded?: boolean;
  removable?: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={
        expanded !== undefined || removable ? 'button' : 'checkbox'
      }
      accessibilityLabel={removable ? `${label}を削除` : label}
      accessibilityState={
        expanded !== undefined
          ? { expanded, disabled }
          : removable
            ? { disabled }
            : { checked: selected, disabled }
      }
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      className={[
        'min-h-8 max-w-full flex-row items-center gap-1 rounded-full px-3 py-1.5 active:opacity-pressed',
        selected ? 'bg-primary' : 'bg-chipBackground',
        disabled ? 'opacity-disabled' : '',
      ].join(' ')}
    >
      {expanded !== undefined ? (
        <Icon
          name={expanded ? 'minus' : 'plus'}
          size={14}
          tone={selected ? 'onPrimary' : 'onChip'}
        />
      ) : selected && !removable ? (
        <Icon name="check" size={14} tone="onPrimary" />
      ) : null}
      <AppText
        variant="caption"
        tone={selected ? 'onPrimary' : 'onChip'}
        className="shrink font-semibold"
      >
        {label}
      </AppText>
      {removable ? (
        <Icon name="close" size={16} tone={selected ? 'onPrimary' : 'onChip'} />
      ) : null}
    </Pressable>
  );
}

function CheckRow({
  label,
  checked,
  emphasized = false,
  disabled,
  onPress,
}: {
  label: string;
  checked: boolean | 'mixed';
  emphasized?: boolean;
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
      className="min-h-8 max-w-full flex-row items-center gap-1.5 py-1 active:opacity-pressed"
    >
      <Icon
        name={
          checked === 'mixed'
            ? 'minus-box'
            : checked
              ? 'checkbox-marked'
              : 'checkbox-blank-outline'
        }
        size={18}
        tone={disabled ? 'textMuted' : checked ? 'primary' : 'textSecondary'}
      />
      <AppText
        variant={emphasized ? 'label' : 'caption'}
        className="min-w-0 flex-1"
      >
        {label}
      </AppText>
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
  const [customExpanded, setCustomExpanded] = useState(false);
  const [customDraft, setCustomDraft] = useState('');
  const customInputRef = useRef<TextInput>(null);
  const customActivity = customDraft.trim();
  const customError =
    Array.from(customActivity).length > 100
      ? 'やりたいことは100文字以内で入力してください。'
      : customActivity &&
          custom.some((value) => value.trim() === customActivity)
        ? 'このやりたいことは追加済みです。'
        : null;
  const canAddCustom = !disabled && !!customActivity && !customError;
  const addCustomActivity = () => {
    if (!canAddCustom) return;
    onCustomChange([...custom, customActivity]);
    setCustomDraft('');
    customInputRef.current?.focus();
  };
  return (
    <View className="gap-2">
      <AppText variant="label">やりたいこと（任意）</AppText>
      <AppText variant="caption" tone="textSecondary">
        複数選べます。
      </AppText>
      {templates.presetsPending ? (
        <AppText tone="textSecondary">やりたいことを読み込み中…</AppText>
      ) : null}
      <View className="flex-row flex-wrap gap-2">
        {templates.presets?.activities.map(({ name }) => (
          <ActivityChip
            key={name}
            label={name}
            selected={selected.includes(name)}
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
        <ActivityChip
          label="その他"
          selected={customExpanded}
          expanded={customExpanded}
          disabled={disabled}
          onPress={() => setCustomExpanded((expanded) => !expanded)}
        />
      </View>
      <ErrorMessage message={templates.presetsError} />
      {templates.presetsError ? (
        <Button
          label="やりたいことを再読み込み"
          variant="secondary"
          onPress={templates.retryPresets}
          disabled={disabled}
        />
      ) : null}
      {customExpanded ? (
        <View className="gap-2">
          <View className="flex-row items-center gap-2">
            <View className="min-w-0 flex-1">
              <TextField
                label="その他のやりたいこと（任意）"
                value={customDraft}
                onChangeText={setCustomDraft}
                inputRef={customInputRef}
                autoFocus
                hideLabel
                disabled={disabled}
                hint="100文字以内。自由入力した内容は旅のメモとして保存されます。"
              />
            </View>
            <Button
              label="追加"
              disabled={!canAddCustom}
              onPress={addCustomActivity}
            />
          </View>
          <ErrorMessage message={customError} />
        </View>
      ) : null}
      {custom.length ? (
        <View className="flex-row flex-wrap gap-2">
          {custom.map((value, index) => (
            <ActivityChip
              key={index}
              label={value}
              selected
              removable
              disabled={disabled}
              onPress={() =>
                onCustomChange(custom.filter((_, i) => i !== index))
              }
            />
          ))}
        </View>
      ) : null}
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
    <View className="gap-2">
      <View className="flex-row flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <AppText variant="label">旅のスタンプ</AppText>
        <CheckRow
          label="テンプレートを使う"
          checked={useTemplate}
          disabled={disabled}
          onPress={() => onUseTemplateChange(!useTemplate)}
        />
      </View>
      {!useTemplate ? (
        <AppText variant="caption" tone="textSecondary">
          ジャンル・スタンプを追加せずに旅行を作成します。
        </AppText>
      ) : (
        <>
          <AppText variant="caption" tone="textSecondary">
            スタンプを選択。ジャンル名でまとめて切り替えられます。
          </AppText>
          {templates.pending ? (
            <AppText variant="caption" tone="textSecondary">
              スタンプ候補を読み込み中…
            </AppText>
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
                className="rounded-xl border border-border px-3 py-1"
              >
                <CheckRow
                  label={genre.name}
                  checked={checked}
                  emphasized
                  disabled={disabled || !templates.ready}
                  onPress={() => templates.toggleGenre(genre, checked !== true)}
                />
                <View className="pl-5">
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
            <AppText variant="caption" tone="textSecondary">
              行き先ややりたいことに合う候補があると、ここに表示されます。そのまま旅行を作成することもできます。
            </AppText>
          ) : null}
        </>
      )}
    </View>
  );
}
