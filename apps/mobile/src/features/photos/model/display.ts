import type { Post } from './types';

// mediaUrl is a legacy field and may be an unconverted original. Never use it
// as a display fallback, even if a derivative is missing or fails to load.
export function displayUrl(
  post: Post,
  variant: 'small' | 'large',
): string | null {
  if (post.status && post.status !== 'READY') return null;
  return (variant === 'small' ? post.smallUrl : post.largeUrl) ?? null;
}
