import { BadRequestException } from '@nestjs/common';
import { parseTripTemplatePresets } from './preset-catalog.js';
import {
  previewTripTemplates,
  TripTemplatesService,
} from './trip-templates.service.js';
import type { TripTemplatePresets } from './types.js';

const fixture = (): TripTemplatePresets => ({
  locations: [
    {
      name: '島県',
      aliases: ['島', 'しま', '島県'],
      template: {
        categories: [
          {
            name: '景色',
            stamps: [{ title: '海を見る' }, { title: '山を見る' }],
          },
          { name: '記録', stamps: [{ title: '海を見る' }] },
          { name: '景色', stamps: [{ title: '海を見る' }] },
        ],
      },
    },
    {
      name: '山県',
      aliases: ['山'],
      template: {
        categories: [{ name: '景色', stamps: [{ title: '山を見る' }] }],
      },
    },
  ],
  activities: [
    {
      name: '海',
      template: {
        categories: [
          {
            name: '景色',
            stamps: [{ title: '海を見る' }, { title: '夕日を見る' }],
          },
          { name: 'グルメ', stamps: [{ title: '魚を食べる' }] },
        ],
      },
    },
    {
      name: '島県',
      template: {
        categories: [{ name: '景色', stamps: [{ title: '海を見る' }] }],
      },
    },
  ],
});

describe('trip template merging', () => {
  it('matches trimmed names and aliases exactly, ignoring unknown locations', () => {
    const catalog = fixture();
    const expected = previewTripTemplates(catalog, { locations: ['島県'] });
    expect(previewTripTemplates(catalog, { locations: ['  島  '] })).toEqual(
      expected,
    );
    expect(previewTripTemplates(catalog, { locations: ['しま'] })).toEqual(
      expected,
    );
    expect(
      previewTripTemplates(catalog, { locations: ['島市', '島県への旅'] }),
    ).toEqual({ categories: [] });
  });

  it('merges category and stamp duplicates in encounter order, places first', () => {
    expect(
      previewTripTemplates(fixture(), {
        locations: ['島県'],
        activityPresets: ['海'],
      }),
    ).toEqual({
      categories: [
        {
          name: '景色',
          stamps: [
            {
              title: '海を見る',
              sources: [
                { type: 'location', name: '島県' },
                { type: 'activity', name: '海' },
              ],
            },
            {
              title: '山を見る',
              sources: [{ type: 'location', name: '島県' }],
            },
            {
              title: '夕日を見る',
              sources: [{ type: 'activity', name: '海' }],
            },
          ],
        },
        {
          name: '記録',
          stamps: [
            {
              title: '海を見る',
              sources: [{ type: 'location', name: '島県' }],
            },
          ],
        },
        {
          name: 'グルメ',
          stamps: [
            {
              title: '魚を食べる',
              sources: [{ type: 'activity', name: '海' }],
            },
          ],
        },
      ],
    });
  });

  it('respects location input order instead of catalog order', () => {
    const preview = previewTripTemplates(fixture(), {
      locations: ['山', '島'],
    });
    expect(preview.categories[0].stamps.map((stamp) => stamp.title)).toEqual([
      '山を見る',
      '海を見る',
    ]);
    expect(preview.categories[0].stamps[0].sources).toEqual([
      { type: 'location', name: '山県' },
      { type: 'location', name: '島県' },
    ]);
  });

  it('deduplicates aliases and repeated selections but preserves source type', () => {
    const preview = previewTripTemplates(fixture(), {
      locations: ['島県', '島', '島県'],
      activityPresets: ['島県', '島県', ' 海 ', '海'],
    });
    expect(preview.categories[0].stamps[0].sources).toEqual([
      { type: 'location', name: '島県' },
      { type: 'activity', name: '島県' },
      { type: 'activity', name: '海' },
    ]);
  });

  it('retains shared stamps until their last source is removed', () => {
    const catalog = fixture();
    const initial = previewTripTemplates(catalog, {
      locations: ['島県'],
      activityPresets: ['海'],
    });
    expect(initial.categories[0].stamps[0].sources).toHaveLength(2);
    const remaining = previewTripTemplates(catalog, {
      activityPresets: ['海'],
    });
    expect(remaining.categories[0].stamps[0]).toEqual({
      title: '海を見る',
      sources: [{ type: 'activity', name: '海' }],
    });
    expect(previewTripTemplates(catalog, {})).toEqual({ categories: [] });
  });

  it('rejects unknown activities and ignores empty trimmed input', () => {
    expect(() =>
      previewTripTemplates(fixture(), { activityPresets: ['海水浴'] }),
    ).toThrow(BadRequestException);
    expect(
      previewTripTemplates(fixture(), {
        locations: [' '],
        activityPresets: [' '],
      }),
    ).toEqual({ categories: [] });
  });

  it('treats prototype property names as ordinary preset, category and stamp names', () => {
    const catalog = parseTripTemplatePresets({
      locations: [
        {
          name: '__proto__',
          aliases: ['constructor'],
          template: {
            categories: [
              { name: '__proto__', stamps: [{ title: 'constructor' }] },
            ],
          },
        },
      ],
      activities: [
        {
          name: 'toString',
          template: {
            categories: [
              { name: '__proto__', stamps: [{ title: 'constructor' }] },
            ],
          },
        },
      ],
    });
    expect(
      previewTripTemplates(catalog, {
        locations: ['constructor'],
        activityPresets: ['toString'],
      }).categories,
    ).toEqual([
      {
        name: '__proto__',
        stamps: [
          {
            title: 'constructor',
            sources: [
              { type: 'location', name: '__proto__' },
              { type: 'activity', name: 'toString' },
            ],
          },
        ],
      },
    ]);
  });

  it('does not mutate the catalog or reuse mutable response objects', () => {
    const catalog = fixture();
    const before = structuredClone(catalog);
    const first = previewTripTemplates(catalog, { locations: ['島県'] });
    first.categories[0].stamps[0].sources[0].name = 'changed';
    first.categories[0].stamps.push({ title: 'extra', sources: [] });
    expect(catalog).toEqual(before);
    expect(
      previewTripTemplates(catalog, { locations: ['島県'] }).categories[0]
        .stamps,
    ).toHaveLength(2);
  });
});

