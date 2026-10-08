import { supabase } from './supabase';
import type { ChatMessage } from './crisisChat';

export type EpisodeSeverity = 'mild' | 'moderate' | 'severe';
export type EpisodeOutcome = 'improved' | 'same' | 'escalated';
export type Technique = { name: string; effective: boolean };
export type EpisodeHR = { avg: number; min: number; max: number };

/** Un episodio de crisis (resumen estructurado guardado tras finalizar). */
export type Episode = {
  id: string;
  started_at: string;
  ended_at: string;
  duration_sec: number;
  severity: EpisodeSeverity;
  symptoms: string[];
  techniques: Technique[];
  outcome: EpisodeOutcome;
  summary: string;
  hr: EpisodeHR | null;
  referral: string | null;
  created_at?: string;
};

/** Lo que devuelve la Edge Function episode-summary (parte cualitativa). */
type AiSummary = {
  severity: EpisodeSeverity;
  symptoms: string[];
  techniques: Technique[];
  outcome: EpisodeOutcome;
  summary: string;
};

// Genera el resumen del episodio (IA, server-side) y lo guarda. No lanza: si falla, registra y sigue.
export async function generateAndSaveEpisode(params: {
  messages: ChatMessage[];
  hr: EpisodeHR | null;
  startedAt: number;   // epoch ms del inicio del episodio
  durationSec: number;
  referral: string | null;
  locale: string;
}): Promise<Episode | null> {
  try {
    const hasUserTurn = params.messages.some((m) => m.role === 'user');
    if (!hasUserTurn) return null;

    const { data: ai, error: aiErr } = await supabase.functions.invoke<AiSummary>('episode-summary', {
      body: {
        messages: params.messages,
        hr: params.hr,
        durationSec: params.durationSec,
        locale: params.locale,
      },
    });
    if (aiErr || !ai) {
      console.warn('[episodes] resumen IA falló:', aiErr);
      return null;
    }

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return null;

    const row = {
      user_id: userId,
      started_at: new Date(params.startedAt).toISOString(),
      ended_at: new Date().toISOString(),
      duration_sec: params.durationSec,
      severity: ai.severity,
      symptoms: ai.symptoms,
      techniques: ai.techniques,
      outcome: ai.outcome,
      summary: ai.summary,
      hr: params.hr,
      referral: params.referral,
    };

    const { data, error } = await supabase.from('episodes').insert([row]).select().single();
    if (error) {
      console.warn('[episodes] insert falló:', error);
      return null;
    }
    return data as Episode;
  } catch (e) {
    console.warn('[episodes] error generando/guardando episodio:', e);
    return null;
  }
}

/** Lista episodios del usuario (más recientes primero) para el Historial. */
export async function getEpisodes(limit = 50): Promise<Episode[]> {
  const { data, error } = await supabase
    .from('episodes')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[episodes] getEpisodes falló:', error);
    return [];
  }
  return (data ?? []) as Episode[];
}

/** Trae un episodio puntual por id (pantalla de detalle). */
export async function getEpisode(id: string): Promise<Episode | null> {
  const { data, error } = await supabase.from('episodes').select('*').eq('id', id).maybeSingle();
  if (error) {
    console.warn('[episodes] getEpisode falló:', error);
    return null;
  }
  return (data as Episode) ?? null;
}
