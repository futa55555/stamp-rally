export type TemplateSource = {
  type: 'location' | 'activity';
  name: string;
};

export type TemplateCategory = {
  name: string;
  stamps: { title: string; sources: TemplateSource[] }[];
};

export type TemplatePresets = {
  locations: { name: string; aliases: string[] }[];
  activities: { name: string }[];
};

export type SelectedCategory = {
  name: string;
  stamps: { title: string }[];
};

export type TemplateSelection = Record<string, boolean>;
