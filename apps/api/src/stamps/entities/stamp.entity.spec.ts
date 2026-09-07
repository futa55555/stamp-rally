import { InvalidStampError, Stamp } from './stamp.entity.js';

describe('Stamp', () => {
  it.each([null, 42, false, {}])(
    'rejects invalid direct-caller names and descriptions',
    (value) => {
      expect(() =>
        Stamp.validate({ name: value as unknown as string }),
      ).toThrow(InvalidStampError);
      expect(() =>
        Stamp.validate({
          name: '有効',
          description: value as unknown as string,
        }),
      ).toThrow(InvalidStampError);
    },
  );
  it('trims names and defaults descriptions to an empty string', () => {
    expect(Stamp.validate({ name: '  海鮮丼  ' })).toEqual({
      name: '海鮮丼',
      description: '',
    });
  });
  it.each([
    { name: '' },
    { name: ' '.repeat(5) },
    { name: 'あ'.repeat(101) },
    { name: '有効', description: 'あ'.repeat(2001) },
  ])('rejects invalid text %o', (input) => {
    expect(() => Stamp.validate(input)).toThrow(InvalidStampError);
  });
});
