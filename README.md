# Motor de reserves d'experiències IMPAUSA

Primera experiència: **CONNECT Christmas Experience** (Nadal 2026). Web comercial pública
amb calendari de dues franges, prereserva gratuïta, correus automàtics i panell privat.

| Peça | Tecnologia |
|---|---|
| Web pública i panell | React 18 + TypeScript + Tailwind (Vite) |
| Base de dades i accés de l'equip | Supabase (Postgres + Auth + RLS) |
| Servidor (validació, correus, tasca diària) | Netlify Functions |
| Correu transaccional | Resend (canviable a `netlify/lib/mailer.ts`) |

## Com funciona

```
Visitant ──► public_availability()  (RPC: només dia, franja i estat; cap empresa)
         └─► POST /api/prereserva ──► valida ──► create_prebooking()  (bloqueja la fila,
                (Netlify Function)                  índex únic: 1 sol·licitud activa per franja)
                                     └─► correu al client + notificació interna

Equip ──► /admin (Supabase Auth) ──► RLS + RPC admin_* (comproven rol, deixen rastre a audit_log)
```

- **Disponibilitat** (`slots.status`: disponible · pendent · confirmada · bloquejada) i
  **estat comercial** (`bookings.commercial_status`: nova · contacte pendent · en negociació ·
  confirmada · cancel·lada · no convertida) són camps separats.
- Una prereserva deixa la franja **pendent** i en bloqueja d'altres fins que l'equip la
  confirma o l'allibera. Al públic es mostra «Pendent de disponibilitat».
- Reutilitzable: una experiència nova és una fila a `experiences` + les seves `slot_types`.

## Desenvolupament

```bash
npm install
npm run dev          # http://localhost:5173 — sense .env funciona en mode demostració
npm test             # proves unitàries (validació, correus, dates)
npm run build
node tests/e2e-public.mjs http://localhost:5173/   # recorregut complet amb Chrome headless
```

Posada en marxa, variables d'entorn i operativa: **[docs/OPERACIONS.md](docs/OPERACIONS.md)**.
