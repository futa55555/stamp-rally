import { UserStatus } from '../../generated/prisma/enums.js';

export const USER_NAME_MAX_LENGTH = 20;

export class InvalidUserNameError extends Error {
  constructor() {
    super(`User name must be between 1 and ${USER_NAME_MAX_LENGTH} characters`);
    this.name = InvalidUserNameError.name;
  }
}

export class User {
  constructor(
    public readonly id: string,
    public name: string | null,
    public status: UserStatus,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  updateName(name: string): void {
    const normalizedName = name.trim();
    const nameLength = Array.from(normalizedName).length;

    if (nameLength === 0 || nameLength > USER_NAME_MAX_LENGTH) {
      throw new InvalidUserNameError();
    }

    this.name = normalizedName;

    if (this.status === UserStatus.ONBOARDING) {
      this.status = UserStatus.ACTIVE;
    }
  }
}
