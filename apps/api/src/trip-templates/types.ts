export type StampTemplateItem = { title: string };

export type CategoryTemplateItem = {
  name: string;
  stamps: StampTemplateItem[];
};

export type TripTemplate = { categories: CategoryTemplateItem[] };
export type LocationPreset = {
  name: string;
  aliases: string[];
  template: TripTemplate;
};
export type ActivityPreset = { name: string; template: TripTemplate };
export type TripTemplatePresets = {
  locations: LocationPreset[];
  activities: ActivityPreset[];
};
export type TripTemplateSource = {
  type: 'location' | 'activity';
  name: string;
};
export type TripTemplatePreview = {
  categories: {
    name: string;
    stamps: { title: string; sources: TripTemplateSource[] }[];
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
