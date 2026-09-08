import { describe, expect, it } from 'vitest';
import { selectPhotos } from '../../photos/model/selectors';
import { DEMO_USER_ID, createDemoData } from '../mocks/fixtures';
import { createMockService } from '../mocks/service';
import { initialState, reducer } from '../model/reducer';

describe('post deletion', () => {
  it('lets a trip member delete another member’s photo and removes its dependent data from both stores', async () => {
    const initial = createDemoData();
    const post = initial.posts[0];
    const otherPost = initial.posts[1];
    initial.readPhotoIds = {
      [DEMO_USER_ID]: [post.id, otherPost.id],
      [initial.users[1].id]: [post.id],
    };
    const service = createMockService(initial, 0);
    expect(post.author.id).not.toBe(DEMO_USER_ID);
    expect(post.isFavorite).toBe(true);

    await service.deletePost(DEMO_USER_ID, post.id);
    const state = reducer(
      { ...initialState, data: initial, userId: DEMO_USER_ID },
      { type: 'postDeleted', postId: post.id },
    );
    const data = state.data!;

    expect(data).toEqual(await service.load());
    expect(data.posts).toEqual(initial.posts.filter((p) => p.id !== post.id));
    expect(
      selectPhotos(data, { tripId: post.tripId }, true).map((p) => p.id),
    ).not.toContain(post.id);
    expect(data.readPhotoIds).toEqual({
      [DEMO_USER_ID]: [otherPost.id],
      [initial.users[1].id]: [],
    });
    expect(data.notifications).toEqual(
      initial.notifications.filter(
        ({ target }) => target.type !== 'photo' || target.postId !== post.id,
      ),
    );
    expect(data.notifications).toHaveLength(initial.notifications.length - 1);
    expect(data.stamps.find((s) => s.id === post.stampId)?.isCompleted).toBe(
      true,
    );
    expect(initial.posts).toContain(post);
    expect(initial.readPhotoIds[DEMO_USER_ID]).toContain(post.id);
    await service.signOut();
    await service.signIn('google');
    expect(await service.load()).toEqual(data);
  });

  it('recalculates completion through the trip when its last post is deleted', async () => {
    const initial = createDemoData();
    const post = initial.posts[5];
    const service = createMockService(initial, 0);
    expect(initial.trips.find((t) => t.id === post.tripId)?.isCompleted).toBe(
      true,
    );

    await service.deletePost(DEMO_USER_ID, post.id);
    const state = reducer(
      { ...initialState, data: initial, userId: DEMO_USER_ID },
      { type: 'postDeleted', postId: post.id },
    );
    const data = state.data!;

    expect(data).toEqual(await service.load());
    expect(selectPhotos(data, { stampId: post.stampId })).toEqual([]);
    expect(data.stamps.find((s) => s.id === post.stampId)?.isCompleted).toBe(
      false,
    );
    expect(data.genres.find((g) => g.id === post.genreId)).toMatchObject({
      totalStampCount: 1,
      completedStampCount: 0,
      isCompleted: false,
    });
    expect(data.trips.find((t) => t.id === post.tripId)).toMatchObject({
      totalGenreCount: 1,
      completedGenreCount: 0,
      isCompleted: false,
    });
    await expect(service.deletePost(DEMO_USER_ID, post.id)).rejects.toThrow();
    expect(await service.load()).toEqual(data);
  });

  it('rejects nonmembers, missing users, and missing posts without changing data', async () => {
    const initial = createDemoData();
    const post = initial.posts.find((p) => p.author.id === DEMO_USER_ID)!;
    initial.memberships = initial.memberships.filter(
      (m) => m.userId !== DEMO_USER_ID || m.tripId !== post.tripId,
    );
    const service = createMockService(initial, 0);

    await expect(service.deletePost(DEMO_USER_ID, post.id)).rejects.toThrow(
      '旅行が見つからないか、参加していません。',
    );
    await expect(service.deletePost('missing-user', post.id)).rejects.toThrow();
    await expect(
      service.deletePost(initial.users[1].id, 'missing-post'),
    ).rejects.toThrow();
    expect(await service.load()).toEqual(initial);
  });

  it('ignores an in-flight read acknowledgement received after deletion', () => {
    const data = createDemoData();
    const deleted = data.posts[0];
    const retained = data.posts[2];
    const afterDelete = reducer(
      { ...initialState, data, userId: DEMO_USER_ID },
      { type: 'postDeleted', postId: deleted.id },
    );

    const afterLateRead = reducer(afterDelete, {
      type: 'photoRead',
      userId: DEMO_USER_ID,
      postId: deleted.id,
    });

    expect(afterLateRead).toBe(afterDelete);
    expect(afterLateRead.data!.readPhotoIds[DEMO_USER_ID]).not.toContain(
      deleted.id,
    );
    const afterRetainedRead = reducer(afterLateRead, {
      type: 'photoRead',
      userId: DEMO_USER_ID,
      postId: retained.id,
    });
    expect(afterRetainedRead.data!.readPhotoIds[DEMO_USER_ID]).toContain(
      retained.id,
    );
  });
});
