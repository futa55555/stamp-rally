import { demoPhotoUrls as photos } from '../../../../assets/demoPhotoUrls';
import { offsetDate } from '../../../shared/lib/dates';
import type { Post } from '../../photos/model/types';
import type { Category, Stamp, Trip } from '../../trips/model/types';
import type { AppData } from '../model/types';

const id = (kind: number, index: number) =>
  `00000000-0000-4000-8000-${String(kind * 1000 + index).padStart(12, '0')}`;

export const DEMO_USER_ID = id(1, 1);

export function createDemoData(now = new Date()): AppData {
  const time = (days: number) =>
    new Date(now.getTime() + days * 86_400_000).toISOString();
  const users: AppData['users'] = [
    { id: DEMO_USER_ID, name: 'はる', status: 'ACTIVE' },
    { id: id(1, 2), name: 'あおい', status: 'ACTIVE' },
    { id: id(1, 3), name: 'ゆう', status: 'ACTIVE' },
  ];
  const trip = (
    index: number,
    name: string,
    start: number,
    end: number,
    cover: string,
    created: number,
  ): Trip => ({
    id: id(2, index),
    name,
    startDate: offsetDate(now, start),
    endDate: offsetDate(now, end),
    coverImageUrl: cover,
    locations: index === 1 ? ['京都'] : index === 2 ? ['海辺'] : [],
    activityPresets: [],
    customActivities: [],
    createdById: DEMO_USER_ID,
    createdAt: time(created),
    updatedAt: time(created),
    totalCategoryCount: 0,
    completedCategoryCount: 0,
    isCompleted: false,
  });
  const trips = [
    trip(1, '京都、よりみちの旅', -1, 2, photos.kyoto, -15),
    trip(2, '海辺で過ごす週末', -45, -43, photos.coast, -55),
    trip(3, '富士山と、深呼吸。', 20, 22, photos.fuji, -3),
  ];
  const category = (
    index: number,
    tripIndex: number,
    name: string,
    description: string,
  ): Category => ({
    id: id(3, index),
    tripId: id(2, tripIndex),
    name,
    description,
    createdAt: time(-10 + index / 10),
    updatedAt: time(-1),
    totalStampCount: 0,
    completedStampCount: 0,
    isCompleted: false,
    hasUnreadPhotos: false,
  });
  const categories = [
    category(1, 1, '景色とまち歩き', '路地の先で見つけた、忘れたくない景色。'),
    category(2, 1, 'おいしい寄り道', '旅先で出会った一杯と、ひと皿の記録。'),
    category(3, 1, '小さな発見', '予定になかった出会いも、旅の思い出に。'),
    category(4, 2, '海のある風景', '波の音を聴きながら、ゆっくり歩こう。'),
  ];
  const stamp = (
    index: number,
    categoryIndex: number,
    name: string,
    description: string,
  ): Stamp => ({
    id: id(4, index),
    categoryIds: [id(3, categoryIndex)],
    tripId: categories.find((category) => category.id === id(3, categoryIndex))!
      .tripId,
    name,
    description,
    createdAt: time(-8 + index / 10),
    updatedAt: time(-1),
    isCompleted: false,
    hasUnreadPhotos: false,
    photoCount: 0,
  });
  const stamps = [
    stamp(
      1,
      1,
      '朝のまちを歩く',
      'まだ静かなまちで、お気に入りの景色を見つけよう。',
    ),
    stamp(2, 1, '緑に包まれる', '木漏れ日の下で、ひと休み。'),
    stamp(3, 1, '夕暮れを眺める', '今日の終わりに、空を見上げて。'),
    stamp(4, 2, '喫茶店でひと息', '歩き疲れたら、おいしいコーヒーを。'),
    stamp(5, 2, '旅先のごはん', 'みんなで囲む、今日の食卓。'),
    stamp(6, 4, '海までさんぽ', '水平線の向こうまで。'),
  ];
  const post = (
    index: number,
    stampIndex: number,
    userIndex: number,
    mediaUrl: string,
    isFavorite: boolean,
  ): Post => {
    const parent = stamps.find((s) => s.id === id(4, stampIndex))!;
    return {
      id: id(5, index),
      stampId: parent.id,
      categoryIds: [...parent.categoryIds],
      tripId: parent.tripId,
      author: { id: users[userIndex].id, name: users[userIndex].name },
      mediaType: 'IMAGE',
      readAt: null,
      mediaUrl,
      isFavorite,
      createdAt: time(-0.5 + index / 100),
      updatedAt: time(-0.5 + index / 100),
    };
  };
  const posts = [
    post(1, 1, 1, photos.kyoto, true),
    post(2, 1, 2, photos.street, true),
    post(3, 1, 0, photos.kyoto, false),
    post(4, 2, 1, photos.forest, false),
    post(5, 4, 2, photos.coffee, true),
    post(6, 6, 0, photos.coast, true),
  ];
  for (const s of stamps) s.isCompleted = posts.some((p) => p.stampId === s.id);
  for (const g of categories) {
    const children = stamps.filter((s) => s.categoryIds.includes(g.id));
    g.totalStampCount = children.length;
    g.completedStampCount = children.filter((s) => s.isCompleted).length;
    g.isCompleted = children.length > 0 && children.every((s) => s.isCompleted);
  }
  for (const t of trips) {
    const children = categories.filter((g) => g.tripId === t.id);
    t.totalCategoryCount = children.length;
    t.completedCategoryCount = children.filter((g) => g.isCompleted).length;
    t.isCompleted = children.length > 0 && children.every((g) => g.isCompleted);
  }
  return {
    users,
    trips,
    categories,
    stamps,
    posts,
    memberships: trips.flatMap((t) =>
      users.map((u) => ({ tripId: t.id, userId: u.id })),
    ),
    readPhotoIds: { [DEMO_USER_ID]: [id(5, 2), id(5, 4)] },
    notifications: [
      {
        id: id(6, 1),
        recipientId: DEMO_USER_ID,
        title: '新しい思い出が届きました',
        body: '「朝のまちを歩く」に写真が追加されました。',
        createdAt: time(-0.1),
        readAt: null,
        target: { type: 'photo', postId: id(5, 1) },
      },
      {
        id: id(6, 2),
        recipientId: DEMO_USER_ID,
        title: '喫茶店でひと息',
        body: '新しい写真を見にいきましょう。',
        createdAt: time(-0.2),
        readAt: null,
        target: { type: 'stamp', stampId: id(4, 4) },
      },
      {
        id: id(6, 3),
        recipientId: DEMO_USER_ID,
        title: '旅の予定が更新されました',
        body: '「京都、よりみちの旅」の旅行情報を確認できます。',
        createdAt: time(-0.8),
        readAt: time(-0.7),
        target: { type: 'trip', tripId: id(2, 1) },
      },
      {
        id: id(6, 4),
        recipientId: DEMO_USER_ID,
        title: '次は、どこに寄り道する？',
        body: '「おいしい寄り道」のスタンプをチェック。',
        createdAt: time(-1),
        readAt: time(-0.9),
        target: { type: 'category', categoryId: id(3, 2) },
      },
    ],
  };
}
