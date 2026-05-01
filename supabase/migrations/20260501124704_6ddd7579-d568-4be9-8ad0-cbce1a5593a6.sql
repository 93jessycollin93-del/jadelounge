DROP POLICY IF EXISTS video_assets_update_own ON public.video_assets;

CREATE POLICY video_assets_update_own
ON public.video_assets
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (
  owner_id = auth.uid()
  AND (
    post_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = video_assets.post_id
        AND p.author_id = auth.uid()
    )
  )
);