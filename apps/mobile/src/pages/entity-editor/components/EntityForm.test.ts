import { createElement } from 'react';
import { act, create } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';
import { EntityForm } from './EntityForm';
const native = vi.hoisted(() => ({ createTrip: vi.fn(), finish: vi.fn() }));
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
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it('retains draft input on refetch and retries failed navigation without repeating creation', async () => {
  const warning = vi.spyOn(console, 'error').mockImplementation(() => {});
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
      coverImageUrl: null,
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
