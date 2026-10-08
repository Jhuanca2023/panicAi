-- =============================================================
-- PanicAI — Perfil de síntomas
-- =============================================================
-- `symptoms`        catálogo de síntomas preset (localizado es/en),
--                   lectura pública.
-- `user_symptoms`   síntomas habituales que el usuario registra.
--                   Cada fila apunta a un preset (symptom_id) O a un
--                   texto libre (custom_label). RLS: solo el dueño.
--
-- Estos "síntomas habituales" se inyectan luego en el system prompt
-- de la IA para personalizar el acompañamiento.
-- =============================================================

-- =============================================================
-- SYMPTOMS (catálogo preset)
-- =============================================================

create table public.symptoms (
  id         uuid primary key default uuid_generate_v4(),
  key        text unique not null,        -- identificador estable: 'tachycardia'
  names      jsonb not null,              -- {"es": "...", "en": "..."}
  category   text check (category in ('physical', 'cognitive', 'emotional')),
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.symptoms enable row level security;

create policy "Symptoms are publicly readable"
  on public.symptoms for select
  using (true);

-- =============================================================
-- USER SYMPTOMS
-- =============================================================

create table public.user_symptoms (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  symptom_id   uuid references public.symptoms(id) on delete cascade,
  custom_label text,
  created_at   timestamptz not null default now(),
  -- Debe referenciar un preset O traer un texto libre (no ambos vacíos).
  constraint user_symptoms_has_value
    check (symptom_id is not null or custom_label is not null)
);

-- Un mismo preset no se repite por usuario.
create unique index user_symptoms_unique_preset
  on public.user_symptoms (user_id, symptom_id)
  where symptom_id is not null;

-- Un mismo texto libre (case-insensitive) no se repite por usuario.
create unique index user_symptoms_unique_custom
  on public.user_symptoms (user_id, lower(custom_label))
  where custom_label is not null;

alter table public.user_symptoms enable row level security;

create policy "Users can manage their own symptoms"
  on public.user_symptoms for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =============================================================
-- SEED — síntomas preset (criterios tipo DSM-5 de ataque de pánico)
-- =============================================================

insert into public.symptoms (key, names, category, position) values
  ('tachycardia',          '{"es": "Taquicardia (corazón acelerado)", "en": "Racing or pounding heart"}',        'physical',  1),
  ('shortness_of_breath',  '{"es": "Dificultad para respirar", "en": "Shortness of breath"}',                    'physical',  2),
  ('chest_tightness',      '{"es": "Opresión en el pecho", "en": "Chest tightness or pain"}',                    'physical',  3),
  ('choking',              '{"es": "Sensación de ahogo", "en": "Choking sensation"}',                            'physical',  4),
  ('sweating',             '{"es": "Sudoración", "en": "Sweating"}',                                             'physical',  5),
  ('trembling',            '{"es": "Temblores", "en": "Trembling or shaking"}',                                  'physical',  6),
  ('dizziness',            '{"es": "Mareos o aturdimiento", "en": "Dizziness or lightheadedness"}',              'physical',  7),
  ('nausea',               '{"es": "Náuseas o malestar estomacal", "en": "Nausea or stomach distress"}',         'physical',  8),
  ('chills_or_heat',       '{"es": "Escalofríos o sofocos", "en": "Chills or hot flashes"}',                     'physical',  9),
  ('numbness',             '{"es": "Hormigueo o entumecimiento", "en": "Numbness or tingling"}',                 'physical', 10),
  ('derealization',        '{"es": "Sensación de irrealidad o desconexión", "en": "Feeling unreal or detached"}','cognitive', 11),
  ('fear_losing_control',  '{"es": "Miedo a perder el control", "en": "Fear of losing control"}',                'cognitive', 12),
  ('fear_dying',           '{"es": "Miedo a morir", "en": "Fear of dying"}',                                     'emotional', 13);
