export type Trip = {
  id: string;
  name: string;
  locations: string[];
  startDate: string;
  endDate: string;
  coverImageUrl: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  totalGenreCount: number;
  completedGenreCount: number;
  isCompleted: boolean;
};

export type Genre = {
  hasUnreadPhotos: boolean;
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
  photoCount: number;
  id: string;
  genreId: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  isCompleted: boolean;
};
