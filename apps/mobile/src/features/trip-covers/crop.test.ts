import { describe, expect, it } from 'vitest';
import { centerCropRectangle } from './crop';

describe('centered cover crop', () => {
  it.each([
    [
      { width: 800, height: 1600 },
      { originX: 0, originY: 550, width: 800, height: 500 },
    ],
    [
      { width: 1600, height: 500 },
      { originX: 400, originY: 0, width: 800, height: 500 },
    ],
    [
      { width: 1600, height: 1000 },
      { originX: 0, originY: 0, width: 1600, height: 1000 },
    ],
  ])('uses the largest centered 8:5 crop for %o', (image, expected) => {
    expect(centerCropRectangle(image)).toEqual(expected);
  });

  it('keeps the crop centered and in bounds when pixel dimensions do not divide evenly', () => {
    for (const image of [
      { width: 4033, height: 3025 },
      { width: 3025, height: 4033 },
      { width: 9, height: 7 },
    ]) {
      const rect = centerCropRectangle(image);
      expect(rect.width / rect.height).toBe(1.6);
      expect(rect.originX).toBeGreaterThanOrEqual(0);
      expect(rect.originY).toBeGreaterThanOrEqual(0);
      expect(rect.originX + rect.width).toBeLessThanOrEqual(image.width);
      expect(rect.originY + rect.height).toBeLessThanOrEqual(image.height);
      expect(
        Math.abs(rect.originX + rect.width / 2 - image.width / 2),
      ).toBeLessThanOrEqual(0.5);
      expect(
        Math.abs(rect.originY + rect.height / 2 - image.height / 2),
      ).toBeLessThanOrEqual(0.5);
    }
  });

  it.each([
    { width: 0, height: 100 },
    { width: 7, height: 5 },
    { width: 800, height: NaN },
  ])('rejects invalid image dimensions %o', (image) => {
    expect(() => centerCropRectangle(image)).toThrow();
  });
});
