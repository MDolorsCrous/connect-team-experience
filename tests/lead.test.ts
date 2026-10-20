import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateLead, toNetlifyFields, NETLIFY_FIELDS, NETLIFY_FORM } from '../shared/lead.ts';

const base = {
  company: 'Acme SL',
  contactName: 'Anna Puig',
  jobTitle: 'Directora de persones',
  email: ' Anna@Acme.cat',
  phone: '+34 600 11 22 33',
  location: 'Sant Quirze de Besora',
  participants: '18',
  privacy: true,
  startedAt: 0,
};

test('sol·licitud correcta: es normalitza i els opcionals queden buits', () => {
  const r = validateLead(base, 10_000);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.data.email, 'anna@acme.cat');
    assert.equal(r.data.jobTitle, 'Directora de persones');
    assert.equal(r.data.participants, 18);
    assert.equal(r.data.preferredDates, null);
    assert.equal(r.data.marketing, false);
  }
});

test('camps obligatoris (inclòs el càrrec) i opcionals', () => {
  const r = validateLead({}, 10_000);
  assert.ok(!r.ok);
  if (!r.ok) {
    for (const k of ['company', 'contactName', 'jobTitle', 'email', 'phone', 'location', 'participants', 'privacy'])
      assert.ok(r.errors[k as 'company'], k);
    assert.equal(r.errors.preferredDates, undefined);
    assert.equal(r.errors.notes, undefined);
  }
});

test('formats i límits', () => {
  const r = validateLead({ ...base, email: 'x', phone: '12', participants: '0', jobTitle: 'x'.repeat(121) }, 10_000);
  assert.ok(!r.ok);
  if (!r.ok) {
    assert.equal(r.errors.email, 'invalid_email');
    assert.equal(r.errors.phone, 'invalid_phone');
    assert.equal(r.errors.participants, 'invalid_number');
    assert.equal(r.errors.jobTitle, 'too_long');
  }
});

test('antiabús', () => {
  assert.ok(!validateLead({ ...base, website: 'spam' }, 10_000).ok);
  const fast = validateLead({ ...base, startedAt: 9_000 }, 10_000);
  assert.ok(!fast.ok && fast.spam);
});

test('camps per a Netlify Forms: totes les dades, amb assumpte per al correu', () => {
  const r = validateLead({ ...base, preferredDates: 'Març, matins', notes: 'Línia 1\nLínia 2', marketing: true }, 10_000);
  assert.ok(r.ok);
  if (!r.ok) return;
  const f = toNetlifyFields(r.data);
  assert.deepEqual(Object.keys(f).sort(), [...NETLIFY_FIELDS].sort());
  assert.equal(f.carrec, 'Directora de persones');
  assert.equal(f.data_preferent, 'Març, matins');
  assert.equal(f.comunicacions_comercials, 'Sí');
  assert.ok(f.subject.startsWith('Nova sol·licitud d’informació — CONNECT Team Experience · Acme SL'));
});

test('la plantilla oculta d’index.html declara tots els camps (si no, Netlify els descarta)', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes(`name="${NETLIFY_FORM}"`) && html.includes('data-netlify="true"'));
  for (const n of [...NETLIFY_FIELDS, 'website']) assert.ok(html.includes(`<input name="${n}" />`), n);
});
