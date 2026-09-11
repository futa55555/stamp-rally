// Route names are relative to the (main)/trips Stack layout.
export type TripStackParamList = {
  index: undefined;
  'trip/[tripId]': { tripId: string; title?: string };
  'genre/[genreId]': { genreId: string; title?: string };
  'stamp/[stampId]': { stampId: string; title?: string };
  'photo/[postId]': {
    postId: string;
    source?: 'trip' | 'stamp';
    tripId?: string;
    stampId?: string;
  };
};

export type TripRoute = {
  [K in keyof TripStackParamList]: { name: K; params: TripStackParamList[K] };
}[keyof TripStackParamList];
