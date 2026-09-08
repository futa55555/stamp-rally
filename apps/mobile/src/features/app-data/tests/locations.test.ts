import { describe, expect, it } from 'vitest';
import { DEMO_USER_ID, createDemoData } from '../mocks/fixtures';
import { createMockService } from '../mocks/service';
import { initialState, reducer } from '../model/reducer';

describe('trip destinations', () => {
  it('normalizes create/update input and preserves order in both stores', async () => {
    const data = createDemoData();
    const service = createMockService(data, 0);
    const locations = ['  京都  ', '', ' \n ', '奈良', '京都'];
    const trip = await service.createTrip(DEMO_USER_ID, {
      ...data.trips[0],
      locations,
    });
    let state = reducer(
      { ...initialState, data },
      { type: 'tripSaved', trip, memberId: DEMO_USER_ID },
    );
    expect(trip.locations).toEqual(['京都', '奈良', '京都']);
    expect(locations).toEqual(['  京都  ', '', ' \n ', '奈良', '京都']);
    const updated = await service.updateTrip(DEMO_USER_ID, trip.id, {
      ...trip,
      locations: [' 大阪 ', '神戸'],
    });
    state = reducer(state, { type: 'tripSaved', trip: updated });
    expect(state.data!.trips.find((t) => t.id === trip.id)?.locations).toEqual([
      '大阪',
      '神戸',
    ]);
    expect(state.data).toEqual(await service.load());
    const removed = await service.updateTrip(DEMO_USER_ID, trip.id, {
      ...updated,
      locations: [],
    });
    expect(removed.locations).toEqual([]);
    expect(trip.locations).toEqual(['京都', '奈良', '京都']);
  });
  it('loads old records without destinations as an empty array', async () => {
    const data = createDemoData();
    Reflect.deleteProperty(data.trips[0], 'locations');
    expect(
      (await createMockService(data, 0).load()).trips[0].locations,
    ).toEqual([]);
    expect(
      reducer(initialState, { type: 'loaded', data }).data!.trips[0].locations,
    ).toEqual([]);
  });
});
