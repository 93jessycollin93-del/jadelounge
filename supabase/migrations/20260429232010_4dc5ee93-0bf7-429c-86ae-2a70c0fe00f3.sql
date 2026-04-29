-- Helper: is there a block in either direction between two users?
CREATE OR REPLACE FUNCTION public.is_blocked_between(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocks
    WHERE (blocker_id = _a AND blocked_id = _b)
       OR (blocker_id = _b AND blocked_id = _a)
  )
$$;

-- Trigger: prevent sending a message to a 1:1 conversation with a user who has blocked you (or who you blocked)
CREATE OR REPLACE FUNCTION public.enforce_message_block()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_group_conv boolean;
  other_uid uuid;
BEGIN
  SELECT is_group INTO is_group_conv FROM public.conversations WHERE id = NEW.conversation_id;
  IF is_group_conv THEN
    -- For group convs, only block if every other participant blocks the sender; skip enforcement for now
    RETURN NEW;
  END IF;

  SELECT user_id INTO other_uid
  FROM public.conversation_participants
  WHERE conversation_id = NEW.conversation_id AND user_id <> NEW.sender_id
  LIMIT 1;

  IF other_uid IS NOT NULL AND public.is_blocked_between(NEW.sender_id, other_uid) THEN
    RAISE EXCEPTION 'Cannot send message: one of you has blocked the other'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_message_block ON public.messages;
CREATE TRIGGER trg_enforce_message_block
BEFORE INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.enforce_message_block();

-- Trigger: prevent adding a participant to a 1:1 conversation when a block exists with any existing member
CREATE OR REPLACE FUNCTION public.enforce_participant_block()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_group_conv boolean;
  existing record;
BEGIN
  SELECT is_group INTO is_group_conv FROM public.conversations WHERE id = NEW.conversation_id;
  IF is_group_conv THEN RETURN NEW; END IF;

  FOR existing IN
    SELECT user_id FROM public.conversation_participants
    WHERE conversation_id = NEW.conversation_id AND user_id <> NEW.user_id
  LOOP
    IF public.is_blocked_between(NEW.user_id, existing.user_id) THEN
      RAISE EXCEPTION 'Cannot start conversation: blocked'
        USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_participant_block ON public.conversation_participants;
CREATE TRIGGER trg_enforce_participant_block
BEFORE INSERT ON public.conversation_participants
FOR EACH ROW EXECUTE FUNCTION public.enforce_participant_block();