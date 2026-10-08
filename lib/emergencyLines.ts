// Líneas de ayuda peruanas. El `code` es lo que la IA emite en [[REFERRAL:113]]
// y el servidor devuelve en `referral`.
export type EmergencyLineCode = '113' | '106' | '100';
export type ReferralCode = EmergencyLineCode | 'contact';

export type EmergencyLine = {
  code: EmergencyLineCode;
  /** Número que se marca realmente (tel:). */
  dial: string;
};

// Nombre/descripción de cada línea se resuelven por i18n (keys line{code}Name / line{code}Desc).
export const EMERGENCY_LINES: Record<EmergencyLineCode, EmergencyLine> = {
  '113': { code: '113', dial: '113' }, // salud mental del MINSA (opción 5)
  '106': { code: '106', dial: '106' }, // SAMU, emergencia médica
  '100': { code: '100', dial: '100' }, // violencia familiar y sexual
};

export function isEmergencyLineCode(value: unknown): value is EmergencyLineCode {
  return value === '113' || value === '106' || value === '100';
}

export function isReferralCode(value: unknown): value is ReferralCode {
  return isEmergencyLineCode(value) || value === 'contact';
}
