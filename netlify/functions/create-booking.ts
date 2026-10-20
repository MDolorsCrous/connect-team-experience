// POST /api/prereserva
// Valida al servidor, crea la prereserva de forma atòmica a Supabase i
// envia el correu de confirmació i la notificació interna.

import { createHash } from 'node:crypto';
import { validateBooking } from '../../shared/validation.ts';
import { customerConfirmationEmail, internalNotificationEmail, type BookingSummary } from '../../shared/emails.ts';
import { sendEmail } from '../lib/mailer.ts';
import { CONTACT, supabaseAdmin } from '../lib/supabase-admin.ts';

type Context = { ip?: string };

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

const KNOWN_ERRORS = ['SLOT_NOT_FOUND', 'SLOT_PAST', 'SLOT_UNAVAILABLE', 'RATE_LIMITED', 'PARTICIPANTS_MAX'] as const;

function allowedOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true; // peticions del mateix origen sense capçalera
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

  const v = validateBooking((payload ?? {}) as Record<string, unknown>);
  if (!v.ok) {
    // Al robot li responem com si res; no es desa res
    if (v.spam) return json(400, { error: 'VALIDATION', fields: {} });
    return json(422, { error: 'VALIDATION', fields: v.errors });
  }
  const d = v.data;

  const salt = process.env.IP_HASH_SALT || '';
  const ip = context.ip || req.headers.get('x-nf-client-connection-ip') || '';
  const ipHash = ip && salt ? createHash('sha256').update(salt + ip).digest('hex').slice(0, 32) : null;

  const db = supabaseAdmin();
  const { data: settingsRows } = await db.from('app_settings').select('key, value');
  const settings = Object.fromEntries((settingsRows ?? []).map((r) => [r.key, r.value]));

  const { data, error } = await db.rpc('create_prebooking', {
    p_slug: d.slug,
    p_day: d.day,
    p_slot_key: d.slotKey,
    p_company: d.company,
    p_contact_name: d.contactName,
    p_email: d.email,
    p_phone: d.phone,
    p_location: d.location,
    p_participants: d.participants,
    p_notes: d.notes,
    p_marketing: d.marketing,
    p_privacy_version: String(settings.privacy_version ?? 'unknown'),
    p_locale: d.locale,
    p_ip_hash: ipHash,
  });

  if (error) {
    const code = KNOWN_ERRORS.find((k) => error.message?.includes(k));
    if (code === 'PARTICIPANTS_MAX') return json(422, { error: 'VALIDATION', fields: { participants: 'participants_max' } });
    if (code) return json(code === 'RATE_LIMITED' ? 429 : 409, { error: code });
    console.error('[create-booking] rpc error', error.code, error.message);
    return json(500, { error: 'SERVER_ERROR' });
  }

  const r = data as {
    id: string;
    ref: string;
    day: string;
    slot_key: string;
    slot_label: string;
    start_time: string;
    end_time: string;
    duration_minutes: number;
  };

  const { data: exp } = await db.from('experiences').select('name').eq('slug', d.slug).single();
  const summary: BookingSummary = {
    ref: r.ref,
    experienceName: exp?.name ?? 'Experiència IMPAUSA',
    day: r.day,
    slotLabel: r.slot_label,
    startTime: r.start_time,
    endTime: r.end_time,
    durationMinutes: r.duration_minutes,
    company: d.company,
    contactName: d.contactName,
    email: d.email,
    phone: d.phone,
    location: d.location,
    participants: d.participants,
    notes: d.notes,
    marketing: d.marketing,
    createdAt: new Date().toISOString(),
  };

  // Correus en paral·lel. Si fallen, la prereserva ja és desada: ho registrem.
  const internalTo: string[] = Array.isArray(settings.notification_emails) ? settings.notification_emails : [];
  const siteUrl = process.env.PUBLIC_SITE_URL || process.env.URL || '';
  const [customer, internal] = await Promise.all([
    sendEmail([d.email], customerConfirmationEmail(summary, CONTACT), CONTACT.email),
    sendEmail(internalTo, internalNotificationEmail(summary, siteUrl), d.email),
  ]);
  if (!customer.ok) console.error('[create-booking] confirmation email failed', r.ref, customer.error);
  if (!internal.ok) console.error('[create-booking] internal email failed', r.ref, internal.error);

  const stamp = new Date().toISOString();
  await db
    .from('bookings')
    .update({
      ...(customer.ok ? { confirmation_email_at: stamp } : {}),
      ...(internal.ok ? { internal_email_at: stamp } : {}),
    })
    .eq('id', r.id);

  return json(201, {
    ref: r.ref,
    day: r.day,
    slotKey: r.slot_key,
    slotLabel: r.slot_label,
    startTime: r.start_time,
    endTime: r.end_time,
    durationMinutes: r.duration_minutes,
    emailSent: customer.ok,
  });
};

export const config = { path: '/api/prereserva' };
