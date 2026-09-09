import { createElement } from 'react';
import { act, create } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';
import { EntityForm } from './EntityForm';
const native = vi.hoisted(() => ({
  createTrip: vi.fn(),
  finish: vi.fn(),
  prepare: vi.fn(),
}));
vi.mock('../../../features/app-data/AppDataProvider', () => ({
  useData: () => ({
    userId: 'viewer',
    actions: { createTrip: native.createTrip },
  }),
}));
vi.mock('../../../features/editor/EditorProvider', () => ({
  useEditor: () => ({ finish: native.finish, finishing: false }),
}));
vi.mock('../../../features/editor/hooks/useEditorGuard', () => ({
  useEditorGuard: vi.fn(),
}));
vi.mock('../../../features/editor/ui/FormPage', () => ({
  FormPage: 'FormPage',
}));
vi.mock('../../../shared/ui/AppText', () => ({ AppText: 'AppText' }));
vi.mock('./TextField', () => ({ TextField: 'TextField' }));
vi.mock('./DateField', () => ({ DateField: 'DateField' }));
vi.mock('./LocationsField', () => ({ LocationsField: 'LocationsField' }));
vi.mock('./CoverField', () => ({ CoverField: 'CoverField' }));
vi.mock('../../../features/trip-covers/useCoverUpload', () => ({
  useCoverUpload: (uri: string | null) => ({
    uri,
    changed: false,
    prepare: () => native.prepare(),
    saved: vi.fn(),
    finish: vi.fn(),
  }),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it('retains draft input on refetch and retries failed navigation without repeating creation', async () => {
  const warning = vi.spyOn(console, 'error').mockImplementation(() => {});
  native.prepare.mockReset().mockResolvedValue({});
  native.createTrip.mockReset().mockResolvedValue({ id: 'created' });
  native.finish
    .mockReset()
    .mockRejectedValueOnce(new Error('通信失敗'))
    .mockResolvedValueOnce(undefined);
  const initial = {
    name: '',
    description: '',
    startDate: '2026-09-09',
    endDate: '2026-09-09',
    locations: [],
    coverImageUrl: null,
  };
  let view!: ReturnType<typeof create>;
  try {
    await act(async () => {
      view = create(
        createElement(EntityForm, { kind: 'trip', initial, parentLabel: '' }),
      );
    });
    await act(async () =>
      view.root.findByType('TextField' as never).props.onChangeText('編集中'),
    );
    await act(async () =>
      view.update(
        createElement(EntityForm, {
          kind: 'trip',
          initial: { ...initial, name: '再取得された値' },
          parentLabel: '',
        }),
      ),
    );
    expect(view.root.findByType('TextField' as never).props.value).toBe(
      '編集中',
    );
    await act(async () =>
      view.root.findByType('FormPage' as never).props.onSave(),
    );
    expect(view.root.findByType('FormPage' as never).props.error).toBe(
      '通信失敗',
    );
    expect(view.root.findByType('FormPage' as never).props.saveLabel).toBe(
      '保存した画面を開く',
    );
    await act(async () =>
      view.root.findByType('FormPage' as never).props.onSave(),
    );
    expect(native.createTrip).toHaveBeenCalledExactlyOnceWith('viewer', {
      name: '編集中',
      startDate: initial.startDate,
      endDate: initial.endDate,
      locations: [],
      clientRequestId: undefined,
    });
    expect(native.finish).toHaveBeenCalledTimes(2);
    expect(native.finish).toHaveBeenLastCalledWith({
      target: { type: 'trip', tripId: 'created' },
    });
    await act(async () => view.unmount());
  } finally {
    warning.mockRestore();
  }
});

it('keeps the form when cover preparation fails and saves only after a successful retry', async () => {
  const warning = vi.spyOn(console, 'error').mockImplementation(() => {});
  native.prepare
    .mockReset()
    .mockRejectedValueOnce(new Error('画像送信失敗'))
    .mockResolvedValue({
      coverAssetId: '12345678-1234-4234-8234-123456789abc',
    });
  native.createTrip.mockReset().mockResolvedValue({ id: 'created' });
  native.finish.mockReset().mockResolvedValue(undefined);
  let view!: ReturnType<typeof create>;
  try {
    await act(async () => {
      view = create(
        createElement(EntityForm, {
          kind: 'trip',
          parentLabel: '',
          initial: {
            name: '旅行',
            description: '',
            startDate: '2026-09-09',
            endDate: '2026-09-09',
            locations: [],
            coverImageUrl: null,
          },
        }),
      );
    });
    await act(async () =>
      view.root.findByType('FormPage' as never).props.onSave(),
    );
    expect(native.createTrip).not.toHaveBeenCalled();
    expect(native.finish).not.toHaveBeenCalled();
    expect(view.root.findByType('FormPage' as never).props.error).toBe(
      '画像送信失敗',
    );
    expect(view.root.findByType('TextField' as never).props.value).toBe('旅行');
    await act(async () =>
      view.root.findByType('FormPage' as never).props.onSave(),
    );
    expect(native.createTrip).toHaveBeenCalledExactlyOnceWith(
      'viewer',
      expect.objectContaining({
        coverAssetId: '12345678-1234-4234-8234-123456789abc',
      }),
    );
    expect(native.createTrip.mock.calls[0][1]).not.toHaveProperty(
      'coverImageUrl',
    );
    expect(native.finish).toHaveBeenCalledOnce();
  } finally {
    await act(async () => view.unmount());
    warning.mockRestore();
  }
});
