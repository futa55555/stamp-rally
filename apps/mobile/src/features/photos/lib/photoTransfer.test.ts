import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { savePhotoToLibrary, sharePhoto } from './photoTransfer';

const native = vi.hoisted(() => ({
  files: new Map<string, Uint8Array>(),
  directories: new Set<string>(),
  platform: { OS: 'ios' },
  source: vi.fn(),
  bundled: vi.fn(),
  download: vi.fn(),
  share: vi.fn(),
  available: vi.fn(),
  createAsset: vi.fn(),
  permissions: vi.fn(),
}));

vi.mock('react-native', () => ({ Platform: native.platform }));
vi.mock('../../../../assets/photoSources', () => ({
  photoSource: native.source,
}));
vi.mock('expo-asset', () => ({
  Asset: { fromModule: native.bundled },
}));
vi.mock('expo-media-library', () => ({
  Asset: { create: native.createAsset },
  requestPermissionsAsync: native.permissions,
}));
vi.mock('expo-sharing', () => ({
  shareAsync: native.share,
  isAvailableAsync: native.available,
}));
vi.mock('expo-file-system', () => {
  const path = (parts: (string | { uri: string })[]) =>
    parts.map((part) => (typeof part === 'string' ? part : part.uri)).join('/');
  class File {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = path(parts);
    }
    static downloadFileAsync = native.download;
    get size() {
      return native.files.get(this.uri)?.length ?? 0;
    }
    async copy(destination: File) {
      const bytes = native.files.get(this.uri);
      if (!bytes) throw new Error('File missing');
      native.files.set(destination.uri, bytes.slice());
    }
    async move(destination: File) {
      await this.copy(destination);
      native.files.delete(this.uri);
      this.uri = destination.uri;
    }
    open() {
      return {
        readBytes: (length: number) =>
          native.files.get(this.uri)!.slice(0, length),
        close: () => {},
      };
    }
  }
  class Directory {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = path(parts);
    }
    get name() {
      return this.uri.split('/').at(-1)!;
    }
    list() {
      const isChild = (uri: string) =>
        uri.startsWith(`${this.uri}/`) &&
        !uri.slice(this.uri.length + 1).includes('/');
      return [
        ...[...native.directories]
          .filter(isChild)
          .map((uri) => new Directory(uri)),
        ...[...native.files.keys()].filter(isChild).map((uri) => new File(uri)),
      ];
    }
    create() {
      native.directories.add(this.uri);
    }
    get exists() {
      return native.directories.has(this.uri);
    }
    delete() {
      for (const file of native.files.keys())
        if (file.startsWith(`${this.uri}/`)) native.files.delete(file);
      native.directories.delete(this.uri);
    }
  }
  return {
    File,
    Directory,
    Paths: { cache: 'file:///cache' },
    FileMode: { ReadOnly: 'r' },
  };
});

const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 1, 2, 3, 0xff, 0xd9]);
const png = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9,
]);

beforeEach(() => {
  vi.resetAllMocks();
  native.files.clear();
  native.directories.clear();
  native.platform.OS = 'ios';
  native.source.mockImplementation((uri: string) => ({ uri }));
  native.available.mockResolvedValue(true);
  native.permissions.mockResolvedValue({ granted: true, canAskAgain: true });
  native.download.mockImplementation(
    async (_url: string, file: { uri: string }) => {
      native.files.set(file.uri, png);
      return file;
    },
  );
});
afterEach(() => vi.restoreAllMocks());

