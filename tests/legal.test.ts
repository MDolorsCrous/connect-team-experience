import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const llegir = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const legal = llegir('src/lib/legal.ts');
const landing = llegir('src/pages/Landing.tsx');
const form = llegir('src/components/ContactForm.tsx');
const main = llegir('src/main.tsx');

test('l’entorn legal apunta a impausa.com i s’obre a la mateixa pestanya (no es perd: hi ha tornada)', () => {
  assert.ok(legal.includes("LEGAL_URL = 'https://www.impausa.com/entorn_legal_impausa.html'"));
  assert.ok(landing.includes('href={LEGAL_URL} target="_self"'), 'peu');
  assert.ok(form.includes('href={LEGAL_URL} target="_self"'), 'enllaç del formulari');
  assert.ok(!/_blank/.test(landing + form), 'cap enllaç en pestanya nova');
  assert.ok(!/\/privacitat/.test(landing + form), 'ja no hi ha pàgina de privacitat pròpia');
});

test('en sortir s’apunta on s’era (sessionStorage) i en tornar es recupera', () => {
  assert.ok(legal.includes('sessionStorage.setItem(VUELTA'));
  assert.ok(!legal.includes('localStorage.setItem(VUELTA'));
  assert.ok(legal.includes("'back_forward'"));
  assert.ok(legal.includes("searchParams.set('return'"));
  assert.ok(legal.includes("searchParams.set('vuelta', '1')"));
  assert.ok(legal.includes("params.get('vuelta') === '1'"));
  assert.ok(legal.includes('window.history.replaceState'));
  assert.ok(!/addEventListener\(['"](unload|beforeunload)/.test(legal + landing + form + main), 'sense unload');
  assert.ok(main.includes('instalarTornada()'), 's’instal·la abans de pintar');
  assert.ok(form.includes('formulariRecuperat()') && form.includes('data-form="parlem"'));
});
