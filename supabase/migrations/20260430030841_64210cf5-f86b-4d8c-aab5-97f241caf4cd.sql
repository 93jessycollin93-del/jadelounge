-- 1. Lock down SECURITY DEFINER helper functions: revoke from authenticated.
-- These are used only inside RLS policies (which run as the function owner),
-- so revoking authenticated EXECUTE does not break RLS evaluation.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_following(uuid, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_community_member(uuid, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.community_role_of(uuid, uuid) FROM authenticated;

-- 2. Tighten public storage buckets to prevent listing all files.
-- Drop any broad SELECT policies on avatars/covers and replace with
-- per-object policies that allow direct file fetches but not bucket listing.
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname IN (
        'Avatar images are publicly accessible',
        'Cover images are publicly accessible',
        'avatars_public_read',
        'covers_public_read',
        'Public Access',
        'Public read avatars',
        'Public read covers'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Allow reading individual avatar/cover objects (anon + authenticated) but
-- do NOT permit listing entire bucket contents from the client.
CREATE POLICY "avatars_object_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'avatars');

CREATE POLICY "covers_object_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'covers');
