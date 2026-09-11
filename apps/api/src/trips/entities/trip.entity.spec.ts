import { calendarDate, InvalidTripError, Trip } from './trip.entity.js';

const makeTrip = (total = 0, completed = 0) =>
  new Trip(
    'trip',
    '秋旅行',
    '2026-09-07',
    '2026-09-10',
    'https://example.com/cover.jpg',
    'user',
    new Date(),
    new Date(),
    total,
    completed,
  );

describe('Trip', () => {
  it.each([
    '2026-02-29',
    '2026-04-31',
    '2026-13-01',
    '2026-00-01',
    '2026-09-00',
    '0000-01-01',
    '2026-9-07',
    '2026-09-07T00:00:00Z',
  ])('rejects invalid calendar date %s', (value) => {
    expect(() => calendarDate(value)).toThrow(InvalidTripError);
  });

  it('accepts a leap day and preserves dates without a timezone', () => {
    expect(calendarDate('2028-02-29').toISOString()).toBe(
      '2028-02-29T00:00:00.000Z',
    );
    const trip = makeTrip();
    expect(trip.toJSON().startDate).toBe('2026-09-07');
  });

  it('validates partial date changes against the existing other endpoint without mutating on failure', () => {
    const trip = makeTrip();
    expect(() => trip.update({ startDate: '2026-09-11' })).toThrow(
      InvalidTripError,
    );
    expect(trip.startDate).toBe('2026-09-07');
    expect(() => trip.update({ endDate: '2026-09-06' })).toThrow(
      InvalidTripError,
    );
    expect(trip.endDate).toBe('2026-09-10');
  });

  it('allows equal dates, trims names, and explicitly clears cover images', () => {
    const trip = makeTrip();
    trip.update({
      name: '  新しい旅行  ',
      endDate: '2026-09-07',
      coverImageUrl: null,
    });
    expect(trip.name).toBe('新しい旅行');
    expect(trip.coverImageUrl).toBeNull();
    expect(trip.endDate).toBe(trip.startDate);
  });

  it.each(['', '  ', 'あ'.repeat(101)])('rejects invalid names', (name) => {
    expect(() => makeTrip().update({ name })).toThrow(InvalidTripError);
  });

  it.each([null, 42, false, {}])(
    'rejects non-string names as domain errors',
    (name) => {
      expect(() =>
        makeTrip().update({ name: name as unknown as string }),
      ).toThrow(InvalidTripError);
    },
  );

  it.each([
    'http://example.com/cover.jpg',
    'javascript:alert(1)',
    '/cover.jpg',
    '',
    '  ',
    'https://example.com/' + 'a'.repeat(2048),
    42,
    false,
    {},
  ])('rejects an invalid cover without mutating the trip', (coverImageUrl) => {
    const trip = makeTrip();
    expect(() =>
      trip.update({ coverImageUrl: coverImageUrl as string }),
    ).toThrow(InvalidTripError);
    expect(trip.coverImageUrl).toBe('https://example.com/cover.jpg');
  });

  it('normalizes a cover URL, preserves it when omitted, and allows clearing it', () => {
    const trip = makeTrip();
    trip.update({ coverImageUrl: '  https://example.com/new.jpg  ' });
    expect(trip.coverImageUrl).toBe('https://example.com/new.jpg');
    trip.update({ name: '名前の変更' });
    expect(trip.coverImageUrl).toBe('https://example.com/new.jpg');
    trip.update({ coverImageUrl: null });
    expect(trip.coverImageUrl).toBeNull();
    expect(
      Trip.validate({
        name: '旅行',
        startDate: '2026-09-07',
        endDate: '2026-09-07',
      }).coverImageUrl,
    ).toBeNull();
  });

  it.each([
    [0, 0, false],
    [1, 0, false],
    [2, 1, false],
    [2, 2, true],
  ] as const)(
    'derives completion for %i genres, %i completed',
    (total, completed, expected) => {
      expect(makeTrip(total, completed).toJSON().isCompleted).toBe(expected);
    },
  );

  it('normalizes activity metadata while retaining user order and repeated text', () => {
    const result = Trip.validate({
      name: '旅行',
      startDate: '2026-09-07',
      endDate: '2026-09-07',
      activityPresets: [' 海 ', '', '海', '温泉'],
      customActivities: [' 友達に会う ', ' '],
    });
    expect(result.activityPresets).toEqual(['海', '海', '温泉']);
    expect(result.customActivities).toEqual(['友達に会う']);
    const defaults = Trip.validate({
      name: '旅行',
      startDate: '2026-09-07',
      endDate: '2026-09-07',
    });
    expect(defaults.activityPresets).toEqual([]);
    expect(defaults.customActivities).toEqual([]);
  });

  it.each(['activityPresets', 'customActivities'] as const)(
    'rejects malformed %s values even without HTTP validation',
    (field) => {
      for (const value of [null, '海', [null], [1], ['あ'.repeat(101)]]) {
        expect(() =>
          Trip.validate({
            name: '旅行',
            startDate: '2026-09-07',
            endDate: '2026-09-07',
            [field]: value,
          }),
        ).toThrow(InvalidTripError);
      }
    },
  );

  it('preserves saved activities when existing trip fields are edited', () => {
    const trip = makeTrip();
    trip.activityPresets.push('海');
    trip.customActivities.push('友達に会う');
    trip.update({ name: '新しい名前', locations: ['京都'] });
    expect(trip.toJSON()).toMatchObject({
      name: '新しい名前',
      locations: ['京都'],
      activityPresets: ['海'],
      customActivities: ['友達に会う'],
    });
  });
});
