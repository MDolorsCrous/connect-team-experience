# CONNECT Team Experience · web comercial d'IMPAUSA

Landing estàtica (React + TypeScript + Tailwind, Vite) basada en el catàleg final de
CONNECT TEAM EXPERIENCE. No hi ha reserves en línia ni base de dades: el formulari
«Parlem?» l'envia **Netlify Forms**, que el reenvia per correu a **hola@impausa.com** i en
guarda el llistat. L'equip d'administració gestiona les sol·licituds i fa les reserves.

```bash
npm install
npm run dev     # http://localhost:5173 — en local el formulari es valida però no envia res
npm test        # validació del formulari i plantilla de Netlify Forms
npm run build
npm run pdf     # PDF navegable (amb npm run dev en marxa)
node tests/e2e-public.mjs http://localhost:5173/   # recorregut complet amb Chrome headless
node tests/responsive.mjs http://localhost:5173/   # 7 amplades, de 320 a 1920 px
```

Publicació i configuració del correu: **[docs/OPERACIONS.md](docs/OPERACIONS.md)**.

La versió anterior amb calendari, prereserves, panell i Supabase és a l'etiqueta git
`motor-reserves-supabase`.