describe('preset catalog validation', () => {
  it('accepts valid catalogs, including duplicate same-preset aliases', () => {
    expect(parseTripTemplatePresets(fixture())).toEqual(fixture());
  });

  it('accepts 100 Unicode characters for names and titles', () => {
    const catalog = fixture();
    catalog.activities[0].name = 'あ'.repeat(100);
    catalog.activities[0].template.categories[0].name = '😀'.repeat(100);
    catalog.activities[0].template.categories[0].stamps[0].title = '😀'.repeat(
      100,
    );
    expect(parseTripTemplatePresets(catalog)).toEqual(catalog);
  });

  it.each(['', '  ', ' 海', '海 ', 'あ'.repeat(101), '😀'.repeat(101)])(
    'rejects empty, padded, or overlong names and titles: %s',
    (invalidName) => {
      for (const field of ['preset', 'alias', 'category', 'stamp']) {
        const catalog = fixture();
        if (field === 'preset') catalog.locations[0].name = invalidName;
        if (field === 'alias') catalog.locations[0].aliases = [invalidName];
        if (field === 'category')
          catalog.locations[0].template.categories[0].name = invalidName;
        if (field === 'stamp')
          catalog.locations[0].template.categories[0].stamps[0].title =
            invalidName;
        expect(() => parseTripTemplatePresets(catalog)).toThrow(
          /Invalid trip-template-presets.json at \$\.locations\[0\]/,
        );
      }
    },
  );

  it.each([
    null,
    [],
    {},
    { locations: [], activities: [], typo: true },
    { locations: null, activities: [] },
    {
      locations: [{ name: '場所', aliases: [], template: {} }],
      activities: [],
    },
    {
      locations: [],
      activities: [
        {
          name: '海',
          template: { categories: [{ name: '景色', stamps: [null] }] },
        },
      ],
    },
    {
      locations: [],
      activities: [
        {
          name: '海',
          template: {
            categories: [{ name: '景色', stamps: [{ name: '誤った項目' }] }],
          },
        },
      ],
    },
  ])('rejects malformed structures with a source path: %o', (catalog) => {
    expect(() => parseTripTemplatePresets(catalog)).toThrow(
      /Invalid trip-template-presets.json at \$/,
    );
  });

  it('rejects duplicate preset names within each kind', () => {
    const catalog = fixture();
    catalog.locations.push(structuredClone(catalog.locations[0]));
    expect(() => parseTripTemplatePresets(catalog)).toThrow(
      'duplicate location',
    );
    const activities = fixture();
    activities.activities.push(structuredClone(activities.activities[0]));
    expect(() => parseTripTemplatePresets(activities)).toThrow(
      'duplicate activity',
    );
  });

  it.each(['島県', '島'])('rejects name or alias collisions: %s', (alias) => {
    const catalog = fixture();
    catalog.locations[1].aliases.push(alias);
    expect(() => parseTripTemplatePresets(catalog)).toThrow('also belongs to');
  });
});

