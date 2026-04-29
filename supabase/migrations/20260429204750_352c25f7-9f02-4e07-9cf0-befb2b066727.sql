-- Lock down SECURITY DEFINER functions to authenticated users only
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_following(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_community_member(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.community_role_of(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_following(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_community_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.community_role_of(uuid, uuid) TO authenticated;
