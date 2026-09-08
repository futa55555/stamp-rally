import { Asset as BundledAsset } from 'expo-asset';
import { Directory, File, FileMode, Paths } from 'expo-file-system';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { photoSource } from '../../../../assets/photoSources';

type ShareAnchor = { x: number; y: number; width: number; height: number };
type ImageFormat = { extension: string; mimeType: string };
const exportRetentionMs = 24 * 60 * 60 * 1000;
let exportSequence = 0;

function removeExport(directory: Directory) {
  try {
    if (directory.exists) directory.delete();
  } catch {
    // Cache cleanup must not turn a successful share/save into a failure.
  }
}

function pruneOldExports() {
  try {
    const cutoff = Date.now() - exportRetentionMs;
    for (const entry of new Directory(Paths.cache).list()) {
      if (!(entry instanceof Directory)) continue;
      const createdAt = /^photo-export-(\d+)-\d+$/.exec(entry.name)?.[1];
      if (createdAt && Number(createdAt) < cutoff) removeExport(entry);
    }
  } catch {
    // A later transfer can retry pruning an unavailable cache directory.
  }
}

// Content URIs and signed image URLs need not have a filename extension.
// Read only the header so the original image can be exported without re-encoding.
function imageFormat(file: File): ImageFormat {
  const handle = file.open(FileMode.ReadOnly);
  let bytes: Uint8Array;
  try {
    bytes = handle.readBytes(Math.min(32, file.size));
  } finally {
    handle.close();
  }
  const startsWith = (...signature: number[]) =>
    signature.every((byte, index) => bytes[index] === byte);
  const text = String.fromCharCode(...bytes);
  if (startsWith(0xff, 0xd8, 0xff))
    return { extension: 'jpg', mimeType: 'image/jpeg' };
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))
    return { extension: 'png', mimeType: 'image/png' };
  if (text.startsWith('GIF87a') || text.startsWith('GIF89a'))
    return { extension: 'gif', mimeType: 'image/gif' };
  if (text.startsWith('RIFF') && text.slice(8, 12) === 'WEBP')
    return { extension: 'webp', mimeType: 'image/webp' };
  if (text.slice(4, 8) === 'ftyp') {
    const brands = text.slice(8);
    if (/avif|avis/.test(brands))
      return { extension: 'avif', mimeType: 'image/avif' };
    if (/heic|heix|hevc|hevx/.test(brands))
      return { extension: 'heic', mimeType: 'image/heic' };
    if (/mif1|msf1/.test(brands))
      return { extension: 'heif', mimeType: 'image/heif' };
  }
  if (startsWith(0x49, 0x49, 0x2a, 0) || startsWith(0x4d, 0x4d, 0, 0x2a))
    return { extension: 'tiff', mimeType: 'image/tiff' };
  if (text.startsWith('BM')) return { extension: 'bmp', mimeType: 'image/bmp' };
  throw new Error('写真のファイル形式を確認できませんでした。');
}

async function withPhotoFile(
  mediaUrl: string,
  operation: (file: File, format: ImageFormat) => Promise<unknown>,
  retainAfterSuccess = false,
) {
  pruneOldExports();
  const directory = new Directory(
    Paths.cache,
    `photo-export-${Date.now()}-${exportSequence++}`,
  );
  let completed = false;
  try {
    directory.create();
    const temporary = new File(directory, 'photo');
    const source = photoSource(mediaUrl);
    if (typeof source === 'number') {
      const asset = await BundledAsset.fromModule(source).downloadAsync();
      if (!asset.localUri) throw new Error('写真を読み込めませんでした。');
      await new File(asset.localUri).copy(temporary);
    } else if (/^https?:\/\//.test(mediaUrl)) {
      await File.downloadFileAsync(mediaUrl, temporary);
    } else if (/^(file|content):\/\//.test(mediaUrl)) {
      await new File(mediaUrl).copy(temporary);
    } else {
      throw new Error('写真を読み込めませんでした。');
    }
    const format = imageFormat(temporary);
    const photo = new File(directory, `photo.${format.extension}`);
    await temporary.move(photo);
    await operation(photo, format);
    completed = true;
  } finally {
    // Only remove our export copy; picked photos and bundled assets stay intact.
    if (!retainAfterSuccess || !completed) removeExport(directory);
  }
}

export async function sharePhoto(mediaUrl: string, anchor?: ShareAnchor) {
  if (Platform.OS === 'web' || !(await Sharing.isAvailableAsync()))
    throw new Error('この端末では写真を共有できません。');
  try {
    await withPhotoFile(
      mediaUrl,
      (file, format) =>
        Sharing.shareAsync(file.uri, {
          mimeType: format.mimeType,
          UTI: 'public.image',
          dialogTitle: '写真を共有',
          anchor,
        }),
      // Android resolves when its chooser returns, before a recipient necessarily
      // reads the FileProvider URI. Keep that file for later cache pruning.
      Platform.OS === 'android',
    );
  } catch {
    throw new Error('写真を共有できませんでした。もう一度お試しください。');
  }
}

export async function savePhotoToLibrary(mediaUrl: string) {
  if (Platform.OS === 'web')
    throw new Error('写真の保存は iOS・Android アプリで利用できます。');
  // Saving needs add-only access, never access to all existing photos.
  const permission = await requestPermissionsAsync(true, []);
  if (!permission.granted)
    throw new Error(
      permission.canAskAgain
        ? '写真を保存するには、写真への追加を許可してください。'
        : '端末の設定から写真への追加を許可してください。',
    );
  try {
    await withPhotoFile(mediaUrl, (file) => Asset.create(file.uri));
  } catch {
    throw new Error('写真を保存できませんでした。もう一度お試しください。');
  }
}
