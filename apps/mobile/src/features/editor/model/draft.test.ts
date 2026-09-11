import { describe, expect, it } from 'vitest';
import { DEMO_USER_ID, createDemoData } from '../../app-data/mocks/fixtures';
import { initializePostDraft, selectPostScope } from './draft';

describe('contextual post drafts', () => {
  const data = createDemoData();
  const stamp = data.stamps[0];
  const genre = data.genres.find((g) => g.id === stamp.genreIds[0])!;
  const tripId = genre.tripId;

  it('fills exactly the known hierarchy from each entry point', () => {
    expect(initializePostDraft(data, DEMO_USER_ID, { tripId })).toEqual({
      tripId,
      genreId: undefined,
      stampId: undefined,
      mediaUrls: [],
    });
    expect(
      initializePostDraft(data, DEMO_USER_ID, { genreId: genre.id }),
    ).toMatchObject({ tripId, genreId: genre.id, stampId: undefined });
    expect(
      initializePostDraft(data, DEMO_USER_ID, { stampId: stamp.id }),
    ).toMatchObject({ tripId, genreId: genre.id, stampId: stamp.id });
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
      genreId: undefined,
      stampId: undefined,
      mediaUrls: draft.mediaUrls,
    });
    const newGenre = selectPostScope(otherTrip, 'genreId', 'created-genre');
    const newStamp = selectPostScope(newGenre, 'stampId', 'created-stamp');
    expect(newStamp).toEqual({
      tripId: 'new-trip',
      genreId: 'created-genre',
      stampId: 'created-stamp',
      mediaUrls: draft.mediaUrls,
    });
    expect(draft.stampId).toBe(stamp.id);
  });

  it('rejects malformed, missing and inaccessible route context', () => {
    expect(() =>
      initializePostDraft(data, DEMO_USER_ID, {
        stampId: stamp.id,
        genreId: 'wrong',
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
