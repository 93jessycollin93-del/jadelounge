
ALTER TABLE public.friend_requests
  ADD CONSTRAINT friend_requests_sender_id_fkey FOREIGN KEY (sender_id)
  REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.friend_requests
  ADD CONSTRAINT friend_requests_recipient_id_fkey FOREIGN KEY (recipient_id)
  REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.conversation_participants
  ADD CONSTRAINT conversation_participants_user_id_fkey FOREIGN KEY (user_id)
  REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id)
  REFERENCES public.profiles(id) ON DELETE CASCADE;