describe('TripTemplatesService', () => {
  let service: TripTemplatesService;

  beforeEach(() => {
    service = new TripTemplatesService();
    vi.spyOn(service, 'preview').mockImplementation((input) =>
      previewTripTemplates(fixture(), input),
    );
  });

  it('exposes the editable catalog without template payloads', () => {
    const catalog = service.catalog();
    expect(Array.isArray(catalog.locations)).toBe(true);
    expect(Array.isArray(catalog.activities)).toBe(true);
    for (const preset of catalog.locations) {
      expect(Object.keys(preset)).toEqual(['key', 'name', 'aliases']);
    }
    for (const preset of catalog.activities) {
      expect(Object.keys(preset)).toEqual(['key', 'name']);
    }
  });

  it('selects only requested stamps and excludes empty categories', () => {
    expect(
      service.select({ locations: ['島'] }, [
        { name: '景色', stamps: [{ title: '山を見る' }] },
        { name: '記録', stamps: [] },
      ]),
    ).toEqual([{ name: '景色', stamps: [{ title: '山を見る' }] }]);
  });

  it('deduplicates selected categories and stamps without mutating the selection', () => {
    const selected = [
      { name: '景色', stamps: [{ title: '海を見る' }, { title: '海を見る' }] },
      { name: '景色', stamps: [{ title: '山を見る' }, { title: '海を見る' }] },
    ];
    const before = structuredClone(selected);
    expect(service.select({ locations: ['島'] }, selected)).toEqual([
      { name: '景色', stamps: [{ title: '海を見る' }, { title: '山を見る' }] },
    ]);
    expect(selected).toEqual(before);
  });

  it('supports omitted or empty selection and still validates activities', () => {
    expect(service.select({ locations: ['未知の場所'] })).toEqual([]);
    expect(service.select({ locations: ['島'] }, [])).toEqual([]);
    expect(() => service.select({ activityPresets: ['unknown'] })).toThrow(
      BadRequestException,
    );
  });

  it.each([
    [{ name: '未登録', stamps: [] }],
    [{ name: '景色', stamps: [{ title: '知らない景色' }] }],
    [{ name: '記録', stamps: [{ title: '山を見る' }] }],
    [{ name: '__proto__', stamps: [{ title: 'constructor' }] }],
  ])('rejects any selection outside the current candidates: %o', (selected) => {
    expect(() => service.select({ locations: ['島'] }, [selected])).toThrow(
      BadRequestException,
    );
  });

  it('rejects otherwise valid stamps after their input source is removed', () => {
    expect(() =>
      service.select({}, [{ name: '景色', stamps: [{ title: '海を見る' }] }]),
    ).toThrow(BadRequestException);
  });
});

