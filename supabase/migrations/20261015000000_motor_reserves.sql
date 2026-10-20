-- =====================================================================
-- Motor de reserves d'experiències IMPAUSA
-- Primera experiència: CONNECT Christmas Experience (Nadal 2026)
--
-- Principis:
--   * El públic NO llegeix cap taula directament: només la RPC
--     public_availability(), que no exposa cap dada d'empresa.
--   * Les prerreserves només entren per create_prebooking(), executable
--     únicament amb la service role (des de la Netlify Function).
--   * Disponibilitat (slots.status) i estat comercial
--     (bookings.commercial_status) són camps separats.
--   * Tot canvi d'estat queda a audit_log, sense dades personals.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Tipus
-- ---------------------------------------------------------------------
create type public.slot_status as enum ('disponible', 'pendent', 'confirmada', 'bloquejada');
create type public.commercial_status as enum
  ('nova', 'contacte_pendent', 'negociacio', 'confirmada', 'cancellada', 'no_convertida');
create type public.staff_role as enum ('admin', 'comercial');

-- ---------------------------------------------------------------------
-- Taules
-- ---------------------------------------------------------------------
create table public.experiences (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  name             text not null,
  duration_minutes int  not null check (duration_minutes between 15 and 1440),
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);

create table public.slot_types (
  id            uuid primary key default gen_random_uuid(),
  experience_id uuid not null references public.experiences(id) on delete cascade,
  key           text not null check (key ~ '^[a-z0-9_-]{2,30}$'),
  label         text not null,
  start_time    time not null,
  end_time      time not null check (end_time > start_time),
  sort          int  not null default 0,
  unique (experience_id, key)
);

-- Una fila = una franja habilitada d'un dia concret.
-- Si un dia no té files, no està habilitat.
create table public.slots (
  id            uuid primary key default gen_random_uuid(),
  experience_id uuid not null references public.experiences(id) on delete cascade,
  slot_type_id  uuid not null references public.slot_types(id) on delete cascade,
  day           date not null,
  status        public.slot_status not null default 'disponible',
  updated_at    timestamptz not null default now(),
  unique (experience_id, day, slot_type_id)
);
create index slots_experience_day on public.slots (experience_id, day);

create table public.staff (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  role       public.staff_role not null default 'comercial',
  created_at timestamptz not null default now()
);

create table public.bookings (
  id                 uuid primary key default gen_random_uuid(),
  ref                text not null unique,
  experience_id      uuid not null references public.experiences(id),
  slot_id            uuid references public.slots(id) on delete set null,
  -- Còpia de la franja en el moment de la sol·licitud (traçabilitat)
  day                date not null,
  slot_key           text not null,
  slot_label         text not null,
  start_time         time not null,
  end_time           time not null,
  duration_minutes   int  not null,
  -- Dades de la sol·licitud
  company            text not null check (char_length(company) between 2 and 160),
  contact_name       text not null check (char_length(contact_name) between 1 and 160),
  email              text not null check (char_length(email) <= 254),
  phone              text not null check (char_length(phone) <= 40),
  participants       int  not null check (participants between 1 and 1000),
  notes              text check (char_length(notes) <= 2000),
  locale             text not null default 'ca',
  privacy_accepted_at timestamptz not null,
  privacy_version    text not null,
  marketing_consent  boolean not null default false,
  -- Gestió comercial (independent de la disponibilitat)
  commercial_status  public.commercial_status not null default 'nova',
  holds_slot         boolean not null default true,
  contacted_at       timestamptz,
  -- Traçabilitat tècnica
  ip_hash            text,
  confirmation_email_at timestamptz,
  internal_email_at  timestamptz,
  anonymized_at      timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
-- Garantia final contra dobles reserves: una sola sol·licitud activa per franja.
create unique index bookings_one_holder_per_slot on public.bookings (slot_id) where holds_slot;
create index bookings_created on public.bookings (created_at desc);
create index bookings_ip_recent on public.bookings (ip_hash, created_at);

create table public.booking_notes (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references public.bookings(id) on delete cascade,
  author_id    uuid default auth.uid(),
  author_email text,
  body         text not null check (char_length(body) between 1 and 4000),
  created_at   timestamptz not null default now()
);
create index booking_notes_booking on public.booking_notes (booking_id, created_at);

create table public.audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor_id    uuid,
  actor_email text,
  entity      text not null,
  entity_id   uuid,
  action      text not null,
  before      jsonb,
  after       jsonb
);
create index audit_log_entity on public.audit_log (entity, entity_id, at desc);

