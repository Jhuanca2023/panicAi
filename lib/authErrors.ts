import type { AuthError } from '@supabase/supabase-js';
import { t } from './translations';

// Mapea errores de Supabase Auth a textos traducidos, emparejando por substring +
// status para sobrevivir a cambios de redacción entre versiones de supabase-js.
export function authErrorMessage(
  error: AuthError | { message: string; status?: number } | null,
  locale: string = 'es-PE',
): string {
  if (!error) return t('errGeneric', locale);

  const raw = (error.message ?? '').toLowerCase();
  const status = 'status' in error ? error.status : undefined;

  if (raw.includes('invalid login') || raw.includes('invalid credentials')) {
    return t('errInvalidCredentials', locale);
  }
  if (raw.includes('email not confirmed')) {
    return t('errEmailNotConfirmed', locale);
  }
  if (raw.includes('already registered') || raw.includes('user already')) {
    return t('errUserExists', locale);
  }
  if (raw.includes('password should be') || raw.includes('password is too short')) {
    return t('errorPasswordLength', locale);
  }
  if (raw.includes('rate limit') || status === 429) {
    return t('errRateLimit', locale);
  }
  if (raw.includes('network') || raw.includes('failed to fetch')) {
    return t('errNetwork', locale);
  }
  if (raw.includes('invalid email') || raw.includes('email address')) {
    return t('errInvalidEmail', locale);
  }

  return t('errGeneric', locale);
}
