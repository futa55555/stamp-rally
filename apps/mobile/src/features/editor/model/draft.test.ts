import { describe, expect, it } from 'vitest';
import { DEMO_USER_ID, createDemoData } from '../../app-data/mocks/fixtures';
import { initializePostDraft, selectPostScope } from './draft';

describe('contextual post drafts', () => {
  const data = createDemoData();
  const stamp = data.stamps[0];
  const category = data.categories.find((g) => g.id === stamp.categoryIds[0])!;
  const tripId = category.tripId;

  it('fills exactly the known hierarchy from each entry point', () => {
    expect(initializePostDraft(data, DEMO_USER_ID, { tripId })).toEqual({
      tripId,
      categoryId: undefined,
      stampId: undefined,
      mediaUrls: [],
    });
    expect(
      initializePostDraft(data, DEMO_USER_ID, { categoryId: category.id }),
    ).toMatchObject({ tripId, categoryId: category.id, stampId: undefined });
    expect(
      initializePostDraft(data, DEMO_USER_ID, { stampId: stamp.id }),
    ).toMatchObject({ tripId, categoryId: category.id, stampId: stamp.id });
  });

  it('clears descendant selections while preserving photos, including inline creation', () => {
    const draft = {
      ...initializePostDraft(data, DEMO_USER_ID, { stampId: stamp.id }),
      mediaUrls: ['file:///a.jpg', 'file:///b.jpg'],
    };
    expect(selectPostScope(draft, 'tripId', tripId)).toBe(draft);
    const otherTrip = selectPostScope(draft, 'tripId', 'new-trip');
    expect(otherTrip).toEqual({
      tripId: 'new-trip',
      categoryId: undefined,
      stampId: undefined,
      mediaUrls: draft.mediaUrls,
    });
    const newCategory = selectPostScope(
      otherTrip,
      'categoryId',
      'created-category',
    );
    const newStamp = selectPostScope(newCategory, 'stampId', 'created-stamp');
    expect(newStamp).toEqual({
      tripId: 'new-trip',
      categoryId: 'created-category',
      stampId: 'created-stamp',
      mediaUrls: draft.mediaUrls,
    });
    expect(draft.stampId).toBe(stamp.id);
  });

  it('rejects malformed, missing and inaccessible route context', () => {
    expect(() =>
      initializePostDraft(data, DEMO_USER_ID, {
        stampId: stamp.id,
        categoryId: 'wrong',
      }),
    ).toThrow('一致');
    expect(() =>
      initializePostDraft(data, DEMO_USER_ID, {
        stampId: stamp.id,
        tripId: 'wrong',
      }),
    ).toThrow('一致');
    expect(() =>
      initializePostDraft(data, DEMO_USER_ID, { stampId: 'missing' }),
    ).toThrow();
    expect(() => initializePostDraft(data, 'outsider', { tripId })).toThrow();
  });
});
