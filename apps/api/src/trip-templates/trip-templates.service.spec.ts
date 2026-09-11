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
        genres: [
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
        genres: [{ name: '景色', stamps: [{ title: '山を見る' }] }],
      },
    },
  ],
  activities: [
    {
      name: '海',
      template: {
        genres: [
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
        genres: [{ name: '景色', stamps: [{ title: '海を見る' }] }],
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
    ).toEqual({ genres: [] });
  });

  it('merges genre and stamp duplicates in encounter order, places first', () => {
    expect(
      previewTripTemplates(fixture(), {
        locations: ['島県'],
        activityPresets: ['海'],
      }),
    ).toEqual({
      genres: [
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
    expect(preview.genres[0].stamps.map((stamp) => stamp.title)).toEqual([
      '山を見る',
      '海を見る',
    ]);
    expect(preview.genres[0].stamps[0].sources).toEqual([
      { type: 'location', name: '山県' },
      { type: 'location', name: '島県' },
    ]);
  });

  it('deduplicates aliases and repeated selections but preserves source type', () => {
    const preview = previewTripTemplates(fixture(), {
      locations: ['島県', '島', '島県'],
      activityPresets: ['島県', '島県', ' 海 ', '海'],
    });
    expect(preview.genres[0].stamps[0].sources).toEqual([
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
    expect(initial.genres[0].stamps[0].sources).toHaveLength(2);
    const remaining = previewTripTemplates(catalog, {
      activityPresets: ['海'],
    });
    expect(remaining.genres[0].stamps[0]).toEqual({
      title: '海を見る',
      sources: [{ type: 'activity', name: '海' }],
    });
    expect(previewTripTemplates(catalog, {})).toEqual({ genres: [] });
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
    ).toEqual({ genres: [] });
  });

  it('treats prototype property names as ordinary preset, genre and stamp names', () => {
    const catalog = parseTripTemplatePresets({
      locations: [
        {
          name: '__proto__',
          aliases: ['constructor'],
          template: {
            genres: [{ name: '__proto__', stamps: [{ title: 'constructor' }] }],
          },
        },
      ],
      activities: [
        {
          name: 'toString',
          template: {
            genres: [{ name: '__proto__', stamps: [{ title: 'constructor' }] }],
          },
        },
      ],
    });
    expect(
      previewTripTemplates(catalog, {
        locations: ['constructor'],
        activityPresets: ['toString'],
      }).genres,
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
    first.genres[0].stamps[0].sources[0].name = 'changed';
    first.genres[0].stamps.push({ title: 'extra', sources: [] });
    expect(catalog).toEqual(before);
    expect(
      previewTripTemplates(catalog, { locations: ['島県'] }).genres[0].stamps,
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
    catalog.activities[0].template.genres[0].name = '😀'.repeat(100);
    catalog.activities[0].template.genres[0].stamps[0].title = '😀'.repeat(100);
    expect(parseTripTemplatePresets(catalog)).toEqual(catalog);
  });

  it.each(['', '  ', ' 海', '海 ', 'あ'.repeat(101), '😀'.repeat(101)])(
    'rejects empty, padded, or overlong names and titles: %s',
    (invalidName) => {
      for (const field of ['preset', 'alias', 'genre', 'stamp']) {
        const catalog = fixture();
        if (field === 'preset') catalog.locations[0].name = invalidName;
        if (field === 'alias') catalog.locations[0].aliases = [invalidName];
        if (field === 'genre')
          catalog.locations[0].template.genres[0].name = invalidName;
        if (field === 'stamp')
          catalog.locations[0].template.genres[0].stamps[0].title = invalidName;
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
          template: { genres: [{ name: '景色', stamps: [null] }] },
        },
      ],
    },
    {
      locations: [],
      activities: [
        {
          name: '海',
          template: {
            genres: [{ name: '景色', stamps: [{ name: '誤った項目' }] }],
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
      expect(Object.keys(preset)).toEqual(['name', 'aliases']);
    }
    for (const preset of catalog.activities) {
      expect(Object.keys(preset)).toEqual(['name']);
    }
  });

  it('selects only requested stamps and excludes empty genres', () => {
    expect(
      service.select({ locations: ['島'] }, [
        { name: '景色', stamps: [{ title: '山を見る' }] },
        { name: '記録', stamps: [] },
      ]),
    ).toEqual([{ name: '景色', stamps: [{ title: '山を見る' }] }]);
  });

  it('deduplicates selected genres and stamps without mutating the selection', () => {
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
