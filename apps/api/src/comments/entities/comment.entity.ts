export class InvalidCommentTextError extends Error {
  constructor() {
    super('Comment text must be between 1 and 2000 characters');
    this.name = InvalidCommentTextError.name;
  }
}

export class Comment {
  constructor(
    public readonly id: string,
    public readonly stampId: string,
    public readonly author: { id: string; name: string | null },
    public readonly text: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static normalizeText(text: string): string {
    const normalized = typeof text === 'string' ? text.trim() : '';
    const length = Array.from(normalized).length;
    if (length < 1 || length > 2000) throw new InvalidCommentTextError();
    return normalized;
  }
}
