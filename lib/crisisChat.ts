import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { isReferralCode, type ReferralCode } from './emergencyLines';

export type ChatRole = 'user' | 'assistant';
export type ChatMessage = { role: ChatRole; content: string };

/** Datos del contacto de confianza, cuando la derivación es a él. */
export type EmergencyContact = { name: string | null; phone: string | null };

/** Respuesta de la IA: el texto + una derivación opcional (línea peruana o contacto). */
export type CrisisReply = {
  reply: string;
  referral: ReferralCode | null;
  contact: EmergencyContact | null;
  /** Patrón de respiración si la IA inició un ejercicio ('478'|'box'|'calm'), o null. */
  breathing: string | null;
};

/**
 * Se lanza cuando el usuario Free agotó sus sesiones del mes.
 * Lleva el límite y el uso para que la UI muestre "5/5 sesiones".
 */
export class CrisisRateLimitError extends Error {
  limit: number;
  used: number;
  constructor(limit: number, used: number) {
    super('rate_limited');
    this.name = 'CrisisRateLimitError';
    this.limit = limit;
    this.used = used;
  }
}

/** Error genérico de la IA (red, OpenAI caído, etc.). */
export class CrisisChatError extends Error {
  constructor() {
    super('crisis_chat_failed');
    this.name = 'CrisisChatError';
  }
}

async function tryParseRateLimit(
  error: unknown,
): Promise<{ limit: number; used: number } | null> {
  if (!(error instanceof FunctionsHttpError)) return null;
  if (error.context.status !== 429) return null;
  try {
    const body = await error.context.json();
    if (body?.error === 'rate_limited') {
      return {
        limit: typeof body.limit === 'number' ? body.limit : 5,
        used: typeof body.used === 'number' ? body.used : 0,
      };
    }
  } catch {
    // body no era JSON o ya fue consumido — sigue.
  }
  return null;
}

async function logFunctionError(label: string, error: unknown): Promise<void> {
  if (!(error instanceof FunctionsHttpError)) {
    console.error(`${label}:`, error);
    return;
  }
  try {
    const body = await error.context.json();
    console.error(`${label}: status=${error.context.status}`, body);
  } catch {
    console.error(`${label}: status=${error.context.status} (sin body)`);
  }
}

type SendOptions = {
  /** true en el primer mensaje de una crisis: cuenta una sesión del plan. */
  newSession?: boolean;
  locale?: string;
  signal?: AbortSignal;
};

// Envía la conversación a la Edge Function `crisis-chat` y devuelve la respuesta de la IA.
// Lanza CrisisRateLimitError si el usuario Free agotó sus sesiones, o CrisisChatError en otros fallos.
export async function sendCrisisMessage(
  messages: ChatMessage[],
  options: SendOptions = {},
): Promise<CrisisReply> {
  const { data, error } = await supabase.functions.invoke<{
    reply: string;
    referral: string | null;
    contact: EmergencyContact | null;
    breathing?: string | null;
  }>(
    'crisis-chat',
    {
      body: {
        messages,
        newSession: options.newSession ?? false,
        locale: options.locale,
      },
      signal: options.signal,
    },
  );

  if (error) {
    const rate = await tryParseRateLimit(error);
    if (rate) throw new CrisisRateLimitError(rate.limit, rate.used);
    await logFunctionError('sendCrisisMessage error', error);
    throw new CrisisChatError();
  }

  if (!data?.reply) throw new CrisisChatError();
  return {
    reply: data.reply,
    referral: isReferralCode(data.referral) ? data.referral : null,
    contact: data.contact ?? null,
    breathing: data.breathing ?? null,
  };
}

// Sube el audio a `crisis-transcribe` y devuelve la transcripción (Whisper, en servidor).
// Usa fetch con multipart en vez de functions.invoke porque el cuerpo es un archivo, no JSON.
export async function transcribeAudio(uri: string, locale: string): Promise<string> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new CrisisChatError();

  const form = new FormData();
  form.append('file', { uri, name: 'audio.m4a', type: 'audio/m4a' } as unknown as Blob);
  form.append('locale', locale);

  let res: Response;
  try {
    res = await fetch(`${supabaseUrl}/functions/v1/crisis-transcribe`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
        // NO seteamos Content-Type: fetch pone el boundary del multipart solo.
      },
      body: form,
    });
  } catch {
    throw new CrisisChatError();
  }

  if (!res.ok) {
    console.error('transcribeAudio failed', res.status, await res.text().catch(() => ''));
    throw new CrisisChatError();
  }
  const data = await res.json();
  return (data?.text ?? '').trim();
}

// Lee cuántas sesiones del mes lleva usadas el usuario; null si no se pudo leer.
export async function getMonthlySessionUsage(): Promise<number | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;

  const period = new Date();
  period.setUTCDate(1);
  const periodStr = period.toISOString().slice(0, 10);

  const { data } = await supabase
    .from('ai_usage')
    .select('count')
    .eq('user_id', userId)
    .eq('period', periodStr)
    .maybeSingle();

  return data?.count ?? 0;
}
