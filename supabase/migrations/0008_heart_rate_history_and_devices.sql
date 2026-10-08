-- =============================================================
-- PanicAI — Historial de ritmo cardíaco y dispositivos
-- =============================================================

-- Tabla de dispositivos conectados
CREATE TABLE IF NOT EXISTS public.devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('smartwatch', 'heart_rate_monitor', 'other')),
  manufacturer TEXT,
  model TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_connected BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own devices"
  ON public.devices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own devices"
  ON public.devices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own devices"
  ON public.devices FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own devices"
  ON public.devices FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger para updated_at en devices
CREATE TRIGGER handle_devices_updated_at
  BEFORE UPDATE ON public.devices
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- Tabla de historial de ritmo cardíaco
CREATE TABLE IF NOT EXISTS public.heart_rate_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bpm INTEGER NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('normal', 'elevated', 'panic')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.heart_rate_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own heart rate history"
  ON public.heart_rate_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own heart rate history"
  ON public.heart_rate_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Índice para consultas eficientes por usuario y fecha
CREATE INDEX IF NOT EXISTS idx_heart_rate_user_timestamp
  ON public.heart_rate_history (user_id, timestamp DESC);
