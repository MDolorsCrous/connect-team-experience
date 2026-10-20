-- Enduriment segons els advisors de Supabase.
-- (Les RPC admin_* i public_* són SECURITY DEFINER a propòsit: comproven el rol a dins
--  o només retornen dades públiques. booking_attempts no té polítiques a propòsit: només service_role.)
alter function public.touch_updated_at() set search_path = public;
alter function public.madrid_today() set search_path = public;
revoke execute on function public.audit_status_change() from authenticated, anon, public;
