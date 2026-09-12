export type TemplateSource = {
  type: 'location' | 'activity';
  name: string;
};

export type TemplateCategory = {
  key?: string;
  name: string;
  stamps: { key?: string; title: string; sources: TemplateSource[] }[];
};

export type TemplatePresets = {
  locations: { name: string; aliases: string[] }[];
  activities: { name: string }[];
};

export type SelectedCategory = {
  key?: string;
  name: string;
  stamps: { key?: string; title: string }[];
};

export type TemplateSelection = Record<string, boolean>;
