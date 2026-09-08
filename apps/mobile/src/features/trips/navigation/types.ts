// Route names are relative to the (main)/trips Stack layout.
export type TripStackParamList = {
  index: undefined;
  'trip/[tripId]': { tripId: string };
  'genre/[genreId]': { genreId: string };
  'stamp/[stampId]': { stampId: string };
  'photo/[postId]': { postId: string };
};

export type TripRoute = {
  [K in keyof TripStackParamList]: { name: K; params: TripStackParamList[K] };
}[keyof TripStackParamList];
