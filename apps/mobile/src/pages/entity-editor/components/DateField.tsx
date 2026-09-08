import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Keyboard, Platform, View } from 'react-native';
import { dateLabel, localDate } from '../../../shared/lib/dates';
import { Button } from '../../../shared/ui/Button';
import { ListRow } from '../../../shared/ui/ListRow';

export function DateField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const date = new Date(`${value}T12:00:00`);
  return (
    <View>
      <ListRow
        title={label}
        subtitle={dateLabel(value)}
        icon="calendar-blank-outline"
        onPress={
          disabled
            ? undefined
            : () => {
                Keyboard.dismiss();
                setOpen(!open);
              }
        }
      />
      {open && !disabled ? (
        <>
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            locale="ja-JP"
            themeVariant="light"
            onDismiss={() => setOpen(false)}
            onValueChange={(_, selected) => {
              onChange(localDate(selected));
              if (Platform.OS !== 'ios') setOpen(false);
            }}
          />
          {Platform.OS === 'ios' ? (
            <Button
              label="日付を確定"
              variant="secondary"
              onPress={() => setOpen(false)}
            />
          ) : null}
        </>
      ) : null}
    </View>
  );
}
