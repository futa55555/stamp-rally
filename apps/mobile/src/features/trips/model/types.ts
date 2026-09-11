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
  totalGenreCount: number;
  completedGenreCount: number;
  isCompleted: boolean;
};

export type Genre = {
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
  genreIds: string[];
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  isCompleted: boolean;
};
