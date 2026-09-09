import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  uploadCover,
  type CoverDraft,
  type CoverUploadStatus,
} from './CoverUpload';

vi.mock('../app-data/api/queries', () => ({
  resourceKey: (user: string, path: string) => ['user', user, path, {}],
}));
const caches: QueryClient[] = [];
afterEach(() => {
  for (const cache of caches) cache.clear();
  caches.length = 0;
});
function setup() {
  const cache = new QueryClient({
    defaultOptions: { queries: { staleTime: 30000, retry: false } },
  });
  caches.push(cache);
  const status: CoverUploadStatus = {
    id: 'cover',
    status: 'PENDING',
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    errorCode: null,
    upload: {
      url: 'https://upload.test/image',
      expiresAt: new Date(Date.now() + 900000).toISOString(),
    },
  };
  const request = vi.fn(
    async ({ method, url }: { method?: string; url?: string }) => {
      if (url?.endsWith('/complete')) status.status = 'PROCESSING';
      else if (!method && status.status === 'PROCESSING')
        status.status = 'READY';
      return { ...status };
    },
  );
  const guard = vi.fn();
  const controller = new AbortController();
  const draft: CoverDraft = {
    uri: 'file:///crop.png',
    byteSize: 100,
    clientRequestId: 'request',
  };
  return {
    draft,
    cache,
    client: { request, sessionGuard: () => guard } as unknown as Parameters<
      typeof uploadCover
    >[0]['client'],
    request,
    guard,
    controller,
    signal: controller.signal,
    status,
    userId: 'viewer',
    transfer: vi.fn(async () => {}),
    progress: vi.fn(),
    newRequestId: () => 'next-request',
    delay: vi.fn(async () => {}),
  };
}
describe('cover save upload', () => {
  it('uploads once, invalidates processing status, and reuses a ready asset on save retry', async () => {
    const input = setup();
    const invalidate = vi.spyOn(input.cache, 'invalidateQueries');
    expect(await uploadCover(input)).toBe('cover');
    expect(await uploadCover(input)).toBe('cover');
    expect(input.transfer).toHaveBeenCalledTimes(1);
    expect(
      input.request.mock.calls.filter(
        ([req]) => req.method === 'POST' && req.url === '/uploads/covers',
      ),
    ).toHaveLength(1);
    expect(invalidate).toHaveBeenCalled();
  });
  it('keeps the same request ID after an ambiguous create response failure', async () => {
    const input = setup();
    input.request.mockRejectedValueOnce(new Error('network'));
    await expect(uploadCover(input)).rejects.toThrow('network');
    await uploadCover(input);
    expect(input.request.mock.calls[0][0]).toEqual(
      input.request.mock.calls[1][0],
    );
  });
  it('resumes processing without uploading again when the completion response was lost', async () => {
    const input = setup();
    input.draft.assetId = 'cover';
    input.status.status = 'PROCESSING';
    expect(await uploadCover(input)).toBe('cover');
    expect(input.transfer).not.toHaveBeenCalled();
  });
  it('does not complete or publish an upload after cancellation or a session change', async () => {
    const input = setup();
    input.transfer.mockImplementation(async () => {
      input.controller.abort();
    });
    await expect(uploadCover(input)).rejects.toThrow('中断');
    expect(
      input.request.mock.calls.some(([req]) => req.url?.endsWith('/complete')),
    ).toBe(false);
    const other = setup();
    other.transfer.mockImplementation(async () => {
      other.guard.mockImplementation(() => {
        throw new Error('Session changed');
      });
    });
    await expect(uploadCover(other)).rejects.toThrow('Session changed');
    expect(
      other.request.mock.calls.some(([req]) => req.url?.endsWith('/complete')),
    ).toBe(false);
  });
  it('releases failed drafts and assigns a new upload identity for the next save', async () => {
    const input = setup();
    input.draft.assetId = 'cover';
    input.status.status = 'FAILED';
    await expect(uploadCover(input)).rejects.toThrow('準備できません');
    expect(input.draft).toMatchObject({
      assetId: undefined,
      clientRequestId: 'next-request',
    });
  });
});
