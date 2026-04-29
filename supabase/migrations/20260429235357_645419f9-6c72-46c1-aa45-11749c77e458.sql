-- Status enum
CREATE TYPE public.video_asset_status AS ENUM (
  'uploaded',
  'submitted',
  'processing',
  'ready',
  'failed',
  'canceled'
);

-- Main table
CREATE TABLE public.video_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NULL,
  owner_id UUID NOT NULL,
  source_key TEXT NOT NULL,
  mediaconvert_job_id TEXT NULL UNIQUE,
  status public.video_asset_status NOT NULL DEFAULT 'uploaded',
  hls_url TEXT NULL,
  mp4_url TEXT NULL,
  poster_url TEXT NULL,
  preview_url TEXT NULL,
  captions_url TEXT NULL,
  thumbnails_vtt_url TEXT NULL,
  duration_seconds NUMERIC NULL,
  width INTEGER NULL,
  height INTEGER NULL,
  error_message TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_video_assets_job_id ON public.video_assets(mediaconvert_job_id);
CREATE INDEX idx_video_assets_post ON public.video_assets(post_id);
CREATE INDEX idx_video_assets_owner ON public.video_assets(owner_id);

-- updated_at trigger
CREATE TRIGGER trg_video_assets_updated_at
BEFORE UPDATE ON public.video_assets
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS
ALTER TABLE public.video_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "video_assets_select_visible"
ON public.video_assets
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = video_assets.post_id
      AND (
        p.visibility = 'public'::post_visibility
        OR p.author_id = auth.uid()
        OR (p.visibility = 'followers'::post_visibility AND public.is_following(auth.uid(), p.author_id))
        OR (p.community_id IS NOT NULL AND public.is_community_member(p.community_id, auth.uid()))
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'moderator'::app_role)
      )
  )
);

CREATE POLICY "video_assets_insert_own"
ON public.video_assets
FOR INSERT
TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND (
    post_id IS NULL
    OR EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.author_id = auth.uid())
  )
);

CREATE POLICY "video_assets_update_own"
ON public.video_assets
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "video_assets_delete_own"
ON public.video_assets
FOR DELETE
TO authenticated
USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));