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
