import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import type { LoginProvider } from './model/types';

export async function identityCredentials(
  provider: LoginProvider,
): Promise<{ provider: LoginProvider; body: Record<string, string> } | null> {
  if (provider === 'apple') {
    if (
      Platform.OS !== 'ios' ||
      !(await AppleAuthentication.isAvailableAsync())
    )
      throw new Error('この端末ではAppleログインを利用できません。');
    const nonce = Crypto.randomUUID();
    try {
      const result = await AppleAuthentication.signInAsync({ nonce });
      if (!result.identityToken)
        throw new Error('Appleの認証情報を取得できませんでした。');
      return { provider, body: { identityToken: result.identityToken, nonce } };
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ERR_REQUEST_CANCELED'
      )
        return null;
      throw error;
    }
  }
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  if (!webClientId || (Platform.OS === 'ios' && !iosClientId))
    throw new Error('GoogleログインのOAuth client IDが設定されていません。');
  // Load native code only when used so Expo Go can still show the setup error.
  const { GoogleOneTapSignIn, isSuccessResponse } =
    await import('react-native-nitro-google-signin');
  GoogleOneTapSignIn.configure({ webClientId, iosClientId });
  if (Platform.OS === 'android') await GoogleOneTapSignIn.checkPlayServices();
  const result = await GoogleOneTapSignIn.presentExplicitSignIn();
  if (!isSuccessResponse(result)) return null;
  return { provider, body: { idToken: result.data.idToken } };
}
