import type { LoginProvider, User } from '../../auth/model/types';
import type { AppNotification } from '../../notifications/model/types';
import type { CreatePostsInput } from '../../photos/model/inputs';
import type { Post } from '../../photos/model/types';
import type {
  CreateGenreInput,
  CreateStampInput,
  NamedInput,
  TripInput,
} from '../../trips/model/inputs';
import type { Genre, Stamp, Trip } from '../../trips/model/types';
import type { AppData } from '../model/types';

// Inject an implementation into AppDataProvider to connect the UI to the API.
// Screens never read fixtures.
export interface DataService {
  load(): Promise<AppData>;
  signIn(provider: LoginProvider): Promise<string>;
  signOut(): Promise<void>;
  setFavorite(postId: string, isFavorite: boolean): Promise<Post>;
  markPhotoRead(userId: string, postId: string): Promise<void>;
  markNotificationRead(id: string): Promise<AppNotification>;
  updateName(userId: string, name: string): Promise<User>;
  createTrip(userId: string, input: TripInput): Promise<Trip>;
  updateTrip(userId: string, id: string, input: TripInput): Promise<Trip>;
  createGenre(userId: string, input: CreateGenreInput): Promise<Genre>;
  updateGenre(userId: string, id: string, input: NamedInput): Promise<Genre>;
  createStamp(userId: string, input: CreateStampInput): Promise<Stamp>;
  updateStamp(userId: string, id: string, input: NamedInput): Promise<Stamp>;
  createPosts(userId: string, input: CreatePostsInput): Promise<Post[]>;
}
