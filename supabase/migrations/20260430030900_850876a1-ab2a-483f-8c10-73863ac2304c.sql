-- Revoke EXECUTE on all SECURITY DEFINER trigger functions from client roles.
-- Triggers fire as the table owner regardless, so this does not break anything.
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'public.handle_new_user()',
    'public.touch_updated_at()',
    'public.bump_community_members()',
    'public.bump_post_like()',
    'public.bump_post_comment()',
    'public.bump_conversation_last_message()',
    'public.add_owner_membership()',
    'public.enforce_participant_block()',
    'public.enforce_message_block()',
    'public.notify_post_reaction()',
    'public.notify_post_comment()',
    'public.notify_follow()',
    'public.notify_new_message()',
    'public.notify_friend_request()',
    'public.is_conversation_member(uuid, uuid)',
    'public.is_blocked_between(uuid, uuid)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXCEPTION WHEN undefined_function THEN
      -- skip if signature doesn't exist
      NULL;
    END;
  END LOOP;
END $$;
