import { expect, it } from 'vitest';
import { imageCacheKey } from './imageCacheKey';

const first =
  'https://storage.example/media/post/version/large.webp?X-Amz-Date=20260910T000000Z&X-Amz-Expires=3600&X-Amz-Signature=first&X-Amz-Credential=first&X-Amz-Security-Token=first';
const renewed =
  'https://storage.example/media/post/version/large.webp?X-Amz-Date=20260910T000002Z&X-Amz-Expires=3600&X-Amz-Signature=second&X-Amz-Credential=second&X-Amz-Security-Token=second';

it('shares image identity across renewed signing times, signatures and credentials', () => {
  expect(imageCacheKey(first)).toBe(
    'https://storage.example/media/post/version/large.webp',
  );
  expect(imageCacheKey(renewed)).toBe(imageCacheKey(first));
});

it('separates sizes, versions, hosts and content transformation parameters', () => {
  for (const different of [
    first.replace('large.webp', 'small.webp'),
    first.replace('/version/', '/new-version/'),
    first.replace('storage.example', 'different.example'),
    `${first}&width=200`,
    `${first}&versionId=new`,
  ])
    expect(imageCacheKey(different)).not.toBe(imageCacheKey(first));
  expect(imageCacheKey(`${first}&height=100&width=200`)).toBe(
    imageCacheKey(`${renewed}&width=200&height=100`),
  );
});

it.each([
  'file:///local/photo.jpg',
  'content://photos/1',
  'https://images.example/photo.webp?width=100',
  'https://[invalid',
])('preserves unsigned or non-HTTP source %s', (source) => {
  expect(imageCacheKey(source)).toBe(source);
});
