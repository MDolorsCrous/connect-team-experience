# Operacions

## Publicar a Netlify

1. Pujar el repositori a GitHub (privat) i, a Netlify, *Add new site → Import an existing project*.
   La configuració de compilació ja és a `netlify.toml` (`npm run build`, carpeta `dist`).
2. Netlify detecta sol el formulari **parlem** (la plantilla oculta és a `index.html`).
   Comprovar-ho a **Site configuration → Forms**: ha d'aparèixer «parlem».
3. **Correu a hola@impausa.com**: *Site configuration → Forms → Form notifications →
   Add notification → Email notification*, formulari «parlem», adreça `hola@impausa.com`.
   L'assumpte de cada correu ja arriba com «Nova sol·licitud d'informació — CONNECT Team
   Experience · <empresa>».
4. Fer una sol·licitud de prova des del web publicat i comprovar que arriba el correu.

No cal cap variable d'entorn ni cap clau.

## Gestionar les sol·licituds

- Cada sol·licitud arriba per correu a hola@impausa.com amb totes les dades: empresa,
  persona de contacte, càrrec, correu, telèfon, municipi, participants, data preferent,
  observacions i consentiment comercial.
- Totes queden també a Netlify: **Forms → parlem** (es poden descarregar en CSV).
- Netlify filtra el correu brossa; els enviaments sospitosos queden a «Spam submissions».
- Pla gratuït de Netlify: 100 enviaments de formulari al mes.

## Si canvieu els camps del formulari

Cal que coincideixin a tres llocs: `shared/lead.ts` (`NETLIFY_FIELDS`), la plantilla oculta
d'`index.html` i `src/components/ContactForm.tsx`. `npm test` comprova que la plantilla
declara tots els camps (si no, Netlify els descartaria sense avisar).
