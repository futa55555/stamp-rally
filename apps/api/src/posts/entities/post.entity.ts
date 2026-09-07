import { isURL } from 'class-validator';
import { MediaType } from '../../generated/prisma/enums.js';

export class InvalidPostMediaError extends Error {
  constructor() {
    super(
      'A post requires one IMAGE or VIDEO with a valid HTTPS URL of at most 2048 characters',
    );
    this.name = InvalidPostMediaError.name;
  }
}

export class Post {
  constructor(
    public readonly id: string,
    public readonly stampId: string,
    public readonly genreId: string,
    public readonly tripId: string,
    public readonly author: { id: string; name: string | null },
    public readonly mediaType: MediaType,
    public readonly mediaUrl: string,
    public readonly isFavorite: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static validateMedia(mediaType: MediaType, mediaUrl: string): string {
    if (mediaType !== MediaType.IMAGE && mediaType !== MediaType.VIDEO) {
      throw new InvalidPostMediaError();
    }

    const normalized = typeof mediaUrl === 'string' ? mediaUrl.trim() : '';
    if (
      normalized.length > 2048 ||
      !isURL(normalized, {
        protocols: ['https'],
        require_protocol: true,
        require_valid_protocol: true,
        require_tld: false,
      })
    ) {
      throw new InvalidPostMediaError();
    }

    return normalized;
  }
}
