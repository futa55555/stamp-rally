import { createElement } from 'react';
import { act, create } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';
import { confirmTemplateEdit, EditTemplateFields } from './EditTemplateFields';
import type { useTripTemplateEdit } from '../../../features/trip-templates/useTripTemplateEdit';
const native = vi.hoisted(() => ({ alert: vi.fn() }));
vi.mock('react-native', () => ({
  Alert: { alert: native.alert },
  View: 'View',
}));
vi.mock('../../../shared/ui/AppText', () => ({ AppText: 'AppText' }));
vi.mock('../../../shared/ui/Button', () => ({ Button: 'Button' }));
vi.mock('../../../shared/ui/ErrorMessage', () => ({
  ErrorMessage: 'ErrorMessage',
}));
vi.mock('./TemplateFields', () => ({ CheckRow: 'CheckRow' }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it('explains irreversible post deletion and makes cancellation or dismissal leave the draft unchanged', async () => {
  const preview = {
    categories: [],
    impact: { stampCount: 2, postCount: 5 },
    confirmationToken: 'token',
  };
  const cancelled = confirmTemplateEdit(preview);
  expect(native.alert.mock.lastCall?.[1]).toContain('付属する5件の投稿');
  expect(native.alert.mock.lastCall?.[1]).toContain('復元できません');
  expect(native.alert.mock.lastCall?.[1]).toContain(
    '保存するまでは反映されません',
  );
  native.alert.mock.lastCall?.[2][0].onPress();
  expect(await cancelled).toBe(false);
  const confirmed = confirmTemplateEdit(preview);
  native.alert.mock.lastCall?.[2][1].onPress();
  expect(await confirmed).toBe(true);
  const shared = confirmTemplateEdit({
    ...preview,
    impact: { stampCount: 0, postCount: 0 },
  });
  expect(native.alert.mock.lastCall?.[1]).toContain('投稿は残ります');
  native.alert.mock.lastCall?.[3].onDismiss();
  expect(await shared).toBe(false);
});

it('shows protected selections and mixed categories, disables stale choices, and offers retry', async () => {
  const warning = vi.spyOn(console, 'error').mockImplementation(() => {});
  const toggle = vi.fn();
  const templates = {
    categories: [
      {
        ref: 'category',
        name: '景色',
        selected: true,
        stamps: [
          { ref: 'retained', name: '海', selected: true, retained: true },
          { ref: 'empty', name: '山', selected: false },
        ],
      },
    ],
    ready: true,
    pending: false,
    error: null,
    toggle,
    retry: vi.fn(),
  } as unknown as ReturnType<typeof useTripTemplateEdit>;
  let view!: ReturnType<typeof create>;
  try {
    await act(async () => {
      view = create(
        createElement(EditTemplateFields, { templates, disabled: false }),
      );
    });
    const row = (label: string) =>
      view.root
        .findAllByType('CheckRow' as never)
        .find((item) => item.props.label === label)!;
    expect(row('景色').props.checked).toBe('mixed');
    expect(row('海').props.checked).toBe(true);
    expect(
      view.root
        .findAllByType('AppText' as never)
        .some((item) =>
          String(item.props.children).includes('投稿があるため残しています'),
        ),
    ).toBe(true);
    await act(async () => row('海').props.onPress());
    expect(toggle).toHaveBeenCalledWith({
      categoryRef: 'category',
      stampRef: 'retained',
      selected: false,
    });
    await act(async () =>
      view.update(
        createElement(EditTemplateFields, {
          templates: { ...templates, ready: false, error: '通信失敗' },
          disabled: false,
        }),
      ),
    );
    expect(row('海').props.disabled).toBe(true);
    await act(async () =>
      view.root.findByType('Button' as never).props.onPress(),
    );
    expect(templates.retry).toHaveBeenCalledOnce();
  } finally {
    if (view) await act(async () => view.unmount());
    warning.mockRestore();
  }
});
