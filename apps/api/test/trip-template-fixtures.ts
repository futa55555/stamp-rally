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
      name: '沖縄県',
      aliases: ['沖縄', 'おきなわ'],
      template: {
        genres: [
          { name: 'グルメ', stamps: [{ title: '沖縄そばを食べる' }] },
          { name: '景色', stamps: [{ title: '海辺を散歩する' }] },
        ],
      },
    },
    { name: '北海道', aliases: [], template: { genres: [] } },
  ],
  activities: [
    {
      name: '夜景',
      template: {
        genres: [
          { name: '景色', stamps: [{ title: '夜景を楽しむ' }] },
          { name: '思い出', stamps: [{ title: '夜景を楽しむ' }] },
        ],
      },
    },
    {
      name: '温泉',
      template: {
        genres: [{ name: '温泉', stamps: [{ title: '露天風呂につかる' }] }],
      },
    },
    {
      name: '海',
      template: {
        genres: [
          {
            name: '景色',
            stamps: [{ title: '海辺を散歩する' }, { title: '夕日を見る' }],
          },
        ],
      },
    },
    { name: '登山', template: { genres: [] } },
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
