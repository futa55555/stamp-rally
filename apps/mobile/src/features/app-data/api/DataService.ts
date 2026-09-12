import type { LoginProvider, User } from '../../auth/model/types';
import type { AppNotification } from '../../notifications/model/types';
import type { CreatePostsInput } from '../../photos/model/inputs';
import type { Post } from '../../photos/model/types';
import type {
  CreateCategoryInput,
  CreateStampInput,
  NamedInput,
  StampInput,
  TripInput,
  CreateTripInput,
} from '../../trips/model/inputs';
import type { Category, Stamp, Trip } from '../../trips/model/types';
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
  createTrip(userId: string, input: CreateTripInput): Promise<Trip>;
  updateTrip(userId: string, id: string, input: TripInput): Promise<Trip>;
  createCategory(userId: string, input: CreateCategoryInput): Promise<Category>;
  updateCategory(
    userId: string,
    id: string,
    input: NamedInput,
  ): Promise<Category>;
  createStamp(userId: string, input: CreateStampInput): Promise<Stamp>;
  updateStamp(userId: string, id: string, input: StampInput): Promise<Stamp>;
  createPosts(userId: string, input: CreatePostsInput): Promise<Post[]>;
  deletePost(userId: string, postId: string): Promise<void>;
}
