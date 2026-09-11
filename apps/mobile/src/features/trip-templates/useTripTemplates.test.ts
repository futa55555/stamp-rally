import { createElement } from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useTripTemplates } from './useTripTemplates';
import type { TemplateGenre } from './types';

const native = vi.hoisted(() => ({
  client: { request: vi.fn(), sessionGuard: () => () => {} },
}));
vi.mock('../app-data/AppDataProvider', () => ({
  useData: () => ({ client: native.client, userId: 'viewer' }),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function deferred() {
  let resolve!: (value: { genres: TemplateGenre[] }) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<{ genres: TemplateGenre[] }>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const genres = (extra = false): TemplateGenre[] => [
  {
    name: '自然',
    stamps: [
      { title: '海を見る', sources: [{ type: 'location', name: '沖縄' }] },
      ...(extra
        ? [
            {
              title: '山を見る',
              sources: [{ type: 'activity' as const, name: '登山' }],
            },
          ]
        : []),
    ],
  },
];
let latest!: ReturnType<typeof useTripTemplates>;
let view: ReturnType<typeof create> | undefined;
function Probe({
  locations,
  activities = [],
  enabled = true,
}: {
  locations: string[];
  activities?: string[];
  enabled?: boolean;
}) {
  latest = useTripTemplates(enabled, locations, activities);
  return null;
}
const tick = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(250);
  });
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  native.client.request.mockReset().mockImplementation(({ url }) => {
    if (url === '/trip-templates/presets')
      return Promise.resolve({ locations: [], activities: [{ name: '海' }] });
    return Promise.resolve({ genres: genres() });
  });
});
afterEach(async () => {
  if (view) await act(async () => view!.unmount());
  view = undefined;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it('keeps choices during input changes and ignores delayed responses from older input', async () => {
  const first = deferred();
  const stale = deferred();
  const current = deferred();
  const requests = [first, stale, current];
  native.client.request.mockImplementation(({ url }) =>
    url.endsWith('/presets')
      ? Promise.resolve({ locations: [], activities: [] })
      : requests.shift()!.promise,
  );
  await act(async () => {
    view = create(createElement(Probe, { locations: ['沖縄'] }));
  });
  expect(latest.ready).toBe(false);
  await tick();
  await act(async () => first.resolve({ genres: genres() }));
  await act(async () => latest.toggleStamp('自然', '海を見る'));
  expect(latest.selection['["自然","海を見る"]']).toBe(false);
  await act(async () =>
    view!.update(createElement(Probe, { locations: ['北海道'] })),
  );
  expect(latest.pending).toBe(true);
  expect(latest.genres).toEqual(genres());
  expect(latest.selection['["自然","海を見る"]']).toBe(false);
  await tick();
  await act(async () =>
    view!.update(
      createElement(Probe, { locations: ['沖縄'], activities: ['登山'] }),
    ),
  );
  await tick();
  await act(async () => current.resolve({ genres: genres(true) }));
  expect(latest.ready).toBe(true);
  expect(latest.selection).toEqual({
    '["自然","海を見る"]': false,
    '["自然","山を見る"]': true,
  });
  await act(async () => stale.resolve({ genres: [] }));
  expect(latest.genres).toEqual(genres(true));
  expect(native.client.request).toHaveBeenLastCalledWith(
    expect.objectContaining({
      method: 'POST',
      url: '/trip-templates/preview',
      data: { locations: ['沖縄'], activityPresets: ['登山'] },
    }),
  );
});

it('retains selection after a failed preview and retries, then clears only after empty input resolves', async () => {
  await act(async () => {
    view = create(createElement(Probe, { locations: ['沖縄'] }));
  });
  await tick();
  await act(async () => latest.toggleGenre(genres()[0], false));
  native.client.request.mockRejectedValueOnce(new Error('通信失敗'));
  await act(async () =>
    view!.update(createElement(Probe, { locations: ['北海道'] })),
  );
  await tick();
  expect(latest.error).toBe('通信失敗');
  expect(latest.ready).toBe(false);
  expect(latest.selection['["自然","海を見る"]']).toBe(false);
  await act(async () => latest.retry());
  await tick();
  expect(latest.ready).toBe(true);
  expect(latest.selection['["自然","海を見る"]']).toBe(false);
  await act(async () => view!.update(createElement(Probe, { locations: [] })));
  expect(latest.ready).toBe(true);
  expect(latest.genres).toEqual([]);
  expect(latest.selection).toEqual({});
});

it('does not load templates for existing entities or send empty previews', async () => {
  await act(async () => {
    view = create(
      createElement(Probe, { locations: ['沖縄'], enabled: false }),
    );
  });
  await tick();
  expect(native.client.request).not.toHaveBeenCalled();
  await act(async () =>
    view!.update(createElement(Probe, { locations: ['  '] })),
  );
  await tick();
  expect(latest.ready).toBe(true);
  expect(native.client.request).toHaveBeenCalledTimes(1);
  expect(native.client.request.mock.calls[0][0].url).toBe(
    '/trip-templates/presets',
  );
});
