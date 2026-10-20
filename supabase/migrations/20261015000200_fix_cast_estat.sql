-- Correcció detectada per tests/db-logic.sql: el CASE retornava text, no slot_status.
create or replace function public.admin_set_slot_open(p_slot uuid, p_open boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_status public.slot_status;
begin
  if not public.is_staff() then raise exception 'FORBIDDEN'; end if;
  select status into v_status from public.slots where id = p_slot for update;
  if not found then raise exception 'SLOT_NOT_FOUND'; end if;
  if exists (select 1 from public.bookings where slot_id = p_slot and holds_slot) then
    raise exception 'SLOT_HAS_BOOKING';
  end if;
  update public.slots
     set status = case when p_open then 'disponible'::public.slot_status else 'bloquejada'::public.slot_status end
   where id = p_slot;
end $$;

create or replace function public.admin_set_day_open(p_experience uuid, p_day date, p_open boolean)
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  if not public.is_staff() then raise exception 'FORBIDDEN'; end if;
  update public.slots s
     set status = case when p_open then 'disponible'::public.slot_status else 'bloquejada'::public.slot_status end
   where s.experience_id = p_experience and s.day = p_day
     and not exists (select 1 from public.bookings b where b.slot_id = s.id and b.holds_slot);
  get diagnostics v_count = row_count;
  return v_count;
end $$;
