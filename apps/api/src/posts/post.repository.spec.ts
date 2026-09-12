import { memberPost } from '../database/active-records.js';
import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../database/prisma.service.js';
import type { ObjectStorageService } from '../storage/object-storage.service.js';
import { PostRepository } from './post.repository.js';

function setup() {
  const post = { update: vi.fn(), findFirst: vi.fn() };
  const photoRead = { upsert: vi.fn() };
  const storage = { signGet: vi.fn() };
  const prisma = {
    post,
    photoRead,
    $transaction: vi.fn(async (fn) => fn({ post, photoRead })),
  };
  return {
    repository: new PostRepository(
      prisma as unknown as PrismaService,
      storage as unknown as ObjectStorageService,
    ),
    post,
    photoRead,
    storage,
  };
}

describe('Post repository publication boundaries', () => {
  it('trashes only accessible READY posts and does not extend an existing deadline', async () => {
    const context = setup();
    context.post.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ deletedAt: null })
      .mockResolvedValueOnce({ deletedAt: new Date(0) });
    await expect(
      context.repository.delete('pending', 'member'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(context.post.update).not.toHaveBeenCalled();
    await context.repository.delete('ready', 'member');
    expect(context.post.update).toHaveBeenCalledExactlyOnceWith({
      where: { id: 'ready' },
      data: { deletedAt: expect.any(Date) },
    });
    await context.repository.delete('ready', 'member');
    expect(context.post.update).toHaveBeenCalledTimes(1);
    expect(context.post.findFirst).toHaveBeenCalledWith({
      where: { ...memberPost('member'), id: 'ready', deletedAt: undefined },
    });
  });

  it('rejects expired restoration even before the cleanup worker runs', async () => {
    const context = setup();
    context.post.findFirst.mockResolvedValue({ deletedAt: new Date(0) });
    await expect(context.repository.restore('post', 'member')).rejects.toThrow(
      '30日間',
    );
    expect(context.post.update).not.toHaveBeenCalled();
  });

  it('checks current membership and READY status before issuing original download URLs', async () => {
    const context = setup();
    context.post.findFirst.mockResolvedValue(null);
    await expect(
      context.repository.original('post', 'user'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(context.post.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'post',
        ...memberPost('user'),
      },
    });
    expect(context.storage.signGet).not.toHaveBeenCalled();
  });

  it('does not create reads for pending media or after membership is removed', async () => {
    const context = setup();
    context.post.findFirst.mockResolvedValue(null);
    await expect(
      context.repository.markRead('post', 'user'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(context.photoRead.upsert).not.toHaveBeenCalled();
  });
});
