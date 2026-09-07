import { Genre, InvalidGenreError } from './genre.entity.js';

describe('Genre', () => {
  it.each([null, 42, false, {}])(
    'rejects invalid direct-caller names and descriptions',
    (value) => {
      expect(() =>
        Genre.validate({ name: value as unknown as string }),
      ).toThrow(InvalidGenreError);
      expect(() =>
        Genre.validate({
          name: '有効',
          description: value as unknown as string,
        }),
      ).toThrow(InvalidGenreError);
    },
  );
  it('trims names and defaults descriptions to an empty string', () => {
    expect(Genre.validate({ name: '  食べ物  ' })).toEqual({
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
    expect(() => Genre.validate(input)).toThrow(InvalidGenreError);
  });
  it.each([
    [0, 0, false],
    [1, 0, false],
    [2, 1, false],
    [2, 2, true],
  ] as const)(
    'derives completion for %i stamps, %i completed',
    (total, completed, expected) => {
      const genre = new Genre(
        'genre',
        'trip',
        '名前',
        '',
        new Date(),
        new Date(),
        total,
        completed,
      );
      expect(genre.toJSON().isCompleted).toBe(expected);
    },
  );
});
