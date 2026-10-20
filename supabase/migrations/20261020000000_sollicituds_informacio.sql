-- Sol·licituds d'informació ("Parlem?") de CONNECT TEAM EXPERIENCE.
-- No hi ha reserva ni calendari: l'empresa interessada omple el formulari, les dades es
-- desen aquí i s'envien automàticament a les adreces de notificació (hola@impausa.com).

create type public.lead_status as enum ('nova', 'contactada', 'en_negociacio', 'guanyada', 'perduda');

create table public.leads (
  id                  uuid primary key default gen_random_uuid(),
  ref                 text not null unique,
  experience          text not null default 'connect-team-experience' check (experience ~ '^[a-z0-9-]{3,60}$'),
  company             text not null check (char_length(company) between 2 and 160),
  contact_name        text not null check (char_length(contact_name) between 1 and 160),
  email               text not null check (char_length(email) <= 254),
  phone               text not null check (char_length(phone) <= 40),
  location            text check (char_length(location) <= 120),
  participants        int  not null check (participants between 1 and 1000),
  preferred_dates     text check (char_length(preferred_dates) <= 200),
  notes               text check (char_length(notes) <= 2000),
  locale              text not null default 'ca',
  privacy_accepted_at timestamptz not null,
  privacy_version     text not null,
  marketing_consent   boolean not null default false,
  status              public.lead_status not null default 'nova',
  ip_hash             text,
  internal_email_at   timestamptz,
  anonymized_at       timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index leads_created on public.leads (created_at desc);
create index leads_ip_recent on public.leads (ip_hash, created_at);

create table public.lead_notes (
  id           uuid primary key default gen_random_uuid(),
  lead_id      uuid not null references public.leads(id) on delete cascade,
  author_id    uuid default auth.uid(),
  author_email text,
  body         text not null check (char_length(body) between 1 and 4000),
  created_at   timestamptz not null default now()
);
create index lead_notes_lead on public.lead_notes (lead_id, created_at);

create trigger leads_touch before update on public.leads
  for each row execute function public.touch_updated_at();

-- Rastre de canvis d'estat (sense dades personals)
create or replace function public.audit_lead_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status
     and old.anonymized_at is not distinct from new.anonymized_at then
    return new;
  end if;
  insert into public.audit_log (actor_id, actor_email, entity, entity_id, action, before, after)
  values (auth.uid(), nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email', 'leads', new.id, lower(tg_op),
          case when tg_op = 'UPDATE' then jsonb_build_object('status', old.status, 'anonymized_at', old.anonymized_at) end,
          jsonb_build_object('status', new.status, 'anonymized_at', new.anonymized_at));
  return new;
end $$;
create trigger leads_audit after insert or update on public.leads
  for each row execute function public.audit_lead_change();
revoke execute on function public.audit_lead_change() from public, anon, authenticated;

-- Alta d'una sol·licitud. Només service_role (Netlify Function), amb límit per IP.
create or replace function public.create_lead(
  p_company text, p_contact_name text, p_email text, p_phone text, p_location text,
  p_participants int, p_preferred_dates text, p_notes text, p_marketing boolean,
  p_privacy_version text, p_locale text, p_ip_hash text, p_experience text default 'connect-team-experience'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; v_ref text; v_recent int;
begin
  if p_ip_hash is not null then
    insert into public.booking_attempts (ip_hash) values (p_ip_hash);
    select count(*) into v_recent from public.booking_attempts
      where ip_hash = p_ip_hash and at > now() - interval '1 hour';
    if v_recent > 10 then raise exception 'RATE_LIMITED'; end if;
    select count(*) into v_recent from public.leads
      where ip_hash = p_ip_hash and created_at > now() - interval '1 hour';
    if v_recent >= 3 then raise exception 'RATE_LIMITED'; end if;
  end if;

  v_ref := 'CTE-' || upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 8));
  insert into public.leads (ref, experience, company, contact_name, email, phone, location, participants,
                            preferred_dates, notes, locale, privacy_accepted_at, privacy_version,
                            marketing_consent, ip_hash)
  values (v_ref, coalesce(p_experience, 'connect-team-experience'), btrim(p_company), btrim(p_contact_name),
          lower(btrim(p_email)), btrim(p_phone), nullif(btrim(coalesce(p_location, '')), ''), p_participants,
          nullif(btrim(coalesce(p_preferred_dates, '')), ''), nullif(btrim(coalesce(p_notes, '')), ''),
          coalesce(p_locale, 'ca'), now(), p_privacy_version, coalesce(p_marketing, false), p_ip_hash)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'ref', v_ref);
end $$;
revoke execute on function public.create_lead(text, text, text, text, text, int, text, text, boolean, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_lead(text, text, text, text, text, int, text, text, boolean, text, text, text, text)
  to service_role;

create or replace function public.admin_set_lead_status(p_lead uuid, p_status public.lead_status)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'FORBIDDEN'; end if;
  update public.leads set status = p_status where id = p_lead;
  if not found then raise exception 'LEAD_NOT_FOUND'; end if;
end $$;
revoke execute on function public.admin_set_lead_status(uuid, public.lead_status) from public, anon;
grant execute on function public.admin_set_lead_status(uuid, public.lead_status) to authenticated;

-- RLS: només l'equip llegeix; l'alta és via create_lead (service_role)
alter table public.leads enable row level security;
alter table public.lead_notes enable row level security;
create policy leads_staff_read on public.leads for select to authenticated using (public.is_staff());
create policy lead_notes_staff_read on public.lead_notes for select to authenticated using (public.is_staff());
create policy lead_notes_staff_insert on public.lead_notes for insert to authenticated
  with check (public.is_staff() and author_id = auth.uid());

-- Retenció: la tasca diària també anonimitza les sol·licituds tancades antigues
create or replace function public.purge_personal_data() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_months int;
  v_count  int;
  v_leads  int;
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

  update public.leads
     set contact_name = '[anonimitzat]', email = '[anonimitzat]', phone = '[anonimitzat]',
         location = null, preferred_dates = null, notes = null, ip_hash = null, anonymized_at = now()
   where anonymized_at is null
     and created_at < now() - make_interval(months => v_months)
     and status in ('guanyada', 'perduda');
  get diagnostics v_leads = row_count;

  delete from public.booking_notes n using public.bookings b
   where n.booking_id = b.id and b.anonymized_at is not null;
  delete from public.lead_notes n using public.leads l
   where n.lead_id = l.id and l.anonymized_at is not null;
  delete from public.booking_attempts where at < now() - interval '1 day';
  return v_count + v_leads;
end $$;
