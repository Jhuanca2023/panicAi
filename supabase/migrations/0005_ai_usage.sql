-- =============================================================
-- PanicAI — Uso de sesiones de IA (cap del plan Free)
-- =============================================================
-- Registra cuántas sesiones de Modo Crisis abre cada usuario por
-- mes. Una "sesión" = una crisis completa (se cuenta al abrir el
-- Modo Crisis; dentro se intercambian mensajes ilimitados).
--
-- Plan Free: 5 sesiones/mes. Plan Plus: ilimitado (la Edge Function
-- omite el chequeo). Ver doc financiero: "5 sesiones ≈ 1 por semana".
--
-- Una fila por (user_id, period), donde period es el primer día del
-- mes (date truncado a mes). Conservamos el histórico para analítica.
-- =============================================================

create table if not exists public.ai_usage (
  user_id    uuid not null references auth.users(id) on delete cascade,
  period     date not null default date_trunc('month', now())::date,
  count      integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, period)
);

create index if not exists ai_usage_user_period_idx
  on public.ai_usage (user_id, period desc);

alter table public.ai_usage enable row level security;

-- El usuario puede leer su propio uso (para mostrar "3 de 5 sesiones").
create policy "Users can view their own ai usage"
  on public.ai_usage for select
  using (user_id = auth.uid());

-- El usuario puede insertar/actualizar su propio uso. La Edge Function
-- corre con el JWT del usuario, así que estas policies cubren el
-- incremento desde la función.
create policy "Users can insert their own ai usage"
  on public.ai_usage for insert
  with check (user_id = auth.uid());

create policy "Users can update their own ai usage"
  on public.ai_usage for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
