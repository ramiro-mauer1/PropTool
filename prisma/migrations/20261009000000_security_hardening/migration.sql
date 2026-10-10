-- Security hardening.
--
-- 1. Nothing in `public` is reachable through Supabase's REST API. The anon
--    key ships in the browser bundle, so any table the `anon`/`authenticated`
--    roles can touch is readable and writable by anyone on the internet. The
--    app only talks to these tables through Prisma, which connects as the
--    table owner (bypasses RLS), so RLS on + every grant revoked costs nothing.
--
-- 2. Access to the app is an `app_metadata.plinth_access` flag on the auth
--    user. app_metadata can only be written with the service role, so a
--    public sign-up straight against Supabase Auth (bypassing the allowlist)
--    gets a session but no access. The flag follows `AllowedEmail`: adding an
--    email grants it to an existing account, removing it revokes it and ends
--    that person's sessions.
--
-- 3. A small fixed-window counter table for rate limiting (see
--    src/lib/security/rateLimit.ts).

-- ─── 1. Lock down the public schema ────────────────────────────────────────

CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

ALTER TABLE "AllowedEmail" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Contact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Property" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Interaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FollowupTask" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Captacion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RateLimit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- Tables Prisma creates later must not inherit Supabase's default grants.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

-- ─── 2. Access flag, kept in sync with AllowedEmail ────────────────────────

-- Not exposed through the REST API (only `public` is).
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.sync_plinth_access() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP IN ('DELETE', 'UPDATE') THEN
    UPDATE auth.users
       SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) - 'plinth_access'
     WHERE lower(email) = lower(OLD.email);
    DELETE FROM auth.sessions
     WHERE user_id IN (SELECT id FROM auth.users WHERE lower(email) = lower(OLD.email));
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    UPDATE auth.users
       SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"plinth_access": true}'::jsonb
     WHERE lower(email) = lower(NEW.email) AND email_confirmed_at IS NOT NULL;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS "AllowedEmail_sync_access" ON "AllowedEmail";
CREATE TRIGGER "AllowedEmail_sync_access"
  AFTER INSERT OR UPDATE OF email OR DELETE ON "AllowedEmail"
  FOR EACH ROW EXECUTE FUNCTION private.sync_plinth_access();

-- Backfill: accounts that already exist and are allowlisted keep working.
UPDATE auth.users
   SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"plinth_access": true}'::jsonb
 WHERE email_confirmed_at IS NOT NULL
   AND lower(email) IN (SELECT lower(email) FROM "AllowedEmail");

-- Storage policies can't read auth.users; this answers for the caller only.
CREATE OR REPLACE FUNCTION private.has_plinth_access() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(
    (SELECT (raw_app_meta_data ->> 'plinth_access')::boolean FROM auth.users WHERE id = auth.uid()),
    false
  );
$$;
REVOKE ALL ON FUNCTION private.has_plinth_access() FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_plinth_access() TO authenticated;
REVOKE ALL ON FUNCTION private.sync_plinth_access() FROM PUBLIC;

-- ─── Avatars bucket: only images, only people with access ──────────────────

-- The client re-encodes avatars to a small JPEG before uploading.
UPDATE storage.buckets
   SET file_size_limit = 2097152,
       allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
 WHERE id = 'avatars';

drop policy if exists "avatars_owner_insert" on storage.objects;
create policy "avatars_owner_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text and private.has_plinth_access());

drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text and private.has_plinth_access());

drop policy if exists "avatars_owner_delete" on storage.objects;
create policy "avatars_owner_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text and private.has_plinth_access());
