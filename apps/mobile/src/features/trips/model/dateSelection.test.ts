import { describe, expect, it } from 'vitest';
import { selectRangeDate, visiblePeriod } from './dateSelection';

describe('calendar period selection', () => {
  it('starts a draft and accepts the same day as the end', () => {
    const start = selectRangeDate(null, '2026-09-09');
    expect(start.endDate).toBeUndefined();
    expect(selectRangeDate(start, '2026-09-09')).toEqual({
      startDate: '2026-09-09',
      endDate: '2026-09-09',
    });
  });
  it('restarts the start date when tapping an earlier day', () => {
    const draft = selectRangeDate({ startDate: '2026-09-09' }, '2026-09-01');
    expect(draft).toEqual({ startDate: '2026-09-01' });
    expect(selectRangeDate(draft, '2026-09-03')).toEqual({
      startDate: '2026-09-01',
      endDate: '2026-09-03',
    });
  });
  it('keeps confirmed dates immutable when a draft is abandoned', () => {
    const confirmed = { startDate: '2026-09-09', endDate: '2026-09-12' };
    expect(selectRangeDate(confirmed, '2026-09-20')).toEqual({
      startDate: '2026-09-20',
    });
    expect(confirmed).toEqual({
      startDate: '2026-09-09',
      endDate: '2026-09-12',
    });
  });
  it.each([
    ['2026-09-30', '2026-10-02', '2026-10-01'],
    ['2026-12-31', '2027-01-02', '2027-01-01'],
    ['2028-02-28', '2028-03-01', '2028-02-29'],
  ])(
    'selects and highlights across month/year boundaries: %s to %s',
    (startDate, endDate, middle) => {
      const range = selectRangeDate({ startDate }, endDate);
      expect(range).toEqual({ startDate, endDate });
      const marked = visiblePeriod(range, middle);
      expect(marked[startDate]).toEqual({
        startingDay: true,
        endingDay: false,
      });
      expect(marked[middle]).toEqual({ startingDay: false, endingDay: false });
      expect(marked[endDate]).toEqual({ startingDay: false, endingDay: true });
    },
  );
  it('marks a single day with both ends and bounds long trips to the visible month', () => {
    expect(visiblePeriod({ startDate: '2026-09-09' }, '2026-09-01')).toEqual({
      '2026-09-09': { startingDay: true, endingDay: true },
    });
    const marks = visiblePeriod(
      { startDate: '1900-01-01', endDate: '2200-01-01' },
      '2026-09-01',
    );
    expect(Object.keys(marks).length).toBeLessThan(50);
    expect(marks['2026-09-09']).toBeDefined();
  });
});
