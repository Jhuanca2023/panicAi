import { useCallback } from 'react';
import { useProfile } from './useProfile';
import { t as translate, type TranslationKey, type Locale } from '../lib/translations';

// i18n ligero: devuelve un t(key) enlazado al locale del perfil (es-PE por defecto sin sesión).
export function useTranslation() {
  const { profile } = useProfile();
  const locale: Locale = profile?.locale === 'en-US' ? 'en-US' : 'es-PE';

  const t = useCallback(
    (key: TranslationKey) => translate(key, locale),
    [locale],
  );

  return { t, locale };
}
