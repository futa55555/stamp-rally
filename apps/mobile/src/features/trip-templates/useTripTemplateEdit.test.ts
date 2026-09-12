import { createElement } from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useTripTemplateEdit } from './useTripTemplateEdit';
import type { TemplateEditPreview } from './edit-types';
const native = vi.hoisted(() => ({
  client: { request: vi.fn(), sessionGuard: () => () => {} },
  confirm: vi.fn(),
}));
vi.mock('../app-data/AppDataProvider', () => ({
  useData: () => ({ client: native.client, userId: 'viewer' }),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const preview = (
  selected = true,
  token = 'original',
  postCount = 1,
): TemplateEditPreview => ({
  categories: [
    {
      ref: 'category',
      id: 'category',
      name: '景色',
      selected,
      stamps: [
        {
          ref: 'stamp',
          id: 'stamp',
          name: '海',
          selected,
          manual: false,
          sources: [],
          retained: selected,
          protectedCount: postCount,
          postCount,
        },
      ],
    },
  ],
  impact: { stampCount: selected ? 0 : 1, postCount: selected ? 0 : postCount },
  confirmationToken: token,
});
let latest!: ReturnType<typeof useTripTemplateEdit>;
let view: ReturnType<typeof create> | undefined;
function Probe({ locations = ['沖縄'] }: { locations?: string[] }) {
  latest = useTripTemplateEdit('trip', locations, [], native.confirm);
  return null;
}
async function mount() {
  await act(async () => {
    view = create(createElement(Probe));
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(250);
  });
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  native.client.request.mockReset().mockResolvedValue(preview());
  native.confirm.mockReset().mockResolvedValue(true);
});
afterEach(async () => {
  if (view) await act(async () => view!.unmount());
  view = undefined;
  vi.useRealTimers();
  vi.restoreAllMocks();
});
const change = { categoryRef: 'category', stampRef: 'stamp', selected: false };

it('retains the server-protected selection after removing a source and ignores obsolete responses', async () => {
  await mount();
  let resolve!: (value: TemplateEditPreview) => void;
  native.client.request.mockImplementationOnce(
    () =>
      new Promise<TemplateEditPreview>((yes) => {
        resolve = yes;
      }),
  );
  await act(async () =>
    view!.update(createElement(Probe, { locations: ['北海道'] })),
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(250);
  });
  await act(async () => view!.update(createElement(Probe, { locations: [] })));
  expect(latest.ready).toBe(false);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(250);
  });
  expect(latest.categories[0].stamps[0]).toMatchObject({
    selected: true,
    retained: true,
  });
  await act(async () => resolve(preview(false)));
  expect(latest.categories[0].stamps[0].selected).toBe(true);
  expect(latest.ready).toBe(true);
});

it('keeps deselection as a draft only after confirmation and rechecks changed impact before saving', async () => {
  await mount();
  native.client.request.mockResolvedValue(preview(false, 'confirmed', 1));
  native.confirm.mockResolvedValueOnce(false);
  await act(async () => latest.toggle(change));
  expect(latest.dirty).toBe(false);
  expect(latest.categories[0].stamps[0].selected).toBe(true);
  await act(async () => latest.toggle(change));
  expect(latest.dirty).toBe(true);
  let input;
  await act(async () => {
    input = await latest.prepare('request');
  });
  expect(input).toEqual({
    clientRequestId: 'request',
    changes: [change],
    confirmationToken: 'confirmed',
  });
  expect(native.confirm).toHaveBeenCalledTimes(2);
  native.client.request.mockResolvedValue(preview(false, 'changed', 2));
  native.confirm.mockResolvedValueOnce(false);
  await act(async () => {
    input = await latest.prepare('request');
  });
  expect(input).toBeNull();
  expect(latest.dirty).toBe(true);
  expect(native.confirm).toHaveBeenLastCalledWith(
    expect.objectContaining({ impact: { stampCount: 1, postCount: 2 } }),
  );
  expect(
    native.client.request.mock.calls.every(([request]) =>
      request.url.endsWith('/template-preview'),
    ),
  ).toBe(true);
});

it('retains a confirmed draft after a failed request and can retry without resetting it', async () => {
  await mount();
  native.client.request.mockResolvedValue(preview(false, 'confirmed'));
  await act(async () => latest.toggle(change));
  native.client.request.mockRejectedValueOnce(new Error('通信失敗'));
  await act(async () => {
    await expect(latest.prepare('request')).rejects.toThrow('通信失敗');
  });
  expect(latest.categories[0].stamps[0].selected).toBe(false);
  expect(latest.dirty).toBe(true);
  await act(async () => {
    expect(await latest.prepare('request')).toMatchObject({
      changes: [change],
    });
  });
});

it('does not apply a delayed confirmation after the input changes', async () => {
  await mount();
  native.client.request.mockResolvedValue(preview(false));
  let confirm!: (value: boolean) => void;
  native.confirm.mockImplementation(
    () =>
      new Promise<boolean>((yes) => {
        confirm = yes;
      }),
  );
  let pending!: Promise<void>;
  await act(async () => {
    pending = latest.toggle(change);
  });
  await act(async () => view!.update(createElement(Probe, { locations: [] })));
  await act(async () => {
    confirm(true);
    await pending;
  });
  expect(latest.dirty).toBe(false);
});
