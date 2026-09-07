import type { ImageSourcePropType } from 'react-native';
import { demoPhotoUrls } from './demoPhotoUrls';

const bundled: Record<string, ImageSourcePropType> = {
  [demoPhotoUrls.kyoto]: require('../../assets/demo/kyoto.jpg'),
  [demoPhotoUrls.street]: require('../../assets/demo/street.jpg'),
  [demoPhotoUrls.fuji]: require('../../assets/demo/fuji.jpg'),
  [demoPhotoUrls.coast]: require('../../assets/demo/coast.jpg'),
  [demoPhotoUrls.coffee]: require('../../assets/demo/coffee.jpg'),
  [demoPhotoUrls.forest]: require('../../assets/demo/forest.jpg'),
};

export const photoSource = (url: string): ImageSourcePropType =>
  bundled[url] ?? { uri: url };
