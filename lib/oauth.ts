import Constants, { ExecutionEnvironment } from 'expo-constants';
import { supabase } from './supabase';

// Google Sign-In es un módulo nativo que no existe en Expo Go. Por eso nunca se
// importa a nivel de archivo (crashearía Expo Go): se carga con import dinámico
// dentro de signInWithGoogle, y en Expo Go el botón se oculta.
export function isGoogleSignInAvailable(): boolean {
  return Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
}

let configured = false;

export async function signInWithGoogle(): Promise<{ error?: string }> {
  if (!isGoogleSignInAvailable()) {
    return { error: 'unsupported' };
  }

  let mod: typeof import('@react-native-google-signin/google-signin');
  try {
    mod = await import('@react-native-google-signin/google-signin');
  } catch {
    return { error: 'unsupported' };
  }
  const { GoogleSignin, statusCodes, isErrorWithCode } = mod;

  try {
    if (!configured) {
      GoogleSignin.configure({ webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID });
      configured = true;
    }

    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();

    const idToken = response.type === 'success' ? response.data?.idToken : null;
    if (!idToken) {
      return { error: 'cancelled' };
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) return { error: error.message };
    return {};
  } catch (e: unknown) {
    if (isErrorWithCode(e)) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED) return { error: 'cancelled' };
      if (e.code === statusCodes.IN_PROGRESS) return { error: 'in_progress' };
      if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return { error: 'Play Services no disponible' };
      }
    }
    return { error: e instanceof Error ? e.message : 'OAuth failed' };
  }
}
