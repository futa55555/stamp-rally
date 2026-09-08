import { describe, expect, it } from 'vitest';
import { createDemoData } from '../../app-data/mocks/fixtures';
import { groupTrips } from './selectors';

const base = createDemoData(new Date(2026, 8, 9)).trips[0];
const trip = (
  id: string,
  startDate: string,
  endDate: string,
  createdAt = base.createdAt,
) => ({ ...base, id, startDate, endDate, createdAt });
const ids = (trips: ReturnType<typeof trip>[]) => trips.map((t) => t.id);

describe('trip sections', () => {
  it('includes both boundary days and a one-day trip in active trips', () => {
    const grouped = groupTrips(
      [
        trip('start', '2026-09-09', '2026-09-12'),
        trip('end', '2026-09-07', '2026-09-09'),
        trip('same', '2026-09-09', '2026-09-09'),
        trip('future', '2026-09-10', '2026-09-10'),
        trip('past', '2026-09-08', '2026-09-08'),
      ],
      '2026-09-09',
    );
    expect(ids(grouped.active)).toEqual(['start', 'same', 'end']);
    expect(ids(grouped.upcoming)).toEqual(['future']);
    expect(ids(grouped.past)).toEqual(['past']);
  });
  it('sorts upcoming by ascending start then end, with creation and ID tie breaks', () => {
    const input = [
      trip('later', '2027-01-01', '2027-01-02'),
      trip('long', '2026-12-31', '2027-01-03'),
      trip('a', '2026-12-31', '2027-01-02'),
      trip('b', '2026-12-31', '2027-01-02'),
      trip('newer', '2026-12-31', '2027-01-02', '2030-01-01'),
    ];
    expect(ids(groupTrips(input, '2026-09-09').upcoming)).toEqual([
      'newer',
      'b',
      'a',
      'long',
      'later',
    ]);
    expect(input[0].id).toBe('later');
  });
  it('sorts past by descending end then start, with creation and ID tie breaks', () => {
    const input = [
      trip('old', '2025-12-30', '2025-12-31'),
      trip('long', '2025-12-29', '2026-01-01'),
      trip('a', '2025-12-31', '2026-01-01'),
      trip('b', '2025-12-31', '2026-01-01'),
      trip('newer', '2025-12-31', '2026-01-01', '2030-01-01'),
    ];
    expect(ids(groupTrips(input, '2026-09-09').past)).toEqual([
      'newer',
      'b',
      'a',
      'long',
      'old',
    ]);
  });
  it('sorts active by descending start even when an older start was created later', () => {
    expect(
      ids(
        groupTrips(
          [
            trip('older-start', '2026-09-01', '2026-09-12', '2030-01-01'),
            trip('recent-start', '2026-09-08', '2026-09-12'),
          ],
          '2026-09-09',
        ).active,
      ),
    ).toEqual(['recent-start', 'older-start']);
    expect(groupTrips([], '2026-09-09')).toEqual({
      active: [],
      upcoming: [],
      past: [],
    });
  });
});
