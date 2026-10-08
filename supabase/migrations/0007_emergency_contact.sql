-- =============================================================
-- PanicAI — Contacto de emergencia (opcional) en el perfil
-- =============================================================
-- Persona de confianza a la que el usuario puede pedir llamar durante
-- una crisis. La IA lo tiene en cuenta: si el usuario dice que quiere
-- llamar a su contacto, ofrece marcarlo (tarjeta de un toque).
-- Ambos campos son opcionales; se configuran desde el Perfil.
-- =============================================================

alter table public.profiles
  add column if not exists emergency_contact_name  text,
  add column if not exists emergency_contact_phone text;
