# Operacions: posada en marxa, publicació i manteniment

## 1. Supabase

1. Projecte **dedicat** (recomanat) a la regió UE. No barrejar amb `Impausa_Start`, que té dades
   d'usuaris d'un altre producte.
2. SQL Editor → executar `supabase/migrations/20261015000000_motor_reserves.sql`.
3. Authentication → Providers: deixar només Email. Desactivar **"Allow new users to sign up"**
   (els comptes de l'equip es creen per invitació).
4. Authentication → URL Configuration: Site URL = URL pública; afegir `<url>/admin` a Redirect URLs.
5. Primer administrador: Authentication → Users → *Invite user*. Després, al SQL Editor:

   ```sql
   insert into public.staff (user_id, email, role)
   select id, email, 'admin' from auth.users where email = 'persona@impausa.com';
   ```
   Per a perfils comercials, el mateix amb `'comercial'`.

6. Habilitar dates: des del panell (Calendari → «Habilita els dies laborables del mes») o:

   ```sql
   -- tots els dies laborables de novembre i desembre de 2026 (executat com a admin des del panell
   -- o, al SQL Editor, inserint directament):
   insert into public.slots (experience_id, slot_type_id, day)
   select e.id, t.id, d::date
   from public.experiences e join public.slot_types t on t.experience_id = e.id,
        generate_series('2026-11-02'::date, '2026-12-23'::date, interval '1 day') d
   where e.slug = 'connect-christmas-2026' and extract(isodow from d) between 1 and 5
  and d::date not in ('2026-12-07', '2026-12-08')  -- pont i festiu de la Puríssima
   on conflict do nothing;
   ```

## 2. Correu (Resend)

1. Compte a resend.com (pla gratuït: 3.000 correus/mes, 100/dia).
2. Domains → afegir `impausa.com` (o un subdomini, p. ex. `reserves.impausa.com`) i crear els
   registres DNS (SPF/DKIM) que indica. Sense això, els correus no surten o van a correu brossa.
3. API Keys → crear una clau només d'enviament.
4. Adreces internes que reben les notificacions: **panell → Configuració** (no al codi).

## 3. Netlify

1. Repositori a GitHub (privat) i *Import project* a Netlify. La configuració ja és a `netlify.toml`.
2. Variables d'entorn (Site settings → Environment variables), vegeu `.env.example`:

   | Variable | On s'usa | Secreta |
   |---|---|---|
   | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | navegador | no (protegida per RLS) |
   | `VITE_EXPERIENCE_SLUG` | navegador | no |
   | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | funcions | **sí** |
   | `IP_HASH_SALT` | funcions | **sí** (cadena aleatòria llarga) |
   | `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM` | funcions | **sí** la clau |
   | `ALLOWED_ORIGINS`, `PUBLIC_SITE_URL` | funcions | no |

3. Domini: si es fa servir un altre domini que `connect-christmas.impausa.com`, canviar-lo a
   `index.html` (canonical i Open Graph) i a `ALLOWED_ORIGINS`/`PUBLIC_SITE_URL`.
4. La funció `purge-personal-data` s'executa sola cada dia (Scheduled Functions).

## 4. Verificació abans d'obrir al públic

```bash
npm test
node tests/e2e-public.mjs https://<url-de-preview>/
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... node tests/db-integrity.mjs
```

`db-integrity` crea una experiència temporal `qa-…`, prova concurrència (12 peticions simultànies
→ 1 sola acceptada), independència matí/tarda, dates passades, RLS anònim, límit per IP i
auditoria, i ho esborra tot.

A mà: una prereserva real des del mòbil amb una adreça pròpia → comprovar els dos correus,
que la franja surt «Pendent de disponibilitat», i gestionar-la al panell (confirmar, alliberar).

## 5. Operativa diària al panell (`/admin`)

- **Sol·licituds**: canviar l'estat comercial, marcar contacte, afegir notes, alliberar la franja.
  En marcar *cancel·lada* o *no convertida*, la casella «Allibera la franja» la torna a obrir.
- **Calendari**: habilitar/deshabilitar dies, bloquejar/obrir dies o franges. Les franges amb una
  sol·licitud activa no es poden tancar ni deshabilitar fins que se n'allibera la sol·licitud.
- **Resum**: KPIs i exportació CSV (des de Sol·licituds, amb els filtres aplicats).
- **Configuració** (només admin): adreces de notificació i mesos de retenció.

## 6. Nova experiència amb el mateix motor (workshops, team buildings…)

El calendari, el formulari, els correus i el panell són genèrics: llegeixen de la base de dades
les franges, la durada i el màxim de participants. Per donar d'alta un workshop nou:

```sql
with e as (insert into public.experiences (slug, name, duration_minutes, max_participants)
           values ('workshop-lideratge', 'Workshop de lideratge', 240, 20) returning id)
insert into public.slot_types (experience_id, key, label, start_time, end_time, sort)
select id, 'mati', 'Sessió de matí', '09:00'::time, '13:00'::time, 1 from e;
```

1. Al panell, tria l'experiència al selector i habilita'n les dates a **Calendari**.
2. Comparteix l'enllaç **`/reserva/workshop-lideratge`**: pàgina de prereserva llesta, sense tocar codi.
3. Només si vols una landing pròpia (com la de CONNECT Christmas): textos a `src/i18n/` i
   `VITE_EXPERIENCE_SLUG` del desplegament.

`max_participants` buit = sense límit. CONNECT Christmas té 50, com diu el catàleg.
