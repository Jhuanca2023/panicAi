import { supabase } from './supabase';
import type { HeartRateSample } from './heartRate/types';

type Trend = 'rising' | 'falling' | 'stable';

export type HRFeedbackRequest = {
  avgBpm: number;
  minBpm: number;
  maxBpm: number;
  trend:  Trend;
  locale?: string;
};

/** Calcula la tendencia comparando la primera y segunda mitad del historial. */
export function calcTrend(samples: Pick<HeartRateSample, 'bpm'>[]): Trend {
  if (samples.length < 4) return 'stable';
  const mid   = Math.floor(samples.length / 2);
  const first = samples.slice(0, mid);
  const last  = samples.slice(mid);
  const avg   = (arr: typeof first) => arr.reduce((s, x) => s + x.bpm, 0) / arr.length;
  const diff  = avg(last) - avg(first);
  if (diff >  5) return 'rising';
  if (diff < -5) return 'falling';
  return 'stable';
}

/** Construye los parámetros a partir de los últimos N samples. */
export function buildFeedbackParams(
  allSamples: HeartRateSample[],
  locale: string,
): HRFeedbackRequest {
  const window = allSamples.slice(-5);
  const bpms   = window.map(s => s.bpm);
  return {
    avgBpm: Math.round(bpms.reduce((s, x) => s + x, 0) / bpms.length),
    minBpm: Math.min(...bpms),
    maxBpm: Math.max(...bpms),
    trend:  calcTrend(allSamples),
    locale,
  };
}

// Llama a la Edge Function liviana `hr-feedback` con solo los agregados de FC
// (no el historial), para que el monitoreo continuo sea barato. No consume sesión.
export async function getHRFeedback(req: HRFeedbackRequest): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ message: string }>(
    'hr-feedback',
    {
      body: {
        avgBpm: req.avgBpm,
        minBpm: req.minBpm,
        maxBpm: req.maxBpm,
        trend: req.trend,
        locale: req.locale,
      },
    },
  );

  if (error || !data?.message) throw new Error('hr_feedback_failed');
  return data.message;
}
