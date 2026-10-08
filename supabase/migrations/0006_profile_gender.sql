-- =============================================================
-- PanicAI — Género (opcional) en el perfil
-- =============================================================
-- Dato opcional que el usuario puede dar en el onboarding o el perfil
-- para un acompañamiento más personalizado (la IA ajusta el trato).
-- Valores: 'female' | 'male' | 'nonbinary' | 'prefer_not' | null.
-- El nombre (display_name) ya existe en profiles desde 0001.
-- =============================================================

alter table public.profiles
  add column if not exists gender text
    check (gender in ('female', 'male', 'nonbinary', 'prefer_not'));
