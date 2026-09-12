import { Category, InvalidCategoryError } from './category.entity.js';

describe('Category', () => {
  it.each([null, 42, false, {}])(
    'rejects invalid direct-caller names and descriptions',
    (value) => {
      expect(() =>
        Category.validate({ name: value as unknown as string }),
      ).toThrow(InvalidCategoryError);
      expect(() =>
        Category.validate({
          name: '有効',
          description: value as unknown as string,
        }),
      ).toThrow(InvalidCategoryError);
    },
  );
  it('trims names and defaults descriptions to an empty string', () => {
    expect(Category.validate({ name: '  食べ物  ' })).toEqual({
      name: '食べ物',
      description: '',
    });
  });
  it.each([
    { name: '' },
    { name: ' '.repeat(5) },
    { name: 'あ'.repeat(101) },
    { name: '有効', description: 'あ'.repeat(2001) },
  ])('rejects invalid text %o', (input) => {
    expect(() => Category.validate(input)).toThrow(InvalidCategoryError);
  });
  it.each([
    [0, 0, false],
    [1, 0, false],
    [2, 1, false],
    [2, 2, true],
  ] as const)(
    'derives completion for %i stamps, %i completed',
    (total, completed, expected) => {
      const category = new Category(
        'category',
        'trip',
        '名前',
        '',
        new Date(),
        new Date(),
        total,
        completed,
      );
      expect(category.toJSON().isCompleted).toBe(expected);
    },
  );
});
