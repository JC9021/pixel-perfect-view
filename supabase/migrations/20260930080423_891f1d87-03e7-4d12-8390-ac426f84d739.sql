
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_household_member(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_household_by_code(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_household_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_household_by_code(TEXT) TO authenticated;
