import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateBooking } from '../shared/validation.ts';
import { customerConfirmationEmail, internalNotificationEmail, type BookingSummary } from '../shared/emails.ts';
import { formatDayLong, formatDuration, formatTime, madridToday } from '../shared/format.ts';

const base = {
  slug: 'connect-christmas-2026',
  day: '2026-12-03',
  slotKey: 'mati',
  company: 'Acme SL',
  contactName: 'Anna Puig',
  email: 'Anna@Acme.cat ',
  phone: '+34 600 11 22 33',
  location: 'Vic',
  participants: '25',
  privacy: true,
  startedAt: 0,
};

test('una sol·licitud correcta es normalitza', () => {
  const r = validateBooking(base, 10_000);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.data.email, 'anna@acme.cat');
    assert.equal(r.data.participants, 25);
    assert.equal(r.data.marketing, false, 'el consentiment comercial no és obligatori i per defecte és fals');
    assert.equal(r.data.notes, null);
  }
});

test('camps obligatoris', () => {
  const r = validateBooking({ slug: base.slug, day: base.day, slotKey: 'mati' }, 10_000);
  assert.ok(!r.ok);
  if (!r.ok) {
    for (const k of ['company', 'contactName', 'email', 'phone', 'location', 'participants', 'privacy']) assert.ok(r.errors[k as 'company'], `falta error a ${k}`);
    assert.equal(r.errors.notes, undefined, 'les observacions són opcionals');
  }
});

test('formats invàlids', () => {
  const r = validateBooking({ ...base, email: 'no-és-correu', phone: '123', participants: '2.5', privacy: false }, 10_000);
  assert.ok(!r.ok);
  if (!r.ok) {
    assert.equal(r.errors.email, 'invalid_email');
    assert.equal(r.errors.phone, 'invalid_phone');
    assert.equal(r.errors.participants, 'invalid_number');
    assert.equal(r.errors.privacy, 'privacy_required');
  }
  const big = validateBooking({ ...base, participants: 5000 }, 10_000);
  assert.ok(!big.ok);
  const max = validateBooking({ ...base, participants: 51 }, 10_000, { maxParticipants: 50 });
  assert.ok(!max.ok && max.errors.participants === 'participants_max');
  assert.ok(validateBooking({ ...base, participants: 50 }, 10_000, { maxParticipants: 50 }).ok);
  const dia = validateBooking({ ...base, day: '03/12/2026' }, 10_000);
  assert.ok(!dia.ok);
});

test('antiabús: honeypot i enviament massa ràpid', () => {
  const hp = validateBooking({ ...base, website: 'http://spam' }, 10_000);
  assert.ok(!hp.ok && hp.spam);
  const fast = validateBooking({ ...base, startedAt: 9_000 }, 10_000);
  assert.ok(!fast.ok && fast.spam);
});

test('límits de longitud', () => {
  const r = validateBooking({ ...base, notes: 'x'.repeat(2001), company: 'y'.repeat(161) }, 10_000);
  assert.ok(!r.ok);
  if (!r.ok) {
    assert.equal(r.errors.notes, 'too_long');
    assert.equal(r.errors.company, 'too_long');
  }
});

test('format de dates i hores en català i zona Madrid', () => {
  assert.equal(formatDayLong('2026-12-03'), 'dijous, 3 de desembre del 2026');
  assert.equal(formatTime('10:00:00'), '10.00');
  assert.equal(formatDuration(210), '3 h i 30 min');
  // 23.30 UTC del 31-12 ja és 1-1 a Madrid
  assert.equal(madridToday(new Date('2026-12-31T23:30:00Z')), '2027-01-01');
});

const summary: BookingSummary = {
  ref: 'CNX-ABCD1234',
  experienceName: 'CONNECT Christmas Experience',
  day: '2026-12-03',
  slotLabel: 'Christmas Morning Experience',
  startTime: '10:00:00',
  endTime: '13:30:00',
  durationMinutes: 210,
  company: 'Acme <b>SL</b> & "cia"',
  contactName: 'Anna <img src=x onerror=alert(1)>',
  email: 'anna@acme.cat',
  phone: '600112233',
  location: 'Vic',
  participants: 25,
  notes: 'Línia 1\nLínia 2',
  marketing: false,
  createdAt: '2026-10-15T10:00:00Z',
};
const contact = { legalName: 'IMPAUSA POWER S.L.', email: 'hola@impausa.com', phone: '613 026 544', web: 'https://www.impausa.com' };

test('correu al client: textos obligatoris i escapament', () => {
  const e = customerConfirmationEmail(summary, contact);
  assert.match(e.html, /no la reserva definitiva de la data/);
  assert.match(e.text, /Aquesta comunicació confirma la recepció de la sol·licitud, no la reserva definitiva de la data\./);
  assert.ok(!e.html.includes('<img src=x'), 'cap HTML de l’usuari s’injecta');
  assert.ok(e.html.includes('Acme &lt;b&gt;SL&lt;/b&gt; &amp; &quot;cia&quot;'));
  assert.ok(!/\d+\s*(hores|dies|h)\s+(hàbils|laborables)/.test(e.text), 'no es prometen terminis');
});

test('notificació interna: assumpte, dades i enllaç al panell', () => {
  const e = internalNotificationEmail(summary, 'https://exemple.netlify.app/');
  assert.ok(e.subject.startsWith('Nova prereserva — CONNECT Christmas Experience'));
  assert.ok(e.html.includes('https://exemple.netlify.app/admin?sol=CNX-ABCD1234'));
  for (const s of ['anna@acme.cat', '600112233', 'Vic', '25', 'Christmas Morning Experience', 'Línia 1']) assert.ok(e.text.includes(s), s);
});
