
-- Make post-media bucket private
UPDATE storage.buckets SET public = false WHERE id = 'post-media';

-- Drop duplicate / overly-broad post-media storage policies
DROP POLICY IF EXISTS post_media_public_read ON storage.objects;
DROP POLICY IF EXISTS post_media_owner_insert ON storage.objects;
DROP POLICY IF EXISTS post_media_owner_update ON storage.objects;
DROP POLICY IF EXISTS post_media_owner_delete ON storage.objects;
DROP POLICY IF EXISTS postmedia_public_read ON storage.objects;

-- Authenticated SELECT policy on post-media: must be the owner OR allowed to view the parent post.
-- Convention: object name = "{owner_id}/{post_id}/{filename}"
CREATE POLICY postmedia_authed_read ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'post-media' AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1
      FROM public.post_media pm
      JOIN public.posts p ON p.id = pm.post_id
      WHERE pm.storage_path = storage.objects.name
        AND (
          p.visibility = 'public'
          OR p.author_id = auth.uid()
          OR (p.visibility = 'followers' AND public.is_following(auth.uid(), p.author_id))
          OR (p.community_id IS NOT NULL AND public.is_community_member(p.community_id, auth.uid()))
          OR public.has_role(auth.uid(), 'admin'::public.app_role)
          OR public.has_role(auth.uid(), 'moderator'::public.app_role)
        )
    )
  )
);

-- Revoke anon execute on remaining SECURITY DEFINER helpers in public schema.
-- Trigger functions don't need to be callable via RPC.
REVOKE EXECUTE ON FUNCTION public.add_owner_membership() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.bump_community_members() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.bump_conversation_last_message() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.bump_post_comment() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.bump_post_like() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.enforce_message_block() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.enforce_participant_block() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.notify_follow() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.notify_friend_request() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.notify_new_message() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.notify_post_comment() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.notify_post_reaction() FROM anon, public;
