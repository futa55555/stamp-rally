export class InvalidStampError extends Error {}

export class Stamp {
  constructor(
    public readonly id: string,
    public readonly tripId: string,
    public readonly categoryIds: string[],
    public name: string,
    public description: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly isCompleted: boolean,
    public readonly hasUnreadPhotos = false,
    public readonly photoCount = 0,
    public readonly videoCount = 0,
    public readonly mediaCount = photoCount + videoCount,
    public readonly hasUnreadMedia = hasUnreadPhotos,
  ) {}

  static validate(input: { name: string; description?: string }) {
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    const description =
      input.description === undefined ? '' : input.description;
    if (!name || Array.from(name).length > 100) {
      throw new InvalidStampError(
        'Stamp name must be between 1 and 100 characters',
      );
    }
    if (
      typeof description !== 'string' ||
      Array.from(description).length > 2000
    ) {
      throw new InvalidStampError(
        'Description must be at most 2000 characters',
      );
    }
    return { name, description };
  }
}
