import { localDate } from '../../../shared/lib/dates';
export type DateRange = { startDate: string; endDate: string };
export type DateSelection = { startDate: string; endDate?: string };

export function selectRangeDate(
  selection: DateSelection | null,
  day: string,
): DateSelection {
  if (!selection || selection.endDate || day < selection.startDate)
    return { startDate: day };
  return { ...selection, endDate: day };
}

// Bound markings to the visible month and neighboring weeks even for long trips.
export function visiblePeriod(range: DateSelection, month: string) {
  const cursor = new Date(month.slice(0, 7) + '-01T12:00:00');
  cursor.setDate(cursor.getDate() - 7);
  const last = new Date(month.slice(0, 7) + '-01T12:00:00');
  last.setMonth(last.getMonth() + 1);
  last.setDate(7);
  const result: Record<string, { startingDay: boolean; endingDay: boolean }> =
    {};
  const end = range.endDate ?? range.startDate;
  while (cursor <= last) {
    const day = localDate(cursor);
    if (range.startDate <= day && day <= end)
      result[day] = {
        startingDay: day === range.startDate,
        endingDay: day === end,
      };
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}
