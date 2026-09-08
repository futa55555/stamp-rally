import { useState } from 'react';
import { Keyboard, Pressable, View } from 'react-native';
import {
  Calendar,
  LocaleConfig,
  type CalendarProps,
} from 'react-native-calendars';
import { IconButton } from '../../../shared/ui/IconButton';
import type {
  DateRange,
  DateSelection,
} from '../../../features/trips/model/dateSelection';
import {
  selectRangeDate,
  visiblePeriod,
} from '../../../features/trips/model/dateSelection';
import { dateRange } from '../../../shared/lib/dates';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';
import { AppText } from '../../../shared/ui/AppText';
import { Icon } from '../../../shared/ui/Icon';

LocaleConfig.locales.ja = {
  monthNames: Array.from({ length: 12 }, (_, i) => i + 1 + '月'),
  monthNamesShort: Array.from({ length: 12 }, (_, i) => i + 1 + '月'),
  dayNames: [
    '日曜日',
    '月曜日',
    '火曜日',
    '水曜日',
    '木曜日',
    '金曜日',
    '土曜日',
  ],
  dayNamesShort: ['日', '月', '火', '水', '木', '金', '土'],
  today: '今日',
};
LocaleConfig.defaultLocale = 'ja';

function CalendarMonthHeader({
  month,
  addMonth,
}: Pick<CalendarProps, 'month' | 'addMonth'>) {
  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2">
        <IconButton
          icon="chevron-left"
          label="前の月"
          onPress={() => addMonth?.(-1)}
        />
        <AppText
          variant="label"
          accessibilityRole="header"
          className="flex-1 text-center"
        >
          {month?.toString('yyyy年 M月')}
        </AppText>
        <IconButton
          icon="chevron-right"
          label="次の月"
          onPress={() => addMonth?.(1)}
        />
      </View>
      <View className="flex-row">
        {['日', '月', '火', '水', '木', '金', '土'].map((day) => (
          <AppText
            key={day}
            variant="caption"
            tone="textSecondary"
            className="flex-1 text-center"
          >
            {day}
          </AppText>
        ))}
      </View>
    </View>
  );
}

export function DateField({
  value,
  onChange,
  disabled,
}: {
  value: DateRange;
  onChange: (value: DateRange) => void;
  disabled: boolean;
}) {
  const theme = useAppTheme();
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<DateSelection | null>(null);
  const [month, setMonth] = useState(value.startDate);
  const markings = visiblePeriod(selection ?? value, month);
  const choose = (day: string) => {
    const next = selectRangeDate(selection, day);
    if (next.endDate) {
      onChange({ startDate: next.startDate, endDate: next.endDate });
      setOpen(false);
      setSelection(null);
    } else setSelection(next);
  };
  return (
    <View className="gap-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          '日程、' + dateRange(value.startDate, value.endDate)
        }
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={() => {
          Keyboard.dismiss();
          setSelection(null);
          setMonth(value.startDate);
          setOpen(!open);
        }}
        className="min-h-12 flex-row items-center gap-3 rounded-lg border border-border bg-surface p-4 active:opacity-pressed"
      >
        <Icon name="calendar-blank-outline" size={20} />
        <AppText className="flex-1">
          {dateRange(value.startDate, value.endDate)}
        </AppText>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={20} />
      </Pressable>
      {open && !disabled ? (
        <View className="gap-2 rounded-lg bg-surface p-2">
          <AppText
            variant="caption"
            tone="primary"
            accessibilityLiveRegion="polite"
          >
            {selection
              ? '終了日を選択してください'
              : '開始日を選択してください'}
          </AppText>
          <Calendar
            customHeader={CalendarMonthHeader}
            initialDate={value.startDate}
            monthFormat="yyyy年 M月"
            onMonthChange={(date) => setMonth(date.dateString)}
            onDayPress={(date) => choose(date.dateString)}
            markingType="period"
            markedDates={Object.fromEntries(
              Object.entries(markings).map(([day, marking]) => [
                day,
                {
                  ...marking,
                  color: theme.colors.primary,
                  textColor: theme.colors.onPrimary,
                },
              ]),
            )}
            theme={{
              calendarBackground: theme.colors.surface,
              monthTextColor: theme.colors.text,
              textSectionTitleColor: theme.colors.textSecondary,
              arrowColor: theme.colors.primary,
              textMonthFontSize: theme.typography.body.fontSize,
            }}
            dayComponent={({ date, state }) => {
              if (!date) return null;
              const mark = markings[date.dateString];
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    date.dateString.replace('-', '年').replace('-', '月') + '日'
                  }
                  accessibilityState={{ selected: !!mark }}
                  onPress={() => choose(date.dateString)}
                  className={[
                    'min-h-11 w-full items-center justify-center py-2',
                    mark ? 'bg-primary' : '',
                    mark?.startingDay ? 'rounded-l-full' : '',
                    mark?.endingDay ? 'rounded-r-full' : '',
                  ].join(' ')}
                >
                  <AppText
                    variant="label"
                    tone={
                      mark
                        ? 'onPrimary'
                        : state === 'disabled'
                          ? 'textMuted'
                          : state === 'today'
                            ? 'primary'
                            : 'text'
                    }
                  >
                    {date.day}
                  </AppText>
                </Pressable>
              );
            }}
          />
        </View>
      ) : null}
    </View>
  );
}
