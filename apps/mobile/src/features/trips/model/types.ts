export type Trip = {
  id: string;
  name: string;
  locations: string[];
  activityPresets: string[];
  customActivities: string[];
  startDate: string;
  endDate: string;
  coverImageUrl: string | null;
  coverAssetId?: string | null;
  coverBlurhash?: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  totalCategoryCount: number;
  completedCategoryCount: number;
  isCompleted: boolean;
};

export type Category = {
  hasUnreadPhotos: boolean;
  hasUnreadMedia?: boolean;
  id: string;
  tripId: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  totalStampCount: number;
  completedStampCount: number;
  isCompleted: boolean;
};

export type Stamp = {
  hasUnreadPhotos: boolean;
  hasUnreadMedia?: boolean;
  photoCount: number;
  videoCount?: number;
  mediaCount?: number;
  id: string;
  tripId: string;
  categoryIds: string[];
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  isCompleted: boolean;
};
