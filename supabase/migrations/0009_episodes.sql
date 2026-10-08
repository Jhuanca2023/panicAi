-- =============================================================
-- PanicAI — Episodios de crisis (resumen estructurado generado por IA)
-- =============================================================
--
-- Al finalizar un Modo Crisis (el usuario marca "Ya me siento mejor"),
-- GPT-4o-mini analiza la conversación y genera un resumen estructurado que se
-- guarda aquí. Sirve para: (1) mostrar el Historial y (2) inyectar los últimos
-- 5 episodios como contexto en el system prompt de la siguiente crisis, para
-- que la IA reconozca patrones (síntomas frecuentes, técnicas que funcionan).

CREATE TABLE IF NOT EXISTS public.episodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_sec INTEGER NOT NULL DEFAULT 0,
  -- Severidad estimada del episodio.
  severity TEXT NOT NULL DEFAULT 'moderate' CHECK (severity IN ('mild', 'moderate', 'severe')),
  -- Síntomas que la persona mencionó/presentó (textos cortos).
  symptoms TEXT[] NOT NULL DEFAULT '{}',
  -- Técnicas aplicadas y si fueron efectivas: [{ "name": "4-7-8 breathing", "effective": true }]
  techniques JSONB NOT NULL DEFAULT '[]',
  -- Resultado del acompañamiento.
  outcome TEXT NOT NULL DEFAULT 'same' CHECK (outcome IN ('improved', 'same', 'escalated')),
  -- Resumen legible (2-3 frases) para mostrar en el Historial.
  summary TEXT NOT NULL DEFAULT '',
  -- Resumen de pulsaciones SOLO si se usó reloj/banda: { "avg": 110, "min": 70, "max": 150 }.
  hr JSONB,
  -- Línea a la que se derivó, si aplica: '113' | '106' | '100' | 'contact'.
  referral TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.episodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own episodes"
  ON public.episodes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own episodes"
  ON public.episodes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own episodes"
  ON public.episodes FOR DELETE
  USING (auth.uid() = user_id);

-- Índice para listar el historial y traer los últimos N por usuario.
CREATE INDEX IF NOT EXISTS idx_episodes_user_started
  ON public.episodes (user_id, started_at DESC);
