export type StampTemplateItem = { key?: string; title: string };

export type CategoryTemplateItem = {
  key?: string;
  name: string;
  stamps: StampTemplateItem[];
};

export type TripTemplate = { categories: CategoryTemplateItem[] };
export type LocationPreset = {
  key?: string;
  name: string;
  aliases: string[];
  template: TripTemplate;
};
export type ActivityPreset = {
  key?: string;
  name: string;
  template: TripTemplate;
};
export type TripTemplatePresets = {
  locations: LocationPreset[];
  activities: ActivityPreset[];
};
export type TripTemplateSource = {
  type: 'location' | 'activity';
  key?: string;
  name: string;
};
export type TripTemplatePreview = {
  categories: {
    key?: string;
    name: string;
    stamps: { key?: string; title: string; sources: TripTemplateSource[] }[];
  }[];
};
export type TripTemplateInput = {
  locations?: string[];
  activityPresets?: string[];
};
export type TripTemplateCatalog = {
  locations: { name: string; aliases: string[] }[];
  activities: { name: string }[];
};
