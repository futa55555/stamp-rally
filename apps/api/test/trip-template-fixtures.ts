import {
  previewTripTemplates,
  TripTemplatesService,
} from '../src/trip-templates/trip-templates.service.js';
import type {
  TripTemplateInput,
  TripTemplatePresets,
} from '../src/trip-templates/types.js';

// Integration scenarios stay stable when the editable production catalog changes.
const fixtures: TripTemplatePresets = {
  locations: [
    {
      key: 'fixture-name-1',
      name: '沖縄県',
      aliases: ['沖縄', 'おきなわ'],
      template: {
        categories: [
          {
            key: 'fixture-name-2',
            name: 'グルメ',
            stamps: [{ key: 'fixture-stamp-1', title: '沖縄そばを食べる' }],
          },
          {
            key: 'fixture-name-3',
            name: '景色',
            stamps: [{ key: 'fixture-stamp-2', title: '海辺を散歩する' }],
          },
        ],
      },
    },
    {
      key: 'fixture-name-4',
      name: '北海道',
      aliases: [],
      template: { categories: [] },
    },
  ],
  activities: [
    {
      key: 'fixture-name-5',
      name: '夜景',
      template: {
        categories: [
          {
            key: 'fixture-name-3',
            name: '景色',
            stamps: [{ key: 'fixture-stamp-3', title: '夜景を楽しむ' }],
          },
          {
            key: 'fixture-name-6',
            name: '思い出',
            stamps: [{ key: 'fixture-stamp-3', title: '夜景を楽しむ' }],
          },
        ],
      },
    },
    {
      key: 'fixture-name-7',
      name: '温泉',
      template: {
        categories: [
          {
            key: 'fixture-name-7',
            name: '温泉',
            stamps: [{ key: 'fixture-stamp-4', title: '露天風呂につかる' }],
          },
        ],
      },
    },
    {
      key: 'fixture-name-8',
      name: '海',
      template: {
        categories: [
          {
            key: 'fixture-name-3',
            name: '景色',
            stamps: [
              { key: 'fixture-stamp-2', title: '海辺を散歩する' },
              { key: 'fixture-stamp-5', title: '夕日を見る' },
            ],
          },
        ],
      },
    },
    { key: 'fixture-name-9', name: '登山', template: { categories: [] } },
  ],
};

export class TestTripTemplatesService extends TripTemplatesService {
  override catalog() {
    return {
      locations: fixtures.locations.map(({ name, aliases }) => ({
        name,
        aliases: [...aliases],
      })),
      activities: fixtures.activities.map(({ name }) => ({ name })),
    };
  }

  override preview(input: TripTemplateInput) {
    return previewTripTemplates(fixtures, input);
  }
}