create table public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- Intents d'enviament (per limitar abusos), es purguen cada dia.
create table public.booking_attempts (
  id      bigint generated always as identity primary key,
  ip_hash text not null,
  at      timestamptz not null default now()
);
create index booking_attempts_ip on public.booking_attempts (ip_hash, at);

-- ---------------------------------------------------------------------
-- Helpers de rol
-- ---------------------------------------------------------------------
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid());
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid() and role = 'admin');
$$;

create or replace function public.madrid_today() returns date
language sql stable as $$ select (now() at time zone 'Europe/Madrid')::date; $$;

-- ---------------------------------------------------------------------
-- Auditoria (triggers): només camps d'estat, mai dades personals
-- ---------------------------------------------------------------------
create or replace function public.audit_status_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_before jsonb;
  v_after  jsonb;
  v_email  text := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email';
begin
  if tg_table_name = 'slots' then
    v_before := case when tg_op <> 'INSERT' then jsonb_build_object('day', old.day, 'status', old.status) end;
    v_after  := case when tg_op <> 'DELETE' then jsonb_build_object('day', new.day, 'status', new.status) end;
  else
    v_before := case when tg_op <> 'INSERT' then jsonb_build_object(
      'commercial_status', old.commercial_status, 'holds_slot', old.holds_slot,
      'contacted_at', old.contacted_at, 'anonymized_at', old.anonymized_at) end;
    v_after  := case when tg_op <> 'DELETE' then jsonb_build_object(
      'commercial_status', new.commercial_status, 'holds_slot', new.holds_slot,
      'contacted_at', new.contacted_at, 'anonymized_at', new.anonymized_at) end;
  end if;

  if tg_op = 'UPDATE' and v_before = v_after then
    return new;
  end if;

  insert into public.audit_log (actor_id, actor_email, entity, entity_id, action, before, after)
  values (auth.uid(), v_email, tg_table_name,
          case when tg_op = 'DELETE' then old.id else new.id end,
          lower(tg_op), v_before, v_after);
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create trigger slots_audit after insert or update or delete on public.slots
  for each row execute function public.audit_status_change();
create trigger bookings_audit after insert or update or delete on public.bookings
  for each row execute function public.audit_status_change();

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
create trigger slots_touch before update on public.slots
  for each row execute function public.touch_updated_at();
