DROP POLICY IF EXISTS comments_select ON public.comments;

CREATE POLICY comments_select ON public.comments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = comments.post_id
      AND (
        p.visibility = 'public'
        OR p.author_id = auth.uid()
        OR (p.visibility = 'followers' AND public.is_following(auth.uid(), p.author_id))
        OR (p.community_id IS NOT NULL AND public.is_community_member(p.community_id, auth.uid()))
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'moderator'::app_role)
      )
  )
);