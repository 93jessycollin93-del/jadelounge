
-- 1) Profile website: only allow http(s) URLs (prevents javascript: XSS)
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_website_protocol_check
  CHECK (website IS NULL OR website ~* '^https?://');

-- 2) post_media SELECT: mirror posts visibility logic
DROP POLICY IF EXISTS media_select ON public.post_media;
CREATE POLICY media_select ON public.post_media
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_media.post_id
      AND (
        p.visibility = 'public'
        OR p.author_id = auth.uid()
        OR (p.visibility = 'followers' AND public.is_following(auth.uid(), p.author_id))
        OR (p.community_id IS NOT NULL AND public.is_community_member(p.community_id, auth.uid()))
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'moderator'::public.app_role)
      )
  )
);

-- 3) Revoke anon execute on SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_blocked_between(uuid, uuid) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.is_blocked_between(uuid, uuid) TO authenticated;

-- 4) Defense-in-depth: restrictive policy preventing non-admin writes to user_roles
CREATE POLICY user_roles_admin_only_writes ON public.user_roles
AS RESTRICTIVE
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 5) Set search_path on touch_updated_at to satisfy linter
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$;
