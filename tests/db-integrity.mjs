// Proves d'integritat contra una base de dades Supabase REAL (de proves, mai producció).
// Ús: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... node tests/db-integrity.mjs
//
// Crea una experiència de prova pròpia ("qa-<timestamp>"), hi fa les proves i l'esborra al final.
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
  console.error('Calen SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY i SUPABASE_ANON_KEY');
  process.exit(2);
}
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });

let fails = 0;
const check = (ok, msg) => {
  console.log(`${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) fails++;
};

const slug = `qa-${Date.now()}`;
const day = new Date(Date.now() + 40 * 864e5).toISOString().slice(0, 10);
const past = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10);

const { data: exp } = await admin.from('experiences').insert({ slug, name: 'QA', duration_minutes: 210 }).select().single();
const { data: types } = await admin
  .from('slot_types')
  .insert([
    { experience_id: exp.id, key: 'mati', label: 'Matí', start_time: '10:00', end_time: '13:30', sort: 1 },
    { experience_id: exp.id, key: 'tarda', label: 'Tarda', start_time: '16:00', end_time: '19:30', sort: 2 },
  ])
  .select();
await admin.from('slots').insert([
  ...types.map((t) => ({ experience_id: exp.id, slot_type_id: t.id, day })),
  { experience_id: exp.id, slot_type_id: types[0].id, day: past },
]);

const req = (over = {}) =>
  admin.rpc('create_prebooking', {
    p_slug: slug, p_day: day, p_slot_key: 'mati', p_company: 'QA SL', p_contact_name: 'Persona QA',
    p_email: 'qa@example.com', p_phone: '600000000', p_location: 'Vic', p_participants: 20, p_notes: null, p_marketing: false,
    p_privacy_version: 'qa', p_locale: 'ca', p_ip_hash: null, ...over,
  });

try {
  // 1. Concurrència: 12 peticions simultànies a la mateixa franja → exactament 1 èxit
  const results = await Promise.all(Array.from({ length: 12 }, (_, i) => req({ p_company: `Empresa ${i}` })));
  const okN = results.filter((r) => !r.error).length;
  const dup = results.filter((r) => r.error?.message.includes('SLOT_UNAVAILABLE')).length;
  check(okN === 1 && dup === 11, `concurrència: ${okN} èxit, ${dup} rebutjades per SLOT_UNAVAILABLE`);

  // 2. Matí i tarda independents
  const tarda = await req({ p_slot_key: 'tarda' });
  check(!tarda.error, 'la tarda del mateix dia continua disponible');

  // 3. Vista pública: pendent visible, sense dades d'empresa
  const { data: pub, error: pubErr } = await anon.rpc('public_availability', { p_slug: slug, p_from: day, p_to: day });
  check(!pubErr && pub.length === 2 && pub.every((s) => s.status === 'pendent'), 'públic veu «pendent» a les dues franges');
  check(!JSON.stringify(pub).includes('Empresa') && !JSON.stringify(pub).includes('QA SL'), 'cap nom d’empresa a la resposta pública');

  // 4. Dates passades i franges inexistents
  check((await req({ p_day: past })).error?.message.includes('SLOT_PAST'), 'data passada rebutjada');
  check((await req({ p_slot_key: 'nit' })).error?.message.includes('SLOT_NOT_FOUND'), 'franja inexistent rebutjada');

  // 5. Accés anònim bloquejat
  const a1 = await anon.from('bookings').select('*');
  check((a1.data ?? []).length === 0, 'anònim no llegeix bookings (RLS)');
  const a2 = await anon.from('slots').select('*');
  check((a2.data ?? []).length === 0, 'anònim no llegeix slots directament');
  const a3 = await anon.rpc('create_prebooking', { p_slug: slug, p_day: day, p_slot_key: 'mati', p_company: 'x', p_contact_name: 'x', p_email: 'x@x.es', p_phone: '600000000', p_location: 'Vic', p_participants: 1, p_notes: null, p_marketing: false, p_privacy_version: 'x', p_locale: 'ca', p_ip_hash: null });
  check(!!a3.error, 'anònim no pot cridar create_prebooking directament');
  const a4 = await anon.rpc('admin_set_slot_open', { p_slot: '00000000-0000-0000-0000-000000000000', p_open: true });
  check(!!a4.error, 'anònim no pot cridar RPC d’administració');
  const a5 = await anon.from('app_settings').select('*');
  check((a5.data ?? []).length === 0, 'anònim no llegeix la configuració (adreces internes)');

  // 6. Antiabús per IP
  const ipRes = [];
  for (let i = 0; i < 12; i++) ipRes.push(await req({ p_ip_hash: `qa-ip-${slug}`, p_slot_key: 'mati' }));
  check(ipRes.some((r) => r.error?.message.includes('RATE_LIMITED')), 'límit d’intents per IP actiu');

  // 7. Auditoria registrada
  const { data: audit } = await admin.from('audit_log').select('id').eq('entity', 'slots').in('entity_id', (await admin.from('slots').select('id').eq('experience_id', exp.id)).data.map((s) => s.id));
  check((audit ?? []).length > 0, `auditoria de canvis de franja (${audit?.length} entrades)`);
} finally {
  // Neteja
  const { data: bs } = await admin.from('bookings').select('id').eq('experience_id', exp.id);
  const ids = (bs ?? []).map((b) => b.id);
  if (ids.length) await admin.from('bookings').delete().in('id', ids);
  await admin.from('experiences').delete().eq('id', exp.id);
  await admin.from('booking_attempts').delete().like('ip_hash', 'qa-ip-%');
  console.log('(dades de prova esborrades)');
}
console.log(fails ? `\n${fails} comprovacions han fallat` : '\nTot correcte');
process.exit(fails ? 1 : 0);
