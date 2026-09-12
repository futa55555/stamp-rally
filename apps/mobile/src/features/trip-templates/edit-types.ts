export type TemplateChange = {
  categoryRef: string;
  stampRef?: string;
  selected: boolean;
};
export type EditableTemplateStamp = {
  ref: string;
  id?: string;
  templateKey?: string;
  name: string;
  selected: boolean;
  manual: boolean;
  sources: string[];
  postCount: number;
  protectedCount: number;
  retained: boolean;
};
export type EditableTemplateCategory = {
  ref: string;
  id?: string;
  templateKey?: string;
  name: string;
  selected: boolean;
  stamps: EditableTemplateStamp[];
};
export type TemplateEditPreview = {
  categories: EditableTemplateCategory[];
  impact: { stampCount: number; postCount: number };
  confirmationToken: string;
};
export type SaveTemplateEdit = {
  clientRequestId: string;
  changes: TemplateChange[];
  confirmationToken?: string;
};
