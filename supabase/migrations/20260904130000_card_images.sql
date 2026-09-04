insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'card-images',
  'card-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "card_images_public_read" on storage.objects;
create policy "card_images_public_read"
  on storage.objects for select
  using (bucket_id = 'card-images');

drop policy if exists "card_images_admin_insert" on storage.objects;
create policy "card_images_admin_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'card-images'
    and exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );

drop policy if exists "card_images_admin_update" on storage.objects;
create policy "card_images_admin_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'card-images'
    and exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  )
  with check (
    bucket_id = 'card-images'
    and exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );

drop policy if exists "card_images_admin_delete" on storage.objects;
create policy "card_images_admin_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'card-images'
    and exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );