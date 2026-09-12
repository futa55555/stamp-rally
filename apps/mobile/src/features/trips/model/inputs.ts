import type { SaveTemplateEdit } from '../../trip-templates/edit-types';
import type { Category, Trip } from './types';
import type { SelectedCategory } from '../../trip-templates/types';

export type TripInput = Pick<
  Trip,
  'name' | 'locations' | 'startDate' | 'endDate'
> & {
  clientRequestId?: string;
  coverAssetId?: string | null;
  activityPresets?: string[];
  customActivities?: string[];
  templateEdit?: SaveTemplateEdit;
};

export type CreateTripInput = TripInput & {
  activityPresets?: string[];
  customActivities?: string[];
  selectedCategories?: SelectedCategory[];
};

export type TripFormValues = TripInput & { coverImageUrl: string | null };

export type NamedInput = Pick<Category, 'name' | 'description'>;

export type CreateCategoryInput = NamedInput & { tripId: string };

export type StampInput = NamedInput & { categoryIds?: string[] };
export type CreateStampInput = NamedInput & {
  tripId: string;
  categoryIds: string[];
};
