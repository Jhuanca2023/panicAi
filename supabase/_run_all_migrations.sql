-- =============================================================
-- PanicAI — Initial Schema (perfil genérico)
-- Las tablas específicas del producto (episodios de crisis,
-- síntomas, recursos de ayuda, etc.) se agregarán en migraciones
-- posteriores. Esta sienta la base de autenticación + perfil.
-- =============================================================

create extension if not exists "uuid-ossp";

-- =============================================================
-- UTILITY: updated_at trigger
-- =============================================================

create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================
-- PROFILES
-- Extiende auth.users. Se crea automáticamente en el signup.
-- =============================================================

create table public.profiles (
  id                       uuid primary key references auth.users(id) on delete cascade,
  display_name             text,
  avatar_url               text,
  locale                   text not null default 'es-PE',   -- BCP 47 locale
  plan                     text not null default 'free' check (plan in ('free', 'plus')),
  has_completed_onboarding boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create trigger handle_updated_at before update on public.profiles
  for each row execute procedure public.handle_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
-- =============================================================
-- AVATARS STORAGE BUCKET
-- Bucket público para fotos de perfil. Cada usuario sube a una
-- carpeta con su uid: avatars/{user_id}/*.jpg
-- =============================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Lectura pública (el bucket es público; esta policy hace explícita la intención)
create policy "Avatars are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- El usuario solo puede subir a su propia carpeta
create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- El usuario solo puede actualizar archivos en su propia carpeta
create policy "Users can update their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- El usuario solo puede eliminar archivos en su propia carpeta
create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
-- =============================================================
-- PanicAI — Borrado de cuenta iniciado por el usuario
-- =============================================================
-- RPC que el usuario autenticado puede llamar para borrar su
-- propia cuenta. El ON DELETE CASCADE desde auth.users → profiles
-- (y futuras tablas con FK a profiles) hace que un solo delete
-- en auth.users elimine todas las filas del usuario.
--
-- NOTA sobre Storage: los avatares NO se borran con esto, solo
-- quedan huérfanos. Un job de limpieza periódico puede barrerlos
-- después. Para cumplimiento de tiendas (Play/App Store) esto es
-- aceptable: la data de cara al usuario desaparece de inmediato.
-- =============================================================

create or replace function public.delete_user_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  -- El cascade hace el trabajo pesado vía la cadena de FKs.
  delete from auth.users where id = uid;
end;
$$;

grant execute on function public.delete_user_account() to authenticated;
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
