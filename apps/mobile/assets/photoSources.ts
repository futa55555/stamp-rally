import type { ImageSourcePropType } from 'react-native';
import { demoPhotoUrls } from './demoPhotoUrls';

const bundled: Record<string, ImageSourcePropType> = {
  [demoPhotoUrls.kyoto]: require('./demo/kyoto.jpg'),
  [demoPhotoUrls.street]: require('./demo/street.jpg'),
  [demoPhotoUrls.fuji]: require('./demo/fuji.jpg'),
  [demoPhotoUrls.coast]: require('./demo/coast.jpg'),
  [demoPhotoUrls.coffee]: require('./demo/coffee.jpg'),
  [demoPhotoUrls.forest]: require('./demo/forest.jpg'),
};

export const photoSource = (url: string): ImageSourcePropType =>
  bundled[url] ?? { uri: url };
