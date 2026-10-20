-- Motor reutilitzable per a qualsevol workshop o team building:
--  * cada experiència pot tenir un màxim de participants (CONNECT Christmas: 50, segons el catàleg)
--  * la sol·licitud recull el municipi on es vol fer l'experiència (ho demana el catàleg)

alter table public.experiences add column max_participants int check (max_participants between 1 and 1000);
alter table public.bookings add column location text check (char_length(location) <= 120);
update public.experiences set max_participants = 50 where slug = 'connect-christmas-2026';

-- La web llegeix d'aquí tot el que necessita el calendari: franges, durada i màxim
drop function public.public_experience(text);
create function public.public_experience(p_slug text)
returns table (slug text, name text, duration_minutes int, max_participants int, slot_types jsonb)
language sql stable security definer set search_path = public as $$
  select e.slug, e.name, e.duration_minutes, e.max_participants,
         coalesce(jsonb_agg(jsonb_build_object('key', t.key, 'label', t.label,
                  'start_time', t.start_time, 'end_time', t.end_time) order by t.sort)
                  filter (where t.id is not null), '[]'::jsonb)
  from public.experiences e
  left join public.slot_types t on t.experience_id = e.id
  where e.slug = p_slug and e.active
  group by e.id;
$$;
revoke execute on function public.public_experience(text) from public;
grant execute on function public.public_experience(text) to anon, authenticated;

drop function public.create_prebooking(text, date, text, text, text, text, text, int, text, boolean, text, text, text);
create function public.create_prebooking(
  p_slug text, p_day date, p_slot_key text,
  p_company text, p_contact_name text, p_email text, p_phone text, p_location text,
  p_participants int, p_notes text, p_marketing boolean,
  p_privacy_version text, p_locale text, p_ip_hash text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_slot   record;
  v_id     uuid;
  v_ref    text;
  v_recent int;
begin
  if p_ip_hash is not null then
    insert into public.booking_attempts (ip_hash) values (p_ip_hash);
    select count(*) into v_recent from public.booking_attempts
      where ip_hash = p_ip_hash and at > now() - interval '1 hour';
    if v_recent > 10 then raise exception 'RATE_LIMITED'; end if;
    select count(*) into v_recent from public.bookings
      where ip_hash = p_ip_hash and created_at > now() - interval '1 hour';
    if v_recent >= 3 then raise exception 'RATE_LIMITED'; end if;
  end if;

  select s.id, s.status, s.day, e.id as experience_id, e.duration_minutes, e.max_participants,
         t.key, t.label, t.start_time, t.end_time
    into v_slot
  from public.slots s
  join public.slot_types t on t.id = s.slot_type_id
  join public.experiences e on e.id = s.experience_id
  where e.slug = p_slug and e.active and s.day = p_day and t.key = p_slot_key
  for update of s;

  if not found then raise exception 'SLOT_NOT_FOUND'; end if;
  if v_slot.day <= public.madrid_today() then raise exception 'SLOT_PAST'; end if;
  if v_slot.max_participants is not null and p_participants > v_slot.max_participants then
    raise exception 'PARTICIPANTS_MAX';
  end if;
  if v_slot.status <> 'disponible' then raise exception 'SLOT_UNAVAILABLE'; end if;

  v_ref := 'CNX-' || upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 8));

  begin
    insert into public.bookings (
      ref, experience_id, slot_id, day, slot_key, slot_label, start_time, end_time,
      duration_minutes, company, contact_name, email, phone, location, participants, notes,
      locale, privacy_accepted_at, privacy_version, marketing_consent, ip_hash)
    values (
      v_ref, v_slot.experience_id, v_slot.id, v_slot.day, v_slot.key, v_slot.label,
      v_slot.start_time, v_slot.end_time, v_slot.duration_minutes,
      btrim(p_company), btrim(p_contact_name), lower(btrim(p_email)), btrim(p_phone),
      nullif(btrim(coalesce(p_location, '')), ''),
      p_participants, nullif(btrim(coalesce(p_notes, '')), ''),
      coalesce(p_locale, 'ca'), now(), p_privacy_version, coalesce(p_marketing, false), p_ip_hash)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'SLOT_UNAVAILABLE';
  end;

  update public.slots set status = 'pendent' where id = v_slot.id;

  return jsonb_build_object(
    'id', v_id, 'ref', v_ref, 'day', v_slot.day, 'slot_key', v_slot.key,
    'slot_label', v_slot.label, 'start_time', v_slot.start_time,
    'end_time', v_slot.end_time, 'duration_minutes', v_slot.duration_minutes);
end $$;
revoke execute on function public.create_prebooking(text, date, text, text, text, text, text, text, int, text, boolean, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_prebooking(text, date, text, text, text, text, text, text, int, text, boolean, text, text, text)
  to service_role;

-- L'anonimització també esborra el municipi
create or replace function public.purge_personal_data() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_months int;
  v_count  int;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  select (value #>> '{}')::int into v_months from public.app_settings where key = 'retention_months';
  v_months := coalesce(v_months, 24);

  update public.bookings
     set contact_name = '[anonimitzat]', email = '[anonimitzat]', phone = '[anonimitzat]',
         location = null, notes = null, ip_hash = null, anonymized_at = now()
   where anonymized_at is null
     and created_at < now() - make_interval(months => v_months)
     and (commercial_status in ('cancellada', 'no_convertida')
          or (commercial_status = 'confirmada' and day < public.madrid_today()));
  get diagnostics v_count = row_count;

  delete from public.booking_notes n using public.bookings b
   where n.booking_id = b.id and b.anonymized_at is not null;
  delete from public.booking_attempts where at < now() - interval '1 day';
  return v_count;
end $$;
