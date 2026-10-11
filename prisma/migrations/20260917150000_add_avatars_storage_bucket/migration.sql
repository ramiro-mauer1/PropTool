-- Supabase Storage bucket for user profile avatars.
--
-- `storage.*` lives outside the app schema Prisma tracks (schema.prisma only
-- models our own tables) — this migration is carried by Prisma purely so it
-- runs once per environment via `prisma migrate deploy`, using the direct
-- connection (DIRECT_URL) since it's DDL against Supabase's storage schema.
--
-- Public bucket: avatars are meant to be viewable by anyone with the URL
-- (they're shown in the sidebar), but only the owning user (folder named
-- after their auth uid) can write to their own avatar.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars_owner_insert" on storage.objects;
create policy "avatars_owner_insert"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_owner_delete" on storage.objects;
create policy "avatars_owner_delete"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
