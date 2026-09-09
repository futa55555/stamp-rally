import { createElement, useSyncExternalStore } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PickedMedia } from '../../features/photos/model/inputs';
import { UploadManager } from '../../features/uploads/UploadManager';
import type {
  PendingBatch,
  UploadBatch,
  UploadStatus,
} from '../../features/uploads/model';
import { PostEditorScreen } from './PostEditorScreen';

const native = vi.hoisted(() => ({
  params: vi.fn(),
  focused: vi.fn(),
  finish: vi.fn(),
  uploads: vi.fn(),
  picker: vi.fn(),
}));
vi.mock('expo-router', () => ({
  useLocalSearchParams: native.params,
  useIsFocused: native.focused,
}));
vi.mock('react-native', () => ({ View: 'View' }));
vi.mock('../../features/app-data/AppDataProvider', () => ({
  useData: () => ({ userId: 'user' }),
}));
vi.mock('../../features/app-data/api/queries', () => ({
  useList: () => ({ data: [], error: null }),
}));
vi.mock('../../features/editor/EditorProvider', () => ({
  useEditor: () => ({ finish: native.finish, finishing: false }),
}));
vi.mock('../../features/editor/hooks/useEditorGuard', () => ({
  useEditorGuard: vi.fn(),
}));
vi.mock('../../features/editor/ui/FormPage', () => ({ FormPage: 'FormPage' }));
vi.mock('../../features/photos/hooks/usePhotoPicker', () => ({
  usePhotoPicker: native.picker,
}));
vi.mock('../../features/uploads/UploadProvider', () => ({
  useUploads: native.uploads,
}));
vi.mock('../../features/uploads/UploadList', () => ({
  UploadList: 'UploadList',
}));
vi.mock('../../shared/ui/AppText', () => ({ AppText: 'AppText' }));
vi.mock('../../shared/ui/Button', () => ({ Button: 'Button' }));
vi.mock('../../shared/ui/IconButton', () => ({ IconButton: 'IconButton' }));
vi.mock('../../shared/ui/SelectField', () => ({ SelectField: 'SelectField' }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const photo = (id: string): PickedMedia => ({
  clientId: id,
  uri: `file:///picker/${id}`,
  fileName: `${id}.jpg`,
  mimeType: 'image/jpeg',
  byteSize: 100,
  mediaType: 'IMAGE',
});
let view: ReactTestRenderer | undefined;
let manager: UploadManager;
let pick: (files: PickedMedia[]) => void;
let initialStatus: UploadStatus;
let request: ReturnType<typeof vi.fn>;
const form = () => view!.root.findByType('FormPage' as never);

beforeEach(async () => {
  vi.resetAllMocks();
  const originalError = console.error;
  vi.spyOn(console, 'error').mockImplementation((...args) => {
    if (String(args[0]).startsWith('react-test-renderer is deprecated')) return;
    originalError(...args);
  });
  native.params.mockReturnValue({ stampId: 'stamp' });
  native.focused.mockReturnValue(true);
  native.finish.mockResolvedValue(undefined);
  native.picker.mockImplementation((accept) => {
    pick = accept;
    return { pending: false, error: null, library: vi.fn(), camera: vi.fn() };
  });
  const server = new Map<string, UploadBatch>();
  let key = 0;
  initialStatus = 'PENDING';
  request = vi.fn(async (method: string, url: string, data?: unknown) => {
    if (url === '/uploads/batches') {
      const input = data as { clientRequestId: string; files: PickedMedia[] };
      const batch: UploadBatch = {
        id: input.clientRequestId,
        uploads: input.files.map((file) => ({
          id: file.clientId,
          clientId: file.clientId,
          status: initialStatus,
          upload: {
            kind: 'single',
            url: 'https://r2.example/upload',
            expiresAt: '2099-01-01',
          },
        })),
      };
      server.set(batch.id, batch);
      return structuredClone(batch);
    }
    if (url.startsWith('/uploads/batches/'))
      return structuredClone(server.get(url.split('/').at(-1)!));
    const item = [...server.values()]
      .flatMap((batch) => batch.uploads)
      .find((file) => file.id === url.split('/')[2])!;
    if (method === 'DELETE') {
      item.status = 'CANCELLED';
      return;
    }
    if (url.endsWith('/complete')) {
      item.status = 'PROCESSING';
      return { ...item, upload: null };
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  });
  manager = new UploadManager('user', {
    request: request as ConstructorParameters<
      typeof UploadManager
    >[1]['request'],
    read: async () => null,
    write: async () => {},
    retain: async (id) => `file:///private/${id}`,
    remove: vi.fn(),
    transfer: async () => 'etag',
    changed: vi.fn(),
    uuid: () => `batch-${++key}`,
  });
  await manager.load();
  manager.setActive(true);
  native.uploads.mockImplementation(() => ({
    manager,
    batches: useSyncExternalStore(manager.subscribe, manager.snapshot),
    error: null,
  }));
});

afterEach(async () => {
  await act(async () => view?.unmount());
  view = undefined;
  manager.stop();
  vi.restoreAllMocks();
});

async function mount() {
  await act(async () => {
    view = create(createElement(PostEditorScreen));
  });
}
async function submit(files = [photo('one')]) {
  await act(async () => pick(files));
  await act(async () => {
    form().props.onSave();
    await vi.waitFor(() =>
      expect(
        manager
          .snapshot()
          .some((batch) =>
            batch.files.every((file) => file.status === 'PROCESSING'),
          ),
      ).toBe(true),
    );
  });
  return manager
    .snapshot()
    .find((batch) => batch.files[0].clientId === files[0].clientId)!;
}
async function reconcile(batch: PendingBatch, statuses: UploadStatus[]) {
  await act(async () =>
    manager.reconcile(batch, {
      id: batch.id!,
      uploads: batch.files.map((file, index) => ({
        id: file.id!,
        clientId: file.clientId,
        status: statuses[index],
      })),
    }),
  );
}

describe('post upload completion', () => {
  it('waits for every file to be published, then closes the editor for the target stamp once', async () => {
    await mount();
    const batch = await submit([photo('one'), photo('two')]);
    expect(native.finish).not.toHaveBeenCalled();
    expect(form().props.disabled).toBe(true);
    await reconcile(batch, ['READY', 'PROCESSING']);
    expect(native.finish).not.toHaveBeenCalled();
    await reconcile(batch, ['READY', 'FAILED']);
    expect(native.finish).not.toHaveBeenCalled();
    await reconcile(batch, ['READY', 'READY']);
    expect(manager.snapshot()).toEqual([]);
    expect(native.finish).toHaveBeenCalledExactlyOnceWith({
      target: { type: 'stamp', stampId: 'stamp' },
    });
    await reconcile(batch, ['READY', 'READY']);
    expect(native.finish).toHaveBeenCalledOnce();
  });

  it('ignores another batch completing at the same stamp', async () => {
    await mount();
    const current = await submit();
    await act(async () => {
      await manager.add('stamp', [photo('other')]);
    });
    const other = manager.snapshot().find((batch) => batch !== current)!;
    await reconcile(other, ['READY']);
    expect(native.finish).not.toHaveBeenCalled();
    await reconcile(current, ['READY']);
    expect(native.finish).toHaveBeenCalledOnce();
  });

  it('retries a failed destination lookup without uploading again', async () => {
    native.finish.mockRejectedValueOnce(
      new Error('スタンプを取得できませんでした。'),
    );
    const add = vi.spyOn(manager, 'add');
    await mount();
    const batch = await submit();
    await reconcile(batch, ['READY']);
    expect(form().props.error).toBe('スタンプを取得できませんでした。');
    expect(form().props.saveLabel).toBe('スタンプを開く');
    expect(form().props.disabled).toBe(false);
    expect(native.finish).toHaveBeenCalledOnce();
    await act(async () => form().props.onSave());
    expect(native.finish).toHaveBeenCalledTimes(2);
    expect(add).toHaveBeenCalledOnce();
    expect(manager.snapshot()).toEqual([]);
  });

  it('unlocks the form after all files are cancelled without navigating', async () => {
    await mount();
    const batch = await submit();
    await act(async () => manager.cancel(batch.clientRequestId, 'one'));
    expect(manager.snapshot()).toEqual([]);
    expect(native.finish).not.toHaveBeenCalled();
    expect(form().props.saveLabel).toBe('アップロードを開始');
    await submit([photo('replacement')]);
    expect(manager.snapshot()).toHaveLength(1);
  });

  it('handles a READY response before add resolves', async () => {
    initialStatus = 'READY';
    await mount();
    await act(async () => pick([photo('one')]));
    await act(async () => {
      form().props.onSave();
      await vi.waitFor(() => expect(request).toHaveBeenCalled());
    });
    expect(manager.snapshot()).toEqual([]);
    expect(native.finish).toHaveBeenCalledExactlyOnceWith({
      target: { type: 'stamp', stampId: 'stamp' },
    });
  });

  it('waits until the editor is focused and unsubscribes when it closes', async () => {
    await mount();
    const batch = await submit();
    native.focused.mockReturnValue(false);
    await act(async () => view!.update(createElement(PostEditorScreen)));
    await reconcile(batch, ['READY']);
    expect(native.finish).not.toHaveBeenCalled();
    native.focused.mockReturnValue(true);
    await act(async () => view!.update(createElement(PostEditorScreen)));
    expect(native.finish).toHaveBeenCalledOnce();
    await act(async () => view!.unmount());
    view = undefined;
    await manager.add('stamp', [photo('background')]);
    const background = manager.snapshot()[0];
    await reconcile(background, ['READY']);
    expect(native.finish).toHaveBeenCalledOnce();
  });

  it('finishes the batch reopened from its upload status link', async () => {
    await manager.add('resumed-stamp', [photo('resumed')]);
    const batch = manager.snapshot()[0];
    native.params.mockReturnValue({
      stampId: 'resumed-stamp',
      batchId: batch.clientRequestId,
    });
    await mount();
    await reconcile(batch, ['READY']);
    expect(native.finish).toHaveBeenCalledExactlyOnceWith({
      target: { type: 'stamp', stampId: 'resumed-stamp' },
    });
  });
});
