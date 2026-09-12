import { createElement } from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, expect, it, vi } from 'vitest';
import { EntityForm } from './EntityForm';
const native = vi.hoisted(() => ({
  alert: vi.fn(),
  deleteTrip: vi.fn(),
  deleteCategory: vi.fn(),
  deleteStamp: vi.fn(),
  createTrip: vi.fn(),
  finish: vi.fn(),
  prepare: vi.fn(),
  templates: vi.fn(),
  editTemplates: vi.fn(),
  prepareEdit: vi.fn(),
  guard: vi.fn(),
  updateTrip: vi.fn(),
  createStamp: vi.fn(),
  updateStamp: vi.fn(),
  categories: vi.fn(),
}));
vi.mock('react-native', () => ({ Alert: { alert: native.alert } }));
vi.mock('../../../shared/ui/Button', () => ({ Button: 'Button' }));
vi.mock('../../../features/app-data/AppDataProvider', () => ({
  useData: () => ({
    userId: 'viewer',
    actions: {
      deleteTrip: native.deleteTrip,
      deleteCategory: native.deleteCategory,
      deleteStamp: native.deleteStamp,
      createTrip: native.createTrip,
      updateTrip: native.updateTrip,
      createStamp: native.createStamp,
      updateStamp: native.updateStamp,
    },
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
vi.mock('../../../features/trip-templates/useTripTemplateEdit', () => ({
  useTripTemplateEdit: (...args: unknown[]) => native.editTemplates(...args),
}));
vi.mock('./EditTemplateFields', () => ({
  EditTemplateFields: 'EditTemplateFields',
  confirmTemplateEdit: vi.fn(),
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
vi.mock('../../../features/app-data/api/queries', () => ({
  useList: (...args: unknown[]) => native.categories(...args),
}));
vi.mock('./StampCategoriesField', () => ({
  StampCategoriesField: 'StampCategoriesField',
}));
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
  native.prepareEdit.mockReset().mockResolvedValue({
    clientRequestId: 'trip-create-request',
    changes: [],
    confirmationToken: 'confirmed',
  });
  native.editTemplates.mockReset().mockReturnValue({
    ready: true,
    categories: [],
    dirty: false,
    busy: false,
    prepare: native.prepareEdit,
  });
  native.categories.mockReset().mockReturnValue({
    data: [],
    isPending: false,
    error: null,
    invalidate: vi.fn(),
  });
  native.templates
    .mockReset()
    .mockReturnValue({ ready: true, categories: [], selection: {} });
});

it('creates a stamp with multiple categories, requires a selection, and retains the draft after failure', async () => {
  const warning = vi.spyOn(console, 'error').mockImplementation(() => {});
  native.createStamp
    .mockReset()
    .mockRejectedValueOnce(new Error('保存失敗'))
    .mockResolvedValueOnce({ id: 'stamp' });
  native.finish.mockReset().mockResolvedValue(undefined);
  native.categories.mockReturnValue({
    data: [
      { id: 'food', name: 'グルメ' },
      { id: 'park', name: '遊園地' },
    ],
    isPending: false,
    error: null,
    invalidate: vi.fn(),
  });
  let view!: ReturnType<typeof create>;
  const initial = {
    name: 'パークのグルメ',
    description: '',
    startDate: '',
    endDate: '',
    locations: [],
    coverImageUrl: null,
  };
  try {
    await act(async () => {
      view = create(
        createElement(EntityForm, {
          kind: 'stamp',
          tripId: 'trip',
          categoryId: 'food',
          viaCategoryId: 'food',
          initial,
          parentLabel: 'グルメ',
        }),
      );
    });
    const field = () => view.root.findByType('StampCategoriesField' as never);
    const form = () => view.root.findByType('FormPage' as never);
    expect(field().props.selected).toEqual(['food']);
    expect(native.categories).toHaveBeenCalledWith(
      '/categories',
      { tripId: 'trip' },
      true,
    );
    await act(async () => field().props.onChange([]));
    expect(form().props.disabled).toBe(true);
    await act(async () => form().props.onSave());
    expect(native.createStamp).not.toHaveBeenCalled();
    await act(async () => field().props.onChange(['food', 'park']));
    expect(native.guard).toHaveBeenLastCalledWith(true, false);
    await act(async () => form().props.onSave());
    expect(field().props.selected).toEqual(['food', 'park']);
    expect(form().props.error).toBe('保存失敗');
    await act(async () => form().props.onSave());
    expect(native.createStamp).toHaveBeenLastCalledWith('viewer', {
      tripId: 'trip',
      categoryIds: ['food', 'park'],
      name: initial.name,
      description: '',
    });
    expect(native.finish).toHaveBeenCalledWith({
      target: { type: 'stamp', stampId: 'stamp' },
      viaCategoryId: 'food',
    });
  } finally {
    if (view) await act(async () => view.unmount());
    warning.mockRestore();
  }
});

it('edits memberships without reassigning the trip and preserves selections on refetch', async () => {
  const warning = vi.spyOn(console, 'error').mockImplementation(() => {});
  native.updateStamp.mockReset().mockResolvedValue({ id: 'stamp' });
  native.finish.mockReset().mockResolvedValue(undefined);
  const initial = {
    name: '夜景',
    description: '',
    categoryIds: ['view', 'memory'],
    startDate: '',
    endDate: '',
    locations: [],
    coverImageUrl: null,
  };
  const props = {
    kind: 'stamp' as const,
    id: 'stamp',
    tripId: 'trip',
    viaCategoryId: 'view',
    initial,
    parentLabel: '',
  };
  let view!: ReturnType<typeof create>;
  try {
    await act(async () => {
      view = create(createElement(EntityForm, props));
    });
    await act(async () =>
      view.root
        .findByType('StampCategoriesField' as never)
        .props.onChange(['memory']),
    );
    await act(async () =>
      view.update(
        createElement(EntityForm, {
          ...props,
          initial: { ...initial, categoryIds: ['view'] },
        }),
      ),
    );
    expect(
      view.root.findByType('StampCategoriesField' as never).props.selected,
    ).toEqual(['memory']);
    await act(async () =>
      view.root.findByType('FormPage' as never).props.onSave(),
    );
    expect(native.updateStamp).toHaveBeenCalledExactlyOnceWith(
      'viewer',
      'stamp',
      { name: '夜景', description: '', categoryIds: ['memory'] },
    );
  } finally {
    if (view) await act(async () => view.unmount());
    warning.mockRestore();
  }
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
      selectedCategories: [],
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
    categories: [
      { name: '自然', stamps: [{ title: '海を見る', sources: [] }] },
    ],
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
        selectedCategories: [],
      }),
    );
  } finally {
    if (view) await act(async () => view.unmount());
    warning.mockRestore();
  }
});

it('sends only checked candidates when creating and loads editable templates for existing trips', async () => {
  const warning = vi.spyOn(console, 'error').mockImplementation(() => {});
  native.prepare.mockReset().mockResolvedValue({});
  native.createTrip.mockReset().mockResolvedValue({ id: 'created' });
  native.updateTrip.mockReset().mockResolvedValue({ id: 'existing' });
  native.finish.mockReset().mockResolvedValue(undefined);
  native.templates.mockReturnValue({
    ready: true,
    categories: [
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
        selectedCategories: [{ name: '自然', stamps: [{ title: '海を見る' }] }],
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
    expect(view.root.findAllByType('ActivitiesField' as never)).toHaveLength(1);
    expect(view.root.findAllByType('EditTemplateFields' as never)).toHaveLength(
      1,
    );
    expect(
      view.root.findAllByType('TemplateCandidatesField' as never),
    ).toHaveLength(0);
    await act(async () =>
      view.root.findByType('FormPage' as never).props.onSave(),
    );
    expect(native.updateTrip).toHaveBeenCalledWith(
      'viewer',
      'existing',
      expect.not.objectContaining({ selectedCategories: expect.anything() }),
    );
    expect(native.updateTrip.mock.calls[0][2]).toMatchObject({
      activityPresets: [],
      customActivities: [],
      templateEdit: { changes: [], confirmationToken: 'confirmed' },
    });
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
    categories: [
      { name: '自然', stamps: [{ title: '海を見る', sources: [] }] },
    ],
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
      selectedCategories: [],
      clientRequestId: 'trip-create-request',
    });
  } finally {
    if (view) await act(async () => view.unmount());
    warning.mockRestore();
  }
});

it.each(['trip', 'category', 'stamp'] as const)(
  'confirms irreversible %s deletion and retries navigation without repeating deletion',
  async (kind) => {
    const warning = vi.spyOn(console, 'error').mockImplementation(() => {});
    const operation =
      kind === 'trip'
        ? native.deleteTrip
        : kind === 'category'
          ? native.deleteCategory
          : native.deleteStamp;
    operation
      .mockReset()
      .mockRejectedValueOnce(new Error('削除失敗'))
      .mockResolvedValue(undefined);
    native.alert.mockReset();
    native.finish
      .mockReset()
      .mockRejectedValueOnce(new Error('遷移失敗'))
      .mockResolvedValue(undefined);
    let view!: ReturnType<typeof create>;
    try {
      await act(async () => {
        view = create(
          createElement(EntityForm, {
            kind,
            id: 'entity',
            tripId: 'trip',
            viaCategoryId: 'category',
            initial: {
              name: '名前',
              description: '',
              startDate: '2026-09-09',
              endDate: '2026-09-10',
              coverImageUrl: null,
              locations: [],
              categoryIds: ['category'],
            },
            parentLabel: '',
          }),
        );
      });
      const remove = () =>
        view.root.findByType('Button' as never).props.onPress();
      await act(async () => remove());
      expect(operation).not.toHaveBeenCalled();
      expect(native.alert.mock.calls[0][1]).toContain('付属するすべての投稿');
      expect(native.alert.mock.calls[0][1]).toContain('復元できません');
      await act(async () => native.alert.mock.calls[0][2][1].onPress());
      expect(view.root.findByType('FormPage' as never).props.error).toBe(
        '削除失敗',
      );
      expect(native.finish).not.toHaveBeenCalled();
      await act(async () => remove());
      await act(async () => native.alert.mock.calls[1][2][1].onPress());
      expect(view.root.findByType('FormPage' as never).props.error).toBe(
        '遷移失敗',
      );
      await act(async () =>
        view.root.findByType('FormPage' as never).props.onSave(),
      );
      expect(operation).toHaveBeenCalledTimes(2);
      expect(native.finish).toHaveBeenLastCalledWith(
        kind === 'trip'
          ? { tripList: true }
          : {
              target:
                kind === 'category'
                  ? { type: 'trip', tripId: 'trip' }
                  : { type: 'category', categoryId: 'category' },
            },
      );
    } finally {
      if (view) await act(async () => view.unmount());
      warning.mockRestore();
    }
  },
);

it('edits saved activities and locations atomically, preserving the draft after conflict and cancelling without writes', async () => {
  const warning = vi.spyOn(console, 'error').mockImplementation(() => {});
  native.prepare.mockReset().mockResolvedValue({});
  native.updateTrip
    .mockReset()
    .mockRejectedValueOnce(new Error('削除対象が変わりました'))
    .mockResolvedValue({ id: 'trip' });
  native.finish.mockReset().mockResolvedValue(undefined);
  const initial = {
    name: '旅行',
    description: '',
    startDate: '2026-09-09',
    endDate: '2026-09-10',
    locations: ['沖縄'],
    activityPresets: ['海'],
    customActivities: ['友達に会う'],
    coverImageUrl: null,
  };
  let view!: ReturnType<typeof create>;
  try {
    await act(async () => {
      view = create(
        createElement(EntityForm, {
          kind: 'trip',
          id: 'trip',
          initial,
          parentLabel: '',
        }),
      );
    });
    const activities = () => view.root.findByType('ActivitiesField' as never);
    const form = () => view.root.findByType('FormPage' as never);
    expect(activities().props.selected).toEqual(['海']);
    expect(activities().props.custom).toEqual(['友達に会う']);
    await act(async () => {
      activities().props.onChange(['夜景']);
      activities().props.onCustomChange(['友達と夕食']);
      view.root.findByType('LocationsField' as never).props.onChange(['大阪']);
    });
    expect(native.guard).toHaveBeenLastCalledWith(true, false);
    native.prepareEdit.mockResolvedValueOnce(null);
    await act(async () => form().props.onSave());
    expect(native.updateTrip).not.toHaveBeenCalled();
    expect(native.prepare).not.toHaveBeenCalled();
    await act(async () => form().props.onSave());
    expect(form().props.error).toContain('削除対象が変わりました');
    expect(activities().props.selected).toEqual(['夜景']);
    expect(native.finish).not.toHaveBeenCalled();
    await act(async () => form().props.onSave());
    expect(native.updateTrip).toHaveBeenLastCalledWith(
      'viewer',
      'trip',
      expect.objectContaining({
        locations: ['大阪'],
        activityPresets: ['夜景'],
        customActivities: ['友達と夕食'],
        templateEdit: {
          changes: [],
          clientRequestId: 'trip-create-request',
          confirmationToken: 'confirmed',
        },
      }),
    );
    expect(native.finish).toHaveBeenCalledTimes(1);
  } finally {
    if (view) await act(async () => view.unmount());
    warning.mockRestore();
  }
});
