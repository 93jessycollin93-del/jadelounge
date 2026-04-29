
-- =========================================================
-- 1. POST MEDIA: add media type + dimensions for videos/images
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.media_kind AS ENUM ('image', 'video');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.post_media
  ADD COLUMN IF NOT EXISTS media_type public.media_kind NOT NULL DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS width integer,
  ADD COLUMN IF NOT EXISTS height integer,
  ADD COLUMN IF NOT EXISTS duration_seconds numeric,
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS storage_path text;

CREATE INDEX IF NOT EXISTS idx_post_media_post ON public.post_media(post_id, position);

-- =========================================================
-- 2. STORAGE POLICIES for post-media (owner-folder model)
-- =========================================================
DROP POLICY IF EXISTS "post_media_public_read" ON storage.objects;
CREATE POLICY "post_media_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'post-media');

DROP POLICY IF EXISTS "post_media_owner_insert" ON storage.objects;
CREATE POLICY "post_media_owner_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'post-media'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "post_media_owner_update" ON storage.objects;
CREATE POLICY "post_media_owner_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'post-media'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "post_media_owner_delete" ON storage.objects;
CREATE POLICY "post_media_owner_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'post-media'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- =========================================================
-- 3. FRIEND REQUESTS
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.friend_request_status AS ENUM ('pending', 'accepted', 'declined', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  status public.friend_request_status NOT NULL DEFAULT 'pending',
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CONSTRAINT friend_requests_distinct CHECK (sender_id <> recipient_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_pending_friend_request
  ON public.friend_requests(sender_id, recipient_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_fr_recipient ON public.friend_requests(recipient_id, status);
CREATE INDEX IF NOT EXISTS idx_fr_sender ON public.friend_requests(sender_id, status);

ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fr_select_party" ON public.friend_requests
  FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

CREATE POLICY "fr_insert_sender" ON public.friend_requests
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND status = 'pending');

CREATE POLICY "fr_update_recipient_or_sender" ON public.friend_requests
  FOR UPDATE TO authenticated
  USING (
    (recipient_id = auth.uid() AND status = 'pending')
    OR (sender_id = auth.uid() AND status = 'pending')
  );

CREATE POLICY "fr_delete_sender" ON public.friend_requests
  FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

-- =========================================================
-- 4. CONVERSATIONS + MESSAGES
-- =========================================================
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_group boolean NOT NULL DEFAULT false,
  title text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversation_participants (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_cp_user ON public.conversation_participants(user_id);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text,
  media_url text,
  media_type public.media_kind,
  is_edited boolean NOT NULL DEFAULT false,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messages_has_payload CHECK (
    (content IS NOT NULL AND length(trim(content)) > 0) OR media_url IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_messages_conv_time ON public.messages(conversation_id, created_at DESC);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Helper: is_conversation_member
CREATE OR REPLACE FUNCTION public.is_conversation_member(_conv uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = _conv AND user_id = _user
  )
$$;

CREATE POLICY "conv_select_member" ON public.conversations
  FOR SELECT TO authenticated
  USING (public.is_conversation_member(id, auth.uid()));

CREATE POLICY "conv_insert_creator" ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "conv_update_member" ON public.conversations
  FOR UPDATE TO authenticated
  USING (public.is_conversation_member(id, auth.uid()));

CREATE POLICY "cp_select_self_or_member" ON public.conversation_participants
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_conversation_member(conversation_id, auth.uid())
  );

CREATE POLICY "cp_insert_self_or_creator" ON public.conversation_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.created_by = auth.uid()
    )
  );

CREATE POLICY "cp_update_self" ON public.conversation_participants
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "cp_delete_self" ON public.conversation_participants
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "msg_select_member" ON public.messages
  FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()));

CREATE POLICY "msg_insert_member" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_conversation_member(conversation_id, auth.uid())
  );

CREATE POLICY "msg_update_own" ON public.messages
  FOR UPDATE TO authenticated
  USING (sender_id = auth.uid());

CREATE POLICY "msg_delete_own" ON public.messages
  FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

-- Bump conversation last_message_at on new message
CREATE OR REPLACE FUNCTION public.bump_conversation_last_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_bump_conv_last_msg ON public.messages;
CREATE TRIGGER trg_bump_conv_last_msg
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.bump_conversation_last_message();

-- =========================================================
-- 5. NOTIFICATION TRIGGERS
-- =========================================================
-- Allow triggers to insert notifications even though clients can't directly.
DROP POLICY IF EXISTS "notif_insert_system" ON public.notifications;
-- (still no public INSERT policy, but SECURITY DEFINER triggers bypass RLS)

