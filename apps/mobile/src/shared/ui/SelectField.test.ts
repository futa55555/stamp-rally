import { createElement, type ComponentProps } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SelectField } from './SelectField';

const native = vi.hoisted(() => ({ show: vi.fn() }));

vi.mock('@expo/react-native-action-sheet', () => ({
  useActionSheet: () => ({ showActionSheetWithOptions: native.show }),
}));
vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  View: 'View',
  findNodeHandle: () => 17,
}));
vi.mock('../theme/ThemeProvider', () => ({
  useAppTheme: () => ({
    colors: {
      text: '#192B25',
      surface: '#FFFFFF',
      textSecondary: '#66756D',
      border: '#E0E6DF',
    },
  }),
}));
vi.mock('./AppText', () => ({ AppText: 'AppText' }));
vi.mock('./Icon', () => ({ Icon: 'Icon' }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let renderer: ReactTestRenderer | undefined;
let props: ComponentProps<typeof SelectField>;

beforeEach(() => {
  vi.resetAllMocks();
  const originalError = console.error;
  vi.spyOn(console, 'error').mockImplementation((...args) => {
    if (String(args[0]).startsWith('react-test-renderer is deprecated')) return;
    originalError(...args);
  });
  props = {
    label: 'スタンプ',
    icon: 'postage-stamp',
    value: 'stamp-2',
    placeholder: 'スタンプを選択・作成',
    options: [
      { value: 'stamp-1', label: '海までさんぽ' },
      { value: 'stamp-2', label: '海までさんぽ' },
    ],
    onChange: vi.fn(),
    create: { label: 'スタンプを新規作成', onPress: vi.fn() },
  };
});

afterEach(async () => {
  await act(async () => renderer?.unmount());
  renderer = undefined;
  vi.restoreAllMocks();
});

const field = () => renderer!.root.findByType('Pressable' as never);
const sheet = () => {
  const [options, choose] = native.show.mock.calls.at(-1)!;
  return {
    options: options as {
      title: string;
      options: string[];
      cancelButtonIndex: number;
      anchor: number;
      useModal: boolean;
    },
    choose: choose as (index?: number) => void,
  };
};
const open = () => act(async () => field().props.onPress());
const choose = (index?: number) => act(async () => sheet().choose(index));

async function render(
  update: Partial<ComponentProps<typeof SelectField>> = {},
) {
  props = { ...props, ...update };
  await act(async () => {
    if (renderer) renderer.update(createElement(SelectField, props));
    else renderer = create(createElement(SelectField, props));
  });
}

describe('select field action sheet', () => {
  it('shows the selected label and resolves duplicate labels by ID', async () => {
    await render();
    expect(field().props.accessibilityLabel).toBe('スタンプ、海までさんぽ');
    await open();
    expect(sheet().options).toMatchObject({
      title: 'スタンプを選択',
      options: [
        '海までさんぽ',
        '海までさんぽ（選択中）',
        'スタンプを新規作成',
        'キャンセル',
      ],
      cancelButtonIndex: 3,
      anchor: 17,
      useModal: true,
    });
    await choose(1);
    expect(props.onChange).toHaveBeenCalledExactlyOnceWith('stamp-2');
    expect(props.create!.onPress).not.toHaveBeenCalled();
  });

  it('keeps cancellation and dismissal unchanged and allows reopening', async () => {
    await render();
    await open();
    await choose(sheet().options.cancelButtonIndex);
    await open();
    await choose(undefined);
    expect(native.show).toHaveBeenCalledTimes(2);
    expect(props.onChange).not.toHaveBeenCalled();
    expect(props.create!.onPress).not.toHaveBeenCalled();
  });

  it('opens only one sheet during repeated taps', async () => {
    await render();
    await act(async () => {
      field().props.onPress();
      field().props.onPress();
    });
    expect(native.show).toHaveBeenCalledOnce();
    await choose(0);
    await open();
    expect(native.show).toHaveBeenCalledTimes(2);
  });

  it('offers creation for an empty list but disables an empty field without creation', async () => {
    await render({ options: [] });
    expect(field().props.disabled).toBe(false);
    await open();
    expect(sheet().options.options).toEqual([
      'スタンプを新規作成',
      'キャンセル',
    ]);
    await choose(0);
    expect(props.create!.onPress).toHaveBeenCalledOnce();
    expect(props.onChange).not.toHaveBeenCalled();

    await render({ create: undefined });
    expect(field().props.accessibilityState.disabled).toBe(true);
    await open();
    expect(native.show).toHaveBeenCalledOnce();
  });

  it('uses the opened option ID after reordering and the latest change handler', async () => {
    await render();
    await open();
    const originalChange = props.onChange;
    const latestChange = vi.fn();
    await render({
      options: [...props.options].reverse(),
      onChange: latestChange,
    });
    await choose(0);
    expect(latestChange).toHaveBeenCalledExactlyOnceWith('stamp-1');
    expect(originalChange).not.toHaveBeenCalled();
  });

  it('ignores removed options and removed creation actions from an open sheet', async () => {
    await render();
    await open();
    await render({ options: props.options.slice(1) });
    await choose(0);
    expect(props.onChange).not.toHaveBeenCalled();

    await open();
    const create = props.create!.onPress;
    await render({ create: undefined });
    await choose(1);
    expect(create).not.toHaveBeenCalled();
    expect(props.onChange).not.toHaveBeenCalled();
  });

  it.each([0, 2])(
    'ignores open-sheet option %s after the field becomes disabled',
    async (index) => {
      await render();
      await open();
      await render({ disabled: true });
      await choose(index);
      await open();
      expect(native.show).toHaveBeenCalledOnce();
      expect(props.onChange).not.toHaveBeenCalled();
      expect(props.create!.onPress).not.toHaveBeenCalled();
    },
  );

  it('ignores a sheet callback after the field unmounts', async () => {
    await render();
    await open();
    await act(async () => renderer!.unmount());
    renderer = undefined;
    await choose(0);
    expect(props.onChange).not.toHaveBeenCalled();
  });
});
