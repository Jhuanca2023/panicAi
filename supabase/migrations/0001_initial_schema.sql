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
