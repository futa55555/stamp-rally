import type { AppData } from '../../app-data/model/types';

export function validateName(
  name: string,
  userId: string,
  users: AppData['users'],
) {
  const normalized = name.trim();
  if (Array.from(normalized).length < 1 || Array.from(normalized).length > 20)
    throw new Error('名前は1〜20文字で入力してください。');
  if (users.some((u) => u.id !== userId && u.name === normalized))
    throw new Error('この名前はすでに使われています。');
  return normalized;
}
