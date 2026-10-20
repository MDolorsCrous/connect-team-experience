import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateLead, internalLeadEmail } from '../shared/lead.ts';

const base = {
  company: 'Acme SL',
  contactName: 'Anna Puig',
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
    assert.equal(r.data.participants, 18);
    assert.equal(r.data.preferredDates, null);
    assert.equal(r.data.marketing, false);
  }
});

test('camps obligatoris i opcionals', () => {
  const r = validateLead({}, 10_000);
  assert.ok(!r.ok);
  if (!r.ok) {
    for (const k of ['company', 'contactName', 'email', 'phone', 'location', 'participants', 'privacy']) assert.ok(r.errors[k as 'company'], k);
    assert.equal(r.errors.preferredDates, undefined);
    assert.equal(r.errors.notes, undefined);
  }
});

test('formats i límits', () => {
  const r = validateLead({ ...base, email: 'x', phone: '12', participants: '0', preferredDates: 'x'.repeat(201) }, 10_000);
  assert.ok(!r.ok);
  if (!r.ok) {
    assert.equal(r.errors.email, 'invalid_email');
    assert.equal(r.errors.phone, 'invalid_phone');
    assert.equal(r.errors.participants, 'invalid_number');
    assert.equal(r.errors.preferredDates, 'too_long');
  }
});

test('antiabús', () => {
  assert.ok(!validateLead({ ...base, website: 'spam' }, 10_000).ok);
  const fast = validateLead({ ...base, startedAt: 9_000 }, 10_000);
  assert.ok(!fast.ok && fast.spam);
});

test('correu a hola@impausa.com: totes les dades, escapades', () => {
  const r = validateLead({ ...base, company: 'Acme <b>SL</b>', preferredDates: 'Març, matins', notes: 'Línia 1\nLínia 2', marketing: true }, 10_000);
  assert.ok(r.ok);
  if (!r.ok) return;
  const e = internalLeadEmail({ ...r.data, ref: 'CTE-ABCD1234', experienceName: 'CONNECT Team Experience', createdAt: '2026-10-20T10:00:00Z' }, 'https://exemple.netlify.app');
  assert.ok(e.subject.startsWith('Nova sol·licitud d’informació — CONNECT Team Experience'));
  for (const s of ['anna@acme.cat', '+34 600 11 22 33', 'Sant Quirze de Besora', '18', 'Març, matins', 'Línia 1', 'CTE-ABCD1234']) assert.ok(e.text.includes(s), s);
  assert.ok(e.html.includes('Acme &lt;b&gt;SL&lt;/b&gt;') && !e.html.includes('<b>SL</b>'));
  assert.ok(e.html.includes('https://exemple.netlify.app/admin?lead=CTE-ABCD1234'));
  assert.ok(!/reserv|celebr|jug|àpat|dinar|sopar/i.test(e.text), 'sense vocabulari descartat');
});