describe('photo transfer', () => {
  it('shares an extensionless remote image as an actual PNG and keeps it until sharing finishes', async () => {
    const anchor = { x: 10, y: 20, width: 44, height: 44 };
    native.share.mockImplementation(async (uri: string, options: unknown) => {
      expect(uri).toMatch(/^file:\/\/\/cache\/.+\/photo\.png$/);
      expect(native.files.get(uri)).toEqual(png);
      expect(options).toMatchObject({ mimeType: 'image/png', anchor });
      expect(native.permissions).not.toHaveBeenCalled();
    });
    await sharePhoto('https://images.example.com/image?token=123', anchor);
    expect(native.share).toHaveBeenCalledOnce();
    expect(native.files.size).toBe(0);
    expect(native.directories.size).toBe(0);
  });

  it('retains the Android image after the chooser resolves so its recipient can still read it', async () => {
    native.platform.OS = 'android';
    await sharePhoto('https://images.example.com/photo');
    const sharedUri = native.share.mock.calls[0][0] as string;
    expect(native.files.get(sharedUri)).toEqual(png);
    expect(native.directories.size).toBe(1);
  });

  it('prunes only owned exports older than 24 hours on a later transfer', async () => {
    const day = 24 * 60 * 60 * 1000;
    const now = vi.spyOn(Date, 'now').mockReturnValue(2 * day);
    native.platform.OS = 'android';
    await sharePhoto('https://images.example.com/first');
    const firstUri = native.share.mock.calls[0][0] as string;
    now.mockReturnValue(3 * day);
    await sharePhoto('https://images.example.com/second');
    const secondUri = native.share.mock.calls[1][0] as string;
    expect(native.files.get(firstUri)).toEqual(png);
    const unrelatedUri = 'file:///cache/picked-photos/original.jpg';
    native.directories.add('file:///cache/picked-photos');
    native.files.set(unrelatedUri, jpeg);
    // A similarly named file is not one of our export directories.
    const unrelatedFile = 'file:///cache/photo-export-1-0';
    native.files.set(unrelatedFile, jpeg);
    now.mockReturnValue(3 * day + 1);
    await savePhotoToLibrary('https://images.example.com/third');
    expect(native.files.has(firstUri)).toBe(false);
    expect(native.files.get(secondUri)).toEqual(png);
    expect(native.files.get(unrelatedUri)).toEqual(jpeg);
    expect(native.files.get(unrelatedFile)).toEqual(jpeg);
    // Saving still removes its own temporary copy immediately on Android.
    expect(
      native.files.has(native.createAsset.mock.calls[0][0] as string),
    ).toBe(false);
  });

  it('removes an Android export immediately if the share sheet fails to open', async () => {
    native.platform.OS = 'android';
    native.share.mockRejectedValue(new Error('No sharing activity'));
    await expect(
      sharePhoto('https://images.example.com/photo'),
    ).rejects.toThrow('写真を共有できませんでした');
    expect(native.files.size).toBe(0);
    expect(native.directories.size).toBe(0);
  });

  it.each(['file:///picked/image.jpg', 'content://photos/123'])(
    'saves the original bytes from %s without removing the original photo',
    async (uri) => {
      native.files.set(uri, jpeg);
      native.createAsset.mockImplementation(async (localUri: string) => {
        expect(localUri).toMatch(/^file:\/\/\/cache\/.+\/photo\.jpg$/);
        expect(native.files.get(localUri)).toEqual(jpeg);
      });
      await savePhotoToLibrary(uri);
      expect(native.permissions).toHaveBeenCalledWith(true, []);
      expect(native.createAsset).toHaveBeenCalledOnce();
      expect([...native.files.keys()]).toEqual([uri]);
      expect(native.files.get(uri)).toEqual(jpeg);
    },
  );

  it('exports the bundled demo image used on screen instead of its placeholder URL', async () => {
    native.source.mockReturnValue(42);
    native.files.set('file:///assets/demo.jpg', jpeg);
    native.bundled.mockReturnValue({
      downloadAsync: async () => ({ localUri: 'file:///assets/demo.jpg' }),
    });
    await sharePhoto('https://demo.example.com/photo');
    expect(native.bundled).toHaveBeenCalledWith(42);
    expect(native.download).not.toHaveBeenCalled();
    expect(native.share).toHaveBeenCalledWith(
      expect.stringMatching(/photo\.jpg$/),
      expect.objectContaining({ mimeType: 'image/jpeg' }),
    );
    expect(native.files.get('file:///assets/demo.jpg')).toEqual(jpeg);
  });

  it('does not download or save when add-only access is denied', async () => {
    native.permissions.mockResolvedValue({
      granted: false,
      canAskAgain: false,
    });
    await expect(
      savePhotoToLibrary('https://images.example.com/photo'),
    ).rejects.toThrow('端末の設定');
    expect(native.download).not.toHaveBeenCalled();
    expect(native.createAsset).not.toHaveBeenCalled();
    expect(native.directories.size).toBe(0);
  });

  it('cleans a partial failed download and never opens the share sheet', async () => {
    native.download.mockImplementation(
      async (_url: string, file: { uri: string }) => {
        native.files.set(file.uri, png.slice(0, 3));
        throw new Error('Network disconnected');
      },
    );
    await expect(
      sharePhoto('https://images.example.com/photo'),
    ).rejects.toThrow('写真を共有できませんでした');
    expect(native.share).not.toHaveBeenCalled();
    expect(native.files.size).toBe(0);
  });

  it('does not share a server error page as if it were an image', async () => {
    native.download.mockImplementation(
      async (_url: string, file: { uri: string }) => {
        native.files.set(
          file.uri,
          new TextEncoder().encode('<html>Login</html>'),
        );
        return file;
      },
    );
    await expect(
      sharePhoto('https://images.example.com/photo.jpg'),
    ).rejects.toThrow('写真を共有できませんでした');
    expect(native.share).not.toHaveBeenCalled();
    expect(native.files.size).toBe(0);
  });
});
