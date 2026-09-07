import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaginationQueryDto, paginate, paginationWhere } from './pagination.js';

describe('Cursor pagination', () => {
  const rows = [
    {
      id: '00000000-0000-4000-8000-000000000001',
      createdAt: new Date('2026-09-07T00:00:00.000Z'),
    },
    {
      id: '00000000-0000-4000-8000-000000000002',
      createdAt: new Date('2026-09-07T00:00:00.000Z'),
    },
  ];

  it('uses both timestamp and ID, preserving tied timestamps', () => {
    const page = paginate(rows, 1);
    expect(page.items).toEqual([rows[0]]);
    const query = Object.assign(new PaginationQueryDto(), {
      cursor: page.nextCursor,
    });
    expect(paginationWhere(query, 'asc')).toEqual({
      OR: [
        { createdAt: { gt: rows[0].createdAt } },
        { createdAt: rows[0].createdAt, id: { gt: rows[0].id } },
      ],
    });
    expect(paginationWhere(query, 'desc')).toEqual({
      OR: [
        { createdAt: { lt: rows[0].createdAt } },
        { createdAt: rows[0].createdAt, id: { lt: rows[0].id } },
      ],
    });
    expect(paginate(rows, 2).nextCursor).toBeNull();
    expect(paginate([], 20)).toEqual({ items: [], nextCursor: null });
  });

  it.each([
    '',
    'not-a-cursor',
    Buffer.from('{"id":"invalid","createdAt":"yesterday"}').toString(
      'base64url',
    ),
  ])('rejects malformed cursor %s', (cursor) => {
    expect(() =>
      paginationWhere(
        Object.assign(new PaginationQueryDto(), { cursor }),
        'asc',
      ),
    ).toThrow(BadRequestException);
  });

  it.each(['0', '101', '-1', '1.5', '', null, ['20']])(
    'rejects invalid page size %s',
    async (limit) => {
      expect(
        await validate(plainToInstance(PaginationQueryDto, { limit })),
      ).not.toHaveLength(0);
    },
  );

  it('defaults to 20 and converts integer query strings', async () => {
    expect(plainToInstance(PaginationQueryDto, {}).limit).toBe(20);
    const query = plainToInstance(PaginationQueryDto, { limit: '100' });
    expect(query.limit).toBe(100);
    expect(await validate(query)).toHaveLength(0);
  });
});