-- Reactions on posts
CREATE OR REPLACE FUNCTION public.notify_post_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE author uuid;
BEGIN
  SELECT author_id INTO author FROM public.posts WHERE id = NEW.post_id;
  IF author IS NULL OR author = NEW.user_id THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (user_id, actor_id, type, payload)
  VALUES (author, NEW.user_id, 'post_reaction', jsonb_build_object('post_id', NEW.post_id, 'reaction', NEW.type));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_post_reaction ON public.reactions;
CREATE TRIGGER trg_notify_post_reaction
AFTER INSERT ON public.reactions
FOR EACH ROW EXECUTE FUNCTION public.notify_post_reaction();

-- Comments on posts
CREATE OR REPLACE FUNCTION public.notify_post_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE author uuid; parent_author uuid;
BEGIN
  SELECT author_id INTO author FROM public.posts WHERE id = NEW.post_id;
  IF author IS NOT NULL AND author <> NEW.author_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type, payload)
    VALUES (author, NEW.author_id, 'post_comment',
      jsonb_build_object('post_id', NEW.post_id, 'comment_id', NEW.id));
  END IF;

  IF NEW.parent_id IS NOT NULL THEN
    SELECT author_id INTO parent_author FROM public.comments WHERE id = NEW.parent_id;
    IF parent_author IS NOT NULL AND parent_author <> NEW.author_id AND parent_author <> COALESCE(author,'00000000-0000-0000-0000-000000000000'::uuid) THEN
      INSERT INTO public.notifications (user_id, actor_id, type, payload)
      VALUES (parent_author, NEW.author_id, 'comment_reply',
        jsonb_build_object('post_id', NEW.post_id, 'comment_id', NEW.id, 'parent_id', NEW.parent_id));
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_post_comment ON public.comments;
CREATE TRIGGER trg_notify_post_comment
AFTER INSERT ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.notify_post_comment();

-- Follows
CREATE OR REPLACE FUNCTION public.notify_follow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.follower_id = NEW.following_id THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (user_id, actor_id, type, payload)
  VALUES (NEW.following_id, NEW.follower_id, 'follow', '{}'::jsonb);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_follow ON public.follows;
CREATE TRIGGER trg_notify_follow
AFTER INSERT ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.notify_follow();

-- Friend requests
CREATE OR REPLACE FUNCTION public.notify_friend_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, actor_id, type, payload)
    VALUES (NEW.recipient_id, NEW.sender_id, 'friend_request',
      jsonb_build_object('request_id', NEW.id));
  ELSIF TG_OP = 'UPDATE' AND NEW.status <> OLD.status THEN
    IF NEW.status = 'accepted' THEN
      INSERT INTO public.notifications (user_id, actor_id, type, payload)
      VALUES (NEW.sender_id, NEW.recipient_id, 'friend_accept',
        jsonb_build_object('request_id', NEW.id));
    ELSIF NEW.status = 'declined' THEN
      -- deliberately silent: don't notify sender of decline
      NULL;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_friend_request_ins ON public.friend_requests;
CREATE TRIGGER trg_notify_friend_request_ins
AFTER INSERT ON public.friend_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_friend_request();

DROP TRIGGER IF EXISTS trg_notify_friend_request_upd ON public.friend_requests;
CREATE TRIGGER trg_notify_friend_request_upd
AFTER UPDATE ON public.friend_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_friend_request();

-- Direct message notifications (one notif per recipient)
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT user_id FROM public.conversation_participants
    WHERE conversation_id = NEW.conversation_id AND user_id <> NEW.sender_id
  LOOP
    INSERT INTO public.notifications (user_id, actor_id, type, payload)
    VALUES (r.user_id, NEW.sender_id, 'message',
      jsonb_build_object('conversation_id', NEW.conversation_id, 'message_id', NEW.id));
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_new_message ON public.messages;
CREATE TRIGGER trg_notify_new_message
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_new_message();

-- Add new notification types if missing
DO $$ BEGIN
  ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'post_reaction';
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'post_comment';
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'comment_reply';
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'follow';
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'friend_request';
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'friend_accept';
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'message';
EXCEPTION WHEN others THEN NULL; END $$;

-- =========================================================
-- 6. REALTIME
-- =========================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;

ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.conversation_participants REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.friend_requests REPLICA IDENTITY FULL;
