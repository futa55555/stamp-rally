import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useState } from 'react';
import { Platform, type ImageSourcePropType } from 'react-native';

let cachedSource: ImageSourcePropType | undefined;
let pendingSource: Promise<ImageSourcePropType | null> | undefined;

export function usePostHeaderIcon() {
  const [source, setSource] = useState(cachedSource);

  useEffect(() => {
    if (Platform.OS !== 'ios' || source) return;
    let active = true;
    pendingSource ??= MaterialCommunityIcons.getImageSource(
      'camera-plus-outline',
      24,
      'black',
    )
      .then((image) => {
        if (image) cachedSource = image;
        return image;
      })
      .catch(() => null)
      .finally(() => {
        pendingSource = undefined;
      });
    void pendingSource.then((image) => {
      if (active && image) setSource(image);
    });
    return () => {
      active = false;
    };
  }, [source]);

  return source;
}
