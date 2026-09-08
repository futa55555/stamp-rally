export type User = {
  id: string;
  name: string | null;
  status: 'ACTIVE' | 'ONBOARDING';
};

export type LoginProvider = 'google' | 'apple';
