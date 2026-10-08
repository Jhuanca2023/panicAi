import { Linking, Platform } from 'react-native';
import * as Location from 'expo-location';
import * as SMS from 'expo-sms';

// WhatsApp exige solo dígitos con código de país; default Perú porque la app es para Lima.
const DEFAULT_COUNTRY_CODE = '51';

function normalizePhone(phone: string): string {
  let digits = phone.replace(/[^\d]/g, '');
  // Número local peruano (9 dígitos): le anteponemos el código país.
  if (digits.length === 9 && !digits.startsWith(DEFAULT_COUNTRY_CODE)) {
    digits = DEFAULT_COUNTRY_CODE + digits;
  }
  return digits;
}

// Enlace de Google Maps con la ubicación; prioriza la última conocida para no esperar en crisis.
export async function getLocationMapsLink(): Promise<string | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    let pos = await Location.getLastKnownPositionAsync();
    if (!pos) {
      pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    }
    if (!pos) return null;

    const { latitude, longitude } = pos.coords;
    return `https://maps.google.com/?q=${latitude},${longitude}`;
  } catch {
    return null;
  }
}

export function buildAlertMessage(opts: { name?: string | null; mapsUrl: string | null; locale: string }): string {
  const en = opts.locale.startsWith('en');
  const base = en
    ? "I'm having a panic attack and I need help."
    : 'Estoy teniendo un ataque de pánico y necesito ayuda.';
  if (!opts.mapsUrl) return base;
  return en
    ? `${base} My location: ${opts.mapsUrl}`
    : `${base} Mi ubicación: ${opts.mapsUrl}`;
}

// Abre WhatsApp con un mensaje prellenado; false si no está instalado o no se pudo abrir.
export async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  const num = normalizePhone(phone);
  const url = `whatsapp://send?phone=${num}&text=${encodeURIComponent(message)}`;
  try {
    const can = await Linking.canOpenURL(url);
    if (!can) {
      // Fallback web wa.me (abre WhatsApp si está, o el navegador).
      await Linking.openURL(`https://wa.me/${num}?text=${encodeURIComponent(message)}`);
      return true;
    }
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

// Abre la app de SMS con el texto prellenado (el usuario confirma el envío); false si no hay SMS.
export async function sendSMS(phone: string, message: string): Promise<boolean> {
  try {
    const available = await SMS.isAvailableAsync();
    if (available) {
      await SMS.sendSMSAsync([phone], message);
      return true;
    }
    // Fallback al esquema sms: (el separador difiere entre iOS y Android).
    const sep = Platform.OS === 'ios' ? '&' : '?';
    await Linking.openURL(`sms:${phone}${sep}body=${encodeURIComponent(message)}`);
    return true;
  } catch {
    return false;
  }
}