create trigger bookings_touch before update on public.bookings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- API pública: disponibilitat (sense cap dada d'empresa)
-- ---------------------------------------------------------------------
create or replace function public.public_availability(p_slug text, p_from date, p_to date)
returns table (day date, slot_key text, label text, start_time time, end_time time, status text)
language sql stable security definer set search_path = public as $$
  select s.day, t.key, t.label, t.start_time, t.end_time,
         case
           when s.day <= public.madrid_today() then 'no_disponible'
           when s.status = 'disponible'        then 'disponible'
           when s.status = 'pendent'           then 'pendent'
           else 'no_disponible'
         end
  from public.slots s
  join public.slot_types t on t.id = s.slot_type_id
  join public.experiences e on e.id = s.experience_id
  where e.slug = p_slug and e.active
    and s.day between p_from and least(p_to, p_from + 400)
  order by s.day, t.sort;
$$;

create or replace function public.public_experience(p_slug text)
returns table (slug text, name text, duration_minutes int, slot_types jsonb)
language sql stable security definer set search_path = public as $$
  select e.slug, e.name, e.duration_minutes,
         coalesce(jsonb_agg(jsonb_build_object('key', t.key, 'label', t.label,
                  'start_time', t.start_time, 'end_time', t.end_time) order by t.sort)
                  filter (where t.id is not null), '[]'::jsonb)
  from public.experiences e
  left join public.slot_types t on t.experience_id = e.id
  where e.slug = p_slug and e.active
  group by e.id;
$$;

-- ---------------------------------------------------------------------
-- Creació de prerreserva (atòmica, sense duplicitats)
-- Només service_role. La Netlify Function valida abans i després.
-- ---------------------------------------------------------------------
create or replace function public.create_prebooking(
  p_slug text, p_day date, p_slot_key text,
  p_company text, p_contact_name text, p_email text, p_phone text,
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
  -- Antiabús: màxim 10 intents i 3 sol·licituds per IP i hora
  if p_ip_hash is not null then
    insert into public.booking_attempts (ip_hash) values (p_ip_hash);
    select count(*) into v_recent from public.booking_attempts
      where ip_hash = p_ip_hash and at > now() - interval '1 hour';
    if v_recent > 10 then raise exception 'RATE_LIMITED'; end if;
    select count(*) into v_recent from public.bookings
      where ip_hash = p_ip_hash and created_at > now() - interval '1 hour';
    if v_recent >= 3 then raise exception 'RATE_LIMITED'; end if;
  end if;

  -- Bloqueja la fila de la franja: dues peticions simultànies s'esperen
  select s.id, s.status, s.day, e.id as experience_id, e.duration_minutes,
         t.key, t.label, t.start_time, t.end_time
    into v_slot
  from public.slots s
  join public.slot_types t on t.id = s.slot_type_id
  join public.experiences e on e.id = s.experience_id
  where e.slug = p_slug and e.active and s.day = p_day and t.key = p_slot_key
  for update of s;

  if not found then raise exception 'SLOT_NOT_FOUND'; end if;
  if v_slot.day <= public.madrid_today() then raise exception 'SLOT_PAST'; end if;
  if v_slot.status <> 'disponible' then raise exception 'SLOT_UNAVAILABLE'; end if;

  v_ref := 'CNX-' || upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 8));

  begin
    insert into public.bookings (
      ref, experience_id, slot_id, day, slot_key, slot_label, start_time, end_time,
      duration_minutes, company, contact_name, email, phone, participants, notes,
      locale, privacy_accepted_at, privacy_version, marketing_consent, ip_hash)
    values (
      v_ref, v_slot.experience_id, v_slot.id, v_slot.day, v_slot.key, v_slot.label,
      v_slot.start_time, v_slot.end_time, v_slot.duration_minutes,
      btrim(p_company), btrim(p_contact_name), lower(btrim(p_email)), btrim(p_phone),
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

-- ---------------------------------------------------------------------
-- RPC d'administració (comproven is_staff / is_admin)
-- ---------------------------------------------------------------------

-- Habilita o deshabilita un dia sencer (totes les franges de l'experiència)
create or replace function public.admin_set_day_enabled(p_experience uuid, p_day date, p_enabled boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'FORBIDDEN'; end if;
  if p_enabled then
    insert into public.slots (experience_id, slot_type_id, day)
    select p_experience, t.id, p_day from public.slot_types t where t.experience_id = p_experience
    on conflict (experience_id, day, slot_type_id) do nothing;
  else
    if exists (select 1 from public.slots s join public.bookings b on b.slot_id = s.id and b.holds_slot
               where s.experience_id = p_experience and s.day = p_day) then
      raise exception 'DAY_HAS_BOOKINGS';
    end if;
    delete from public.slots s
    where s.experience_id = p_experience and s.day = p_day
      and not exists (select 1 from public.bookings b where b.slot_id = s.id);
    -- Les franges amb historial de sol·licituds es bloquegen en lloc d'esborrar-se
    update public.slots set status = 'bloquejada'
    where experience_id = p_experience and day = p_day;
  end if;
end $$;

-- Habilita un rang de dates (per exemple, tots els dies laborables de nov-des)
create or replace function public.admin_enable_range(
  p_experience uuid, p_from date, p_to date, p_weekdays int[] default array[1,2,3,4,5])
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  if not public.is_staff() then raise exception 'FORBIDDEN'; end if;
  if p_to < p_from or p_to - p_from > 400 then raise exception 'INVALID_RANGE'; end if;
  insert into public.slots (experience_id, slot_type_id, day)
  select p_experience, t.id, d::date
  from generate_series(p_from, p_to, interval '1 day') d
  cross join public.slot_types t
  where t.experience_id = p_experience and extract(isodow from d)::int = any(p_weekdays)
  on conflict (experience_id, day, slot_type_id) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Obre (disponible) o tanca (bloquejada) una franja o tot un dia
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
  update public.slots set status = case when p_open then 'disponible' else 'bloquejada' end
  where id = p_slot;
end $$;

create or replace function public.admin_set_day_open(p_experience uuid, p_day date, p_open boolean)
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  if not public.is_staff() then raise exception 'FORBIDDEN'; end if;
  update public.slots s set status = case when p_open then 'disponible' else 'bloquejada' end
  where s.experience_id = p_experience and s.day = p_day
    and not exists (select 1 from public.bookings b where b.slot_id = s.id and b.holds_slot);
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Canvia l'estat comercial i manté la disponibilitat coherent.
-- p_release: en cancel·lar o marcar com a no convertida, allibera la franja.
create or replace function public.admin_update_booking(
  p_booking uuid, p_status public.commercial_status, p_release boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare
  b public.bookings;
  v_slot_status public.slot_status;
begin
  if not public.is_staff() then raise exception 'FORBIDDEN'; end if;
  select * into b from public.bookings where id = p_booking for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;

  if b.slot_id is not null then
    select status into v_slot_status from public.slots where id = b.slot_id for update;
  end if;

  if p_status = 'confirmada' then
    if not b.holds_slot then
      -- Recupera la franja només si ningú més la té
      if b.slot_id is null or v_slot_status <> 'disponible'
         or exists (select 1 from public.bookings where slot_id = b.slot_id and holds_slot) then
        raise exception 'SLOT_UNAVAILABLE';
      end if;
      update public.bookings set holds_slot = true where id = b.id;
    end if;
    update public.slots set status = 'confirmada' where id = b.slot_id;

  elsif p_status in ('cancellada', 'no_convertida') then
    if p_release and b.holds_slot then
      update public.bookings set holds_slot = false where id = b.id;
      update public.slots set status = 'disponible' where id = b.slot_id;
    elsif b.holds_slot then
      -- Continua retenint la franja fins que l'administració l'alliberi
      update public.slots set status = 'pendent' where id = b.slot_id;
    end if;

  else -- nova, contacte_pendent, negociacio
    if b.holds_slot then
      update public.slots set status = 'pendent' where id = b.slot_id;
    end if;
  end if;

  update public.bookings set commercial_status = p_status where id = b.id;
end $$;

-- Allibera la franja d'una sol·licitud sense canviar-ne l'estat comercial
create or replace function public.admin_release_slot(p_booking uuid)
returns void language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  if not public.is_staff() then raise exception 'FORBIDDEN'; end if;
  select * into b from public.bookings where id = p_booking for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  if b.holds_slot then
    update public.bookings set holds_slot = false where id = b.id;
    update public.slots set status = 'disponible' where id = b.slot_id;
  end if;
end $$;

create or replace function public.admin_mark_contacted(p_booking uuid, p_contacted boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'FORBIDDEN'; end if;
  update public.bookings
     set contacted_at = case when p_contacted then now() else null end,
         commercial_status = case when p_contacted and commercial_status in ('nova', 'contacte_pendent')
                                  then 'negociacio'::public.commercial_status else commercial_status end
   where id = p_booking;
end $$;

-- ---------------------------------------------------------------------
-- Retenció: anonimitza dades personals de sol·licituds tancades
-- ---------------------------------------------------------------------
create or replace function public.purge_personal_data() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_months int;
  v_count  int;
begin
  -- Permès a la service role (tasca programada) o a un admin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  select (value #>> '{}')::int into v_months from public.app_settings where key = 'retention_months';
  v_months := coalesce(v_months, 24);

  update public.bookings
     set contact_name = '[anonimitzat]', email = '[anonimitzat]', phone = '[anonimitzat]',
         notes = null, ip_hash = null, anonymized_at = now()
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

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.experiences      enable row level security;
alter table public.slot_types       enable row level security;
alter table public.slots            enable row level security;
alter table public.staff            enable row level security;
alter table public.bookings         enable row level security;
alter table public.booking_notes    enable row level security;
alter table public.audit_log        enable row level security;
alter table public.app_settings     enable row level security;
alter table public.booking_attempts enable row level security;

create policy experiences_staff_read on public.experiences for select to authenticated using (public.is_staff());
create policy experiences_admin_write on public.experiences for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy slot_types_staff_read on public.slot_types for select to authenticated using (public.is_staff());
create policy slot_types_admin_write on public.slot_types for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy slots_staff_read on public.slots for select to authenticated using (public.is_staff());
create policy staff_self_read on public.staff for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy staff_admin_write on public.staff for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy bookings_staff_read on public.bookings for select to authenticated using (public.is_staff());
create policy notes_staff_read on public.booking_notes for select to authenticated using (public.is_staff());
create policy notes_staff_insert on public.booking_notes for insert to authenticated
  with check (public.is_staff() and author_id = auth.uid());
create policy audit_staff_read on public.audit_log for select to authenticated using (public.is_staff());
create policy settings_staff_read on public.app_settings for select to authenticated using (public.is_staff());
create policy settings_admin_write on public.app_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- booking_attempts: cap política => només service_role

-- ---------------------------------------------------------------------
-- Permisos d'execució
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
grant execute on function public.public_availability(text, date, date) to anon, authenticated;
grant execute on function public.public_experience(text) to anon, authenticated;
grant execute on function public.is_staff(), public.is_admin(), public.madrid_today() to authenticated;
grant execute on function public.admin_set_day_enabled(uuid, date, boolean),
                          public.admin_enable_range(uuid, date, date, int[]),
                          public.admin_set_slot_open(uuid, boolean),
                          public.admin_set_day_open(uuid, date, boolean),
                          public.admin_update_booking(uuid, public.commercial_status, boolean),
                          public.admin_release_slot(uuid),
                          public.admin_mark_contacted(uuid, boolean),
                          public.purge_personal_data() to authenticated;
revoke execute on function public.create_prebooking(text, date, text, text, text, text, text, int, text, boolean, text, text, text)
  from authenticated;
grant execute on function public.create_prebooking(text, date, text, text, text, text, text, int, text, boolean, text, text, text)
  to service_role;
grant execute on function public.purge_personal_data() to service_role;

-- ---------------------------------------------------------------------
-- Dades inicials: CONNECT Christmas Experience
-- ---------------------------------------------------------------------
with e as (
  insert into public.experiences (slug, name, duration_minutes)
  values ('connect-christmas-2026', 'CONNECT Christmas Experience', 210)
  returning id
)
insert into public.slot_types (experience_id, key, label, start_time, end_time, sort)
select id, 'mati',  'Christmas Morning Experience',   '10:00'::time, '13:30'::time, 1 from e
union all
select id, 'tarda', 'Christmas Afternoon Experience', '16:00'::time, '19:30'::time, 2 from e;

insert into public.app_settings (key, value) values
  ('notification_emails', '[]'::jsonb),
  ('retention_months',    '24'::jsonb),
  ('privacy_version',     '"2026-10-v1"'::jsonb);
