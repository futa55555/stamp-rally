import { createElement } from 'react';
import { act, create } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';
import { TemplateCandidatesField } from './TemplateFields';
import type { useTripTemplates } from '../../../features/trip-templates/useTripTemplates';

vi.mock('react-native', () => ({ Pressable: 'Pressable', View: 'View' }));
vi.mock('../../../shared/ui/AppText', () => ({ AppText: 'AppText' }));
vi.mock('../../../shared/ui/Button', () => ({ Button: 'Button' }));
vi.mock('../../../shared/ui/ErrorMessage', () => ({
  ErrorMessage: 'ErrorMessage',
}));
vi.mock('../../../shared/ui/Icon', () => ({ Icon: 'Icon' }));
vi.mock('./TextField', () => ({ TextField: 'TextField' }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it('exposes a mixed genre checkbox and keeps the skip control available during preview failure', async () => {
  const warning = vi.spyOn(console, 'error').mockImplementation(() => {});
  const toggleGenre = vi.fn();
  const toggleStamp = vi.fn();
  const onUseTemplateChange = vi.fn();
  const genre = {
    name: '自然',
    stamps: [
      { title: '海を見る', sources: [] },
      { title: '山を見る', sources: [] },
    ],
  };
  const templates = {
    genres: [genre],
    selection: { '["自然","海を見る"]': true, '["自然","山を見る"]': false },
    ready: true,
    pending: false,
    error: null,
    toggleGenre,
    toggleStamp,
    retry: vi.fn(),
  } as unknown as ReturnType<typeof useTripTemplates>;
  let view!: ReturnType<typeof create>;
  try {
    await act(async () => {
      view = create(
        createElement(TemplateCandidatesField, {
          templates,
          useTemplate: true,
          disabled: false,
          onUseTemplateChange,
        }),
      );
    });
    const checkbox = (label: string) =>
      view.root
        .findAllByType('Pressable' as never)
        .find((row) => row.props.accessibilityLabel === label)!;
    expect(checkbox('自然').props.accessibilityState.checked).toBe('mixed');
    await act(async () => checkbox('自然').props.onPress());
    expect(toggleGenre).toHaveBeenCalledWith(genre, true);
    await act(async () => checkbox('山を見る').props.onPress());
    expect(toggleStamp).toHaveBeenCalledWith('自然', '山を見る');
    await act(async () =>
      view.update(
        createElement(TemplateCandidatesField, {
          templates: { ...templates, ready: false, error: '通信失敗' },
          useTemplate: true,
          disabled: false,
          onUseTemplateChange,
        }),
      ),
    );
    expect(checkbox('自然').props.disabled).toBe(true);
    expect(checkbox('テンプレートを使う').props.disabled).toBe(false);
    await act(async () => checkbox('テンプレートを使う').props.onPress());
    expect(onUseTemplateChange).toHaveBeenCalledWith(false);
  } finally {
    if (view) await act(async () => view.unmount());
    warning.mockRestore();
  }
});
