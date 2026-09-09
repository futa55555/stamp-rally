import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LocalUpload, PendingBatch, UploadStatus } from './model';
import { UploadList } from './UploadList';

const native = vi.hoisted(() => ({
  uploads: vi.fn(),
  retry: vi.fn(),
  dismiss: vi.fn(),
  cancel: vi.fn(),
}));
vi.mock('react-native', () => ({
  View: 'View',
  ActivityIndicator: 'ActivityIndicator',
}));
vi.mock('../../shared/theme/ThemeProvider', () => ({
  useAppTheme: () => ({ colors: { primary: 'primary' } }),
}));
vi.mock('./UploadProvider', () => ({ useUploads: native.uploads }));
vi.mock('../photos/ui/SelectedMediaGrid', () => ({
  SelectedMediaGrid: 'SelectedMediaGrid',
}));
vi.mock('../../shared/ui/AppText', () => ({ AppText: 'AppText' }));
vi.mock('../../shared/ui/Button', () => ({ Button: 'Button' }));
vi.mock('../../shared/ui/ErrorMessage', () => ({
  ErrorMessage: 'ErrorMessage',
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const file = (
  clientId: string,
  status: UploadStatus = 'PENDING',
): LocalUpload => ({
  clientId,
  status,
  uri: `file:///private/${clientId}`,
  fileName: `${clientId}.jpg`,
  byteSize: 100,
  mimeType: 'image/jpeg',
  mediaType: 'IMAGE',
  progress: 0.5,
});
const batch = (
  clientRequestId: string,
  files: LocalUpload[],
  stampId = 'stamp',
): PendingBatch => ({
  clientRequestId,
  files,
  stampId,
  userId: 'user',
  createdAt: 0,
});
let view: ReactTestRenderer | undefined;
let batches: PendingBatch[];
const buttons = () => view!.root.findAllByType('Button' as never);
const previews = () => view!.root.findAllByType('SelectedMediaGrid' as never);
const spinners = () => view!.root.findAllByType('ActivityIndicator' as never);
const labels = () =>
  view!.root
    .findAllByType('AppText' as never)
    .map((node) => [node.props.children].flat().join(''));
const error = () =>
  view!.root.findByType('ErrorMessage' as never).props.message;

beforeEach(() => {
  vi.resetAllMocks();
  const originalError = console.error;
  vi.spyOn(console, 'error').mockImplementation((...args) => {
    if (String(args[0]).startsWith('react-test-renderer is deprecated')) return;
    originalError(...args);
  });
  batches = [];
  native.retry.mockResolvedValue(undefined);
  native.dismiss.mockResolvedValue(undefined);
  native.uploads.mockImplementation(() => ({
    manager: {
      retry: native.retry,
      dismiss: native.dismiss,
      cancel: native.cancel,
    },
    batches,
    error: null,
  }));
});

afterEach(async () => {
  await act(async () => view?.unmount());
  view = undefined;
  vi.restoreAllMocks();
});

async function render(props: Parameters<typeof UploadList>[0] = {}) {
  await act(async () => {
    const element = createElement(UploadList, props);
    if (view) view.update(element);
    else view = create(element);
  });
}

describe('upload progress', () => {
  it('shows one published count for the selected stamp and no per-file progress or cancel controls', async () => {
    batches = [
      batch('one', [file('ready', 'READY'), file('processing', 'PROCESSING')]),
      batch('two', [file('pending')]),
      batch('unrelated', [file('other', 'READY')], 'other-stamp'),
    ];
    await render({ stampId: 'stamp' });
    expect(labels()).toEqual([
      'アップロード',
      '投稿完了 1 / 3',
      'このページを離れても、投稿は続きます。',
    ]);
    expect(previews()).toHaveLength(0);
    expect(buttons()).toHaveLength(0);
    expect(spinners()).toHaveLength(1);
    batches[0].files[1].status = 'READY';
    await render({ stampId: 'stamp' });
    expect(labels()).toContain('投稿完了 2 / 3');
    await render({ stampId: 'stamp', batchId: 'two' });
    expect(labels()).toEqual([
      'アップロード',
      '投稿完了 0 / 1',
      'このページを離れても、投稿は続きます。',
    ]);
  });

  it('shows only failed local media and retries them together without retrying successful or active files', async () => {
    const failedPhoto = file('photo', 'FAILED');
    const failedVideo: LocalUpload = {
      ...file('video'),
      uri: 'file:///private/video.mp4',
      mimeType: 'video/mp4',
      mediaType: 'VIDEO',
      error: '送信できませんでした。',
    };
    batches = [
      batch('mixed', [
        file('ready', 'READY'),
        failedPhoto,
        failedVideo,
        file('pending'),
      ]),
    ];
    await render();
    expect(labels()).toContain('投稿完了 1 / 4');
    expect(labels()).toContain('投稿に失敗した写真・動画');
    expect(previews()[0].props.files).toEqual([failedPhoto, failedVideo]);
    expect(spinners()).toHaveLength(1);
    expect(buttons().map((button) => button.props.label)).toEqual(['再試行']);
    await act(async () => buttons()[0].props.onPress());
    expect(native.retry.mock.calls).toEqual([
      ['mixed', 'photo'],
      ['mixed', 'video'],
    ]);
    expect(native.cancel).not.toHaveBeenCalled();
    failedPhoto.status = 'PROCESSING';
    failedVideo.error = undefined;
    await render();
    expect(previews()).toHaveLength(0);
    expect(buttons()).toHaveLength(0);
  });

  it('attempts every failed media retry even if one request fails', async () => {
    batches = [batch('mixed', [file('one', 'FAILED'), file('two', 'FAILED')])];
    let rejectRetry!: (cause: Error) => void;
    native.retry.mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectRetry = reject;
      }),
    );
    await render();
    expect(spinners()).toHaveLength(0);
    expect(labels()).not.toContain('このページを離れても、投稿は続きます。');
    await act(async () => buttons()[0].props.onPress());
    expect(buttons()[0].props.disabled).toBe(true);
    expect(spinners()).toHaveLength(1);
    expect(labels()).toContain('このページを離れても、投稿は続きます。');
    expect(native.retry).toHaveBeenCalledTimes(2);
    await act(async () => rejectRetry(new Error('再接続してください。')));
    expect(error()).toBe('再接続してください。');
    expect(buttons()[0].props.disabled).toBe(false);
    expect(spinners()).toHaveLength(0);
    expect(labels()).not.toContain('このページを離れても、投稿は続きます。');
    expect(previews()[0].props.files).toHaveLength(2);
  });

  it('retries connection errors once per batch without marking every photo as failed', async () => {
    batches = [
      {
        ...batch('offline', [file('one'), file('two')]),
        error: '接続できません。',
      },
      batch('failed', [file('three', 'FAILED')]),
    ];
    await render();
    expect(error()).toBe('接続できません。');
    expect(spinners()).toHaveLength(0);
    expect(
      previews()[0].props.files.map((entry: LocalUpload) => entry.clientId),
    ).toEqual(['three']);
    expect(buttons()).toHaveLength(1);
    await act(async () => buttons()[0].props.onPress());
    expect(native.retry.mock.calls).toEqual([
      ['offline', undefined],
      ['failed', 'three'],
    ]);
  });

  it('ignores old cancelled items and stale errors on successful or cancelling files', async () => {
    batches = [
      batch('old', [
        { ...file('ready', 'READY'), error: 'stale error' },
        file('cancelled', 'CANCELLED'),
        {
          ...file('cancelling'),
          cancelRequested: true,
          error: 'cancel pending',
        },
      ]),
    ];
    await render();
    expect(labels()).toEqual(['アップロード', '投稿完了 1 / 2']);
    expect(previews()).toHaveLength(0);
    expect(buttons()).toHaveLength(0);
    expect(spinners()).toHaveLength(0);
  });

  it('keeps one local-record dismissal for inaccessible batches without offering retry or cancel', async () => {
    batches = [
      {
        ...batch('gone-one', [file('one')]),
        unavailable: true,
        error: '旅行が見つかりません。',
      },
      { ...batch('gone-two', [file('two', 'FAILED')]), unavailable: true },
    ];
    await render();
    expect(buttons().map((button) => button.props.label)).toEqual([
      'この端末の送信記録を消す',
    ]);
    expect(spinners()).toHaveLength(0);
    await act(async () => buttons()[0].props.onPress());
    expect(native.dismiss.mock.calls).toEqual([['gone-one'], ['gone-two']]);
    expect(native.retry).not.toHaveBeenCalled();
    expect(native.cancel).not.toHaveBeenCalled();
  });

  it('hides completed batches and still surfaces upload recovery errors', async () => {
    await render();
    expect(view!.toJSON()).toBeNull();
    native.uploads.mockReturnValue({
      manager: null,
      batches: [],
      error: '送信状況を復元できませんでした。',
    });
    await render();
    expect(error()).toBe('送信状況を復元できませんでした。');
    expect(labels()).toEqual(['アップロード']);
    expect(buttons()).toHaveLength(0);
  });
});
