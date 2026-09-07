import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TripAccessService } from '../trips/trip-access.service.js';
import { CommentRepository } from './comment.repository.js';
import { CommentsService } from './comments.service.js';
import { ListCommentsDto } from './dto/list-comments.dto.js';

const repository = { create: vi.fn(), list: vi.fn() };
const access = { requireStamp: vi.fn() };

describe('CommentsService', () => {
  let service: CommentsService;
  beforeEach(() => {
    vi.resetAllMocks();
    service = new CommentsService(
      repository as unknown as CommentRepository,
      access as unknown as TripAccessService,
    );
  });

  it('normalizes text and assigns the authenticated author', async () => {
    repository.create.mockResolvedValue({ id: 'comment' });
    await expect(
      service.create('user', {
        stampId: 'stamp',
        text: '  行こう！\n楽しい  ',
      }),
    ).resolves.toEqual({ id: 'comment' });
    expect(access.requireStamp).toHaveBeenCalledWith('user', 'stamp');
    expect(repository.create).toHaveBeenCalledWith({
      stampId: 'stamp',
      authorId: 'user',
      text: '行こう！\n楽しい',
    });
  });

  it.each(['', ' \n\t ', 'あ'.repeat(2001)])(
    'rejects invalid text',
    async (text) => {
      await expect(
        service.create('user', { stampId: 'stamp', text }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    },
  );

  it('counts Unicode code points consistently with DTO validation', async () => {
    await service.create('user', { stampId: 'stamp', text: '😀'.repeat(2000) });
    expect(repository.create).toHaveBeenCalledOnce();
  });

  it('returns the stamp comment page after verifying membership', async () => {
    const query = Object.assign(new ListCommentsDto(), {
      stampId: 'stamp',
      limit: 10,
    });
    repository.list.mockResolvedValue({
      items: [{ id: 'comment' }],
      nextCursor: null,
    });
    await expect(service.findAll('user', query)).resolves.toEqual({
      items: [{ id: 'comment' }],
      nextCursor: null,
    });
    expect(access.requireStamp).toHaveBeenCalledWith('user', 'stamp');
    expect(repository.list).toHaveBeenCalledWith(query);
  });

  it('prevents reading and creating comments in another trip', async () => {
    access.requireStamp.mockRejectedValue(new NotFoundException());
    await expect(
      service.create('outsider', { stampId: 'stamp', text: 'hello' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.findAll(
        'outsider',
        Object.assign(new ListCommentsDto(), { stampId: 'stamp' }),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.list).not.toHaveBeenCalled();
  });
});