describe('bundled template memberships', () => {
  it('shares night scenery across locations and activities in the scenery category', () => {
    const service = new TripTemplatesService();
    const preview = service.preview({
      locations: ['大阪府'],
      activityPresets: ['贅沢ディナー', '夜景'],
    });
    const memberships = preview.categories.filter((category) =>
      category.stamps.some((stamp) => stamp.title === '夜景を楽しむ'),
    );
    expect(memberships.map((category) => category.name)).toMatchObject([
      '景色',
    ]);
    for (const category of memberships) {
      expect(
        category.stamps.filter((stamp) => stamp.title === '夜景を楽しむ'),
      ).toMatchObject([
        {
          title: '夜景を楽しむ',
          sources: [
            { type: 'location', name: '大阪府' },
            { type: 'activity', name: '贅沢ディナー' },
            { type: 'activity', name: '夜景' },
          ],
        },
      ]);
    }
  });

  it.each([
    [
      '遊園地・テーマパーク',
      'パークならではのフードを食べる',
      ['グルメ', '遊園地'],
    ],
    [
      '遊園地・テーマパーク',
      'パークならではのドリンクを飲む',
      ['グルメ', '遊園地'],
    ],
    ['ものづくり体験', '制作途中の様子を写真に撮る', ['ものづくり']],
    ['ものづくり体験', '完成した作品を記念に残す', ['ものづくり']],
    ['夜景', '水面に映る光を写真に撮る', ['景色']],
    ['ゆっくり', 'カフェでひと休みする', ['グルメ', '休息']],
    ['ものづくり体験', 'カフェでひと休みする', ['グルメ', '休息']],
    ['歴史探訪', '古い町並みを散歩する', ['歴史・文化', 'まち歩き']],
    ['歴史探訪', '老舗の名物を食べる', ['歴史・文化', 'グルメ']],
    ['歴史探訪', '歴史にちなんだおみやげを買う', ['歴史・文化', 'おみやげ']],
  ] as const)(
    '%s: %s belongs to each relevant category',
    (activity, title, expected) => {
      const preview = new TripTemplatesService().preview({
        activityPresets: [activity],
      });
      expect(
        preview.categories
          .filter((category) =>
            category.stamps.some((stamp) => stamp.title === title),
          )
          .map((category) => category.name),
      ).toEqual(expected);
    },
  );

  it('removes replaced titles from every preset and leaves the two craft milestones distinct', () => {
    const service = new TripTemplatesService();
    const catalog = service.catalog();
    const preview = service.preview({
      locations: catalog.locations.map((preset) => preset.name),
      activityPresets: catalog.activities.map((preset) => preset.name),
    });
    const titles = preview.categories.flatMap((category) =>
      category.stamps.map((stamp) => stamp.title),
    );
    for (const replaced of [
      '街の夜景を眺める',
      '夜景を背景に記念写真を撮る',
      '完成した作品を写真に撮る',
      '作品と一緒に記念写真を撮る',
      'お互いの作品を並べて写真に撮る',
    ])
      expect(titles).not.toContain(replaced);
    const craft = service.preview({ activityPresets: ['ものづくり体験'] });
    expect(
      craft.categories
        .find((category) => category.name === 'ものづくり')
        ?.stamps.map((stamp) => stamp.title),
    ).toEqual(
      expect.arrayContaining([
        '制作途中の様子を写真に撮る',
        '完成した作品を記念に残す',
      ]),
    );
  });
});

it('keeps template identity and source provenance after every display label changes', () => {
  const catalog: TripTemplatePresets = {
    locations: [],
    activities: [
      {
        key: 'activity-one',
        name: '海',
        template: {
          categories: [
            {
              key: 'category-one',
              name: '景色',
              stamps: [{ key: 'stamp-one', title: '海を見る' }],
            },
          ],
        },
      },
    ],
  };
  const before = previewTripTemplates(parseTripTemplatePresets(catalog, true), {
    activityPresets: ['海'],
  });
  catalog.activities[0].name = '海辺';
  catalog.activities[0].template.categories[0].name = '自然';
  catalog.activities[0].template.categories[0].stamps[0].title = '海を眺める';
  const after = previewTripTemplates(parseTripTemplatePresets(catalog, true), {
    activityPresets: ['海辺'],
  });
  expect(after.categories[0].key).toBe(before.categories[0].key);
  expect(after.categories[0].stamps[0].key).toBe(
    before.categories[0].stamps[0].key,
  );
  expect(after.categories[0].stamps[0].sources[0].key).toBe(
    before.categories[0].stamps[0].sources[0].key,
  );
  delete catalog.activities[0].template.categories[0].stamps[0].key;
  expect(() => parseTripTemplatePresets(catalog, true)).toThrow(
    'stable template key',
  );
});

it('accepts stable create selection keys after labels have changed', () => {
  const service = new TripTemplatesService();
  const input = { activityPresets: ['夜景'] };
  const category = service.preview(input).categories[0];
  const stamp = category.stamps[0];
  expect(
    service.identified(input, [
      {
        key: category.key,
        name: '旧カテゴリー名',
        stamps: [{ key: stamp.key, title: '旧スタンプ名' }],
      },
    ]),
  ).toMatchObject([
    {
      key: category.key,
      name: category.name,
      stamps: [{ key: stamp.key, title: stamp.title, sources: stamp.sources }],
    },
  ]);
});
