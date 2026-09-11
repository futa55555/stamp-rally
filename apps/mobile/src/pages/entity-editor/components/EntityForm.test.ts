import { createElement } from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, expect, it, vi } from 'vitest';
import { EntityForm } from './EntityForm';
const native = vi.hoisted(() => ({
  createTrip: vi.fn(),
  finish: vi.fn(),
  prepare: vi.fn(),
  templates: vi.fn(),
  guard: vi.fn(),
  updateTrip: vi.fn(),
}));
vi.mock('../../../features/app-data/AppDataProvider', () => ({
  useData: () => ({
    userId: 'viewer',
    actions: { createTrip: native.createTrip, updateTrip: native.updateTrip },
  }),
}));
vi.mock('../../../features/editor/EditorProvider', () => ({
  useEditor: () => ({ finish: native.finish, finishing: false }),
}));
vi.mock('../../../features/editor/hooks/useEditorGuard', () => ({
  useEditorGuard: native.guard,
}));
vi.mock('../../../features/trip-templates/useTripTemplates', () => ({
  useTripTemplates: (...args: unknown[]) => native.templates(...args),
}));
vi.mock('./TemplateFields', () => ({
  ActivitiesField: 'ActivitiesField',
  TemplateCandidatesField: 'TemplateCandidatesField',
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
    requestId: 'trip-create-request',
    prepare: () => native.prepare(),
    saved: vi.fn(),
    finish: vi.fn(),
  }),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

beforeEach(() => {
  native.templates
    .mockReset()
    .mockReturnValue({ ready: true, genres: [], selection: {} });
});

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
      clientRequestId: 'trip-create-request',
      activityPresets: [],
      customActivities: [],
      selectedGenres: [],
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

it('preserves activity input and selections across cover failures and can skip an unavailable preview', async () => {
  const warning = vi.spyOn(console, 'error').mockImplementation(() => {});
  native.prepare
    .mockReset()
    .mockRejectedValueOnce(new Error('画像送信失敗'))
    .mockResolvedValue({});
  native.createTrip.mockReset().mockResolvedValue({ id: 'created' });
  native.finish.mockReset().mockResolvedValue(undefined);
  native.templates.mockReturnValue({
    ready: false,
    genres: [{ name: '自然', stamps: [{ title: '海を見る', sources: [] }] }],
    selection: { '["自然","海を見る"]': false },
  });
  let view!: ReturnType<typeof create>;
  try {
    await act(async () => {
      view = create(
        createElement(EntityForm, {
          kind: 'trip',
          parentLabel: '',
          initial: {
            name: '海辺の旅行',
            description: '',
            startDate: '2026-09-09',
            endDate: '2026-09-10',
            locations: ['沖縄'],
            coverImageUrl: null,
          },
        }),
      );
    });
    expect(view.root.findByType('FormPage' as never).props.disabled).toBe(true);
    await act(async () => {
      const field = view.root.findByType('ActivitiesField' as never);
      field.props.onChange(['海']);
      field.props.onCustomChange(['  星空を眺める  ', '']);
      view.root
        .findByType('TemplateCandidatesField' as never)
        .props.onUseTemplateChange(false);
    });
    expect(native.guard).toHaveBeenLastCalledWith(true, false);
    expect(view.root.findByType('FormPage' as never).props.disabled).toBe(
      false,
    );
    await act(async () =>
      view.root.findByType('FormPage' as never).props.onSave(),
    );
    expect(native.createTrip).not.toHaveBeenCalled();
    expect(
      view.root.findByType('ActivitiesField' as never).props.selected,
    ).toEqual(['海']);
    expect(
      view.root.findByType('ActivitiesField' as never).props.custom,
    ).toEqual(['  星空を眺める  ', '']);
    await act(async () =>
      view.root.findByType('FormPage' as never).props.onSave(),
    );
    expect(native.createTrip).toHaveBeenCalledExactlyOnceWith(
      'viewer',
      expect.objectContaining({
        activityPresets: ['海'],
        customActivities: ['星空を眺める'],
        selectedGenres: [],
      }),
    );
  } finally {
    if (view) await act(async () => view.unmount());
    warning.mockRestore();
  }
});

it('sends only checked candidates and keeps template controls out of existing trip edits', async () => {
  const warning = vi.spyOn(console, 'error').mockImplementation(() => {});
  native.prepare.mockReset().mockResolvedValue({});
  native.createTrip.mockReset().mockResolvedValue({ id: 'created' });
  native.updateTrip.mockReset().mockResolvedValue({ id: 'existing' });
  native.finish.mockReset().mockResolvedValue(undefined);
  native.templates.mockReturnValue({
    ready: true,
    genres: [
      {
        name: '自然',
        stamps: [
          { title: '海を見る', sources: [] },
          { title: '山を見る', sources: [] },
        ],
      },
    ],
    selection: { '["自然","海を見る"]': true, '["自然","山を見る"]': false },
  });
  const initial = {
    name: '旅行',
    description: '',
    startDate: '2026-09-09',
    endDate: '2026-09-10',
    locations: [],
    coverImageUrl: null,
  };
  let view!: ReturnType<typeof create>;
  try {
    await act(async () => {
      view = create(
        createElement(EntityForm, { kind: 'trip', parentLabel: '', initial }),
      );
    });
    await act(async () =>
      view.root.findByType('FormPage' as never).props.onSave(),
    );
    expect(native.createTrip).toHaveBeenCalledWith(
      'viewer',
      expect.objectContaining({
        selectedGenres: [{ name: '自然', stamps: [{ title: '海を見る' }] }],
      }),
    );
    await act(async () => view.unmount());
    await act(async () => {
      view = create(
        createElement(EntityForm, {
          kind: 'trip',
          id: 'existing',
          parentLabel: '',
          initial,
        }),
      );
    });
    expect(view.root.findAllByType('ActivitiesField' as never)).toHaveLength(0);
    expect(
      view.root.findAllByType('TemplateCandidatesField' as never),
    ).toHaveLength(0);
    await act(async () =>
      view.root.findByType('FormPage' as never).props.onSave(),
    );
    expect(native.updateTrip).toHaveBeenCalledWith(
      'viewer',
      'existing',
      expect.not.objectContaining({ selectedGenres: expect.anything() }),
    );
    expect(native.updateTrip.mock.calls[0][2]).not.toHaveProperty(
      'activityPresets',
    );
    expect(native.updateTrip.mock.calls[0][2]).not.toHaveProperty(
      'customActivities',
    );
  } finally {
    if (view) await act(async () => view.unmount());
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

it('validates custom activities before upload and retries an all-off creation with the same request ID', async () => {
  const warning = vi.spyOn(console, 'error').mockImplementation(() => {});
  native.prepare.mockReset().mockResolvedValue({});
  native.createTrip
    .mockReset()
    .mockRejectedValueOnce(new Error('保存失敗'))
    .mockResolvedValue({ id: 'created' });
  native.finish.mockReset().mockResolvedValue(undefined);
  native.templates.mockReturnValue({
    ready: true,
    genres: [{ name: '自然', stamps: [{ title: '海を見る', sources: [] }] }],
    selection: { '["自然","海を見る"]': false },
  });
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
            endDate: '2026-09-10',
            locations: ['沖縄'],
            coverImageUrl: null,
          },
        }),
      );
    });
    await act(async () =>
      view.root
        .findByType('ActivitiesField' as never)
        .props.onCustomChange(['🌿'.repeat(101)]),
    );
    await act(async () =>
      view.root.findByType('FormPage' as never).props.onSave(),
    );
    expect(view.root.findByType('FormPage' as never).props.error).toContain(
      '100',
    );
    expect(native.prepare).not.toHaveBeenCalled();
    await act(async () =>
      view.root
        .findByType('ActivitiesField' as never)
        .props.onCustomChange(['🌿'.repeat(100)]),
    );
    expect(view.root.findByType('FormPage' as never).props.disabled).toBe(
      false,
    );
    await act(async () =>
      view.root.findByType('FormPage' as never).props.onSave(),
    );
    expect(view.root.findByType('FormPage' as never).props.error).toBe(
      '保存失敗',
    );
    expect(
      view.root.findByType('ActivitiesField' as never).props.custom,
    ).toEqual(['🌿'.repeat(100)]);
    expect(
      view.root.findByType('TemplateCandidatesField' as never).props
        .useTemplate,
    ).toBe(true);
    await act(async () =>
      view.root.findByType('FormPage' as never).props.onSave(),
    );
    expect(native.createTrip).toHaveBeenCalledTimes(2);
    expect(native.createTrip.mock.calls[0][1]).toEqual(
      native.createTrip.mock.calls[1][1],
    );
    expect(native.createTrip.mock.calls[1][1]).toMatchObject({
      selectedGenres: [],
      clientRequestId: 'trip-create-request',
    });
  } finally {
    if (view) await act(async () => view.unmount());
    warning.mockRestore();
  }
});
