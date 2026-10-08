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
