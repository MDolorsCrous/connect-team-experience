// POST /api/contacte
// Formulari «Parlem?»: valida al servidor, desa la sol·licitud a Supabase i envia
// automàticament totes les dades a les adreces de notificació (hola@impausa.com).

import { createHash } from 'node:crypto';
import { validateLead, internalLeadEmail } from '../../shared/lead.ts';
import { sendEmail } from '../lib/mailer.ts';
import { supabaseAdmin } from '../lib/supabase-admin.ts';

type Context = { ip?: string };

const EXPERIENCE_NAME = 'CONNECT Team Experience';
const FALLBACK_RECIPIENT = 'hola@impausa.com';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

function allowedOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  const allowed = (process.env.ALLOWED_ORIGINS || process.env.URL || '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
  if (allowed.length === 0) return true;
  return allowed.includes(origin.replace(/\/$/, '')) || /^https:\/\/[a-z0-9-]+--[a-z0-9-]+\.netlify\.app$/.test(origin);
}

export default async (req: Request, context: Context) => {
  if (req.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' });
  if (!allowedOrigin(req)) return json(403, { error: 'FORBIDDEN' });
  if (Number(req.headers.get('content-length') || 0) > 16_000) return json(413, { error: 'TOO_LARGE' });

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: 'INVALID_JSON' });
  }

  const v = validateLead((payload ?? {}) as Record<string, unknown>);
  if (!v.ok) {
    if (v.spam) return json(400, { error: 'VALIDATION', fields: {} });
    return json(422, { error: 'VALIDATION', fields: v.errors });
  }
  const d = v.data;

  let db;
  try {
    db = supabaseAdmin();
  } catch {
    console.error('[create-lead] falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
    return json(503, { error: 'NOT_CONFIGURED' });
  }

  const salt = process.env.IP_HASH_SALT || '';
  const ip = context.ip || req.headers.get('x-nf-client-connection-ip') || '';
  const ipHash = ip && salt ? createHash('sha256').update(salt + ip).digest('hex').slice(0, 32) : null;

  const { data: settingsRows } = await db.from('app_settings').select('key, value');
  const settings = Object.fromEntries((settingsRows ?? []).map((r) => [r.key, r.value]));

  const { data, error } = await db.rpc('create_lead', {
    p_company: d.company,
    p_contact_name: d.contactName,
    p_email: d.email,
    p_phone: d.phone,
    p_location: d.location,
    p_participants: d.participants,
    p_preferred_dates: d.preferredDates,
    p_notes: d.notes,
    p_marketing: d.marketing,
    p_privacy_version: String(settings.privacy_version ?? 'unknown'),
    p_locale: d.locale,
    p_ip_hash: ipHash,
  });
  if (error) {
    if (error.message?.includes('RATE_LIMITED')) return json(429, { error: 'RATE_LIMITED' });
    console.error('[create-lead] rpc error', error.code, error.message);
    return json(500, { error: 'SERVER_ERROR' });
  }
  const r = data as { id: string; ref: string };

  const configured: string[] = Array.isArray(settings.notification_emails) ? settings.notification_emails : [];
  const to = configured.length ? configured : [FALLBACK_RECIPIENT];
  const email = internalLeadEmail(
    { ...d, ref: r.ref, experienceName: EXPERIENCE_NAME, createdAt: new Date().toISOString() },
    process.env.PUBLIC_SITE_URL || process.env.URL || '',
  );
  // Reply-To = la persona interessada: n'hi ha prou de prémer «Respon» per contactar-hi
  const sent = await sendEmail(to, email, d.email);
  if (sent.ok) await db.from('leads').update({ internal_email_at: new Date().toISOString() }).eq('id', r.id);
  else console.error('[create-lead] email failed', r.ref, sent.error);

  return json(201, { ref: r.ref });
};

export const config = { path: '/api/contacte' };
