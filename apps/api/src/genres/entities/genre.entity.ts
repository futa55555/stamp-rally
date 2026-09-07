export class InvalidGenreError extends Error {}

export class Genre {
  constructor(
    public readonly id: string,
    public readonly tripId: string,
    public name: string,
    public description: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly totalStampCount = 0,
    public readonly completedStampCount = 0,
  ) {}

  get isCompleted(): boolean {
    return (
      this.totalStampCount > 0 &&
      this.completedStampCount === this.totalStampCount
    );
  }

  static validate(input: { name: string; description?: string }) {
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    const description =
      input.description === undefined ? '' : input.description;
    if (!name || Array.from(name).length > 100) {
      throw new InvalidGenreError(
        'Genre name must be between 1 and 100 characters',
      );
    }
    if (
      typeof description !== 'string' ||
      Array.from(description).length > 2000
    ) {
      throw new InvalidGenreError(
        'Description must be at most 2000 characters',
      );
    }
    return { name, description };
  }

  toJSON() {
    return { ...this, isCompleted: this.isCompleted };
  }
}
