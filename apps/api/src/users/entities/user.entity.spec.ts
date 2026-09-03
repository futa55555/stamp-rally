import { UserStatus } from '../../generated/prisma/enums.js';
import {
  InvalidUserNameError,
  User,
  USER_NAME_MAX_LENGTH,
} from './user.entity.js';

function createUser(
  name: string | null = null,
  status: UserStatus = UserStatus.ONBOARDING,
): User {
  return new User(
    'user-id',
    name,
    status,
    new Date('2026-09-03T00:00:00.000Z'),
    new Date('2026-09-03T00:00:00.000Z'),
  );
}

describe('User', () => {
  describe('updateName', () => {
    it('updates the name and activates an onboarding user', () => {
      const user = createUser();

      user.updateName('Futa');

      expect(user.name).toBe('Futa');
      expect(user.status).toBe(UserStatus.ACTIVE);
    });

    it('trims surrounding whitespace', () => {
      const user = createUser();

      user.updateName('  Futa  ');

      expect(user.name).toBe('Futa');
    });

    it('keeps an active user active when changing the name', () => {
      const user = createUser('Old Name', UserStatus.ACTIVE);

      user.updateName('New Name');

      expect(user.name).toBe('New Name');
      expect(user.status).toBe(UserStatus.ACTIVE);
    });

    it('rejects an empty name', () => {
      const user = createUser();

      expect(() => user.updateName('   ')).toThrow(InvalidUserNameError);
    });

    it('rejects a name longer than the maximum length', () => {
      const user = createUser();
      const longName = 'あ'.repeat(USER_NAME_MAX_LENGTH + 1);

      expect(() => user.updateName(longName)).toThrow(InvalidUserNameError);
    });

    it('accepts a name at the maximum length', () => {
      const user = createUser();
      const name = 'あ'.repeat(USER_NAME_MAX_LENGTH);

      user.updateName(name);

      expect(user.name).toBe(name);
    });
  });
});
