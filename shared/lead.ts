// Sol·licitud d'informació ("Parlem?"): validació compartida (formulari + servidor) i correu intern.
import { C, esc, layout, rows, type Email } from './emails.ts';
import { formatTimestamp } from './format.ts';

export type LeadInput = {
  company: string;
  contactName: string;
  email: string;
  phone: string;
  location: string;
  participants: number | string;
  preferredDates?: string;
  notes?: string;
  privacy: boolean;
  marketing?: boolean;
  locale?: string;
  website?: string; // honeypot: ha d'arribar buit
  startedAt?: number; // ms en què es va mostrar el formulari
};

export type LeadData = {
  company: string;
  contactName: string;
  email: string;
  phone: string;
  location: string;
  participants: number;
  preferredDates: string | null;
  notes: string | null;
  marketing: boolean;
  locale: 'ca' | 'es';
};

export type LeadFieldError = 'required' | 'too_long' | 'invalid_email' | 'invalid_phone' | 'invalid_number' | 'privacy_required';

export type LeadValidation =
  | { ok: true; data: LeadData }
  | { ok: false; errors: Partial<Record<keyof LeadInput, LeadFieldError>>; spam?: boolean };

export const LEAD_LIMITS = {
  company: 160,
  contactName: 160,
  email: 254,
  phone: 40,
  location: 120,
  preferredDates: 200,
  notes: 2000,
  participantsMax: 1000,
  minFillMs: 2500,
} as const;

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i;
const PHONE_CHARS_RE = /^[+()\d\s.-]+$/;
const clean = (v: unknown) =>
  typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim() : '';

export function validateLead(input: Partial<LeadInput>, now = Date.now()): LeadValidation {
  const errors: Partial<Record<keyof LeadInput, LeadFieldError>> = {};
  const spam =
    clean(input.website) !== '' || (typeof input.startedAt === 'number' && now - input.startedAt < LEAD_LIMITS.minFillMs);

  const text = (k: 'company' | 'contactName' | 'location', min = 2) => {
    const v = clean(input[k]);
    if (v.length < min) errors[k] = 'required';
    else if (v.length > LEAD_LIMITS[k]) errors[k] = 'too_long';
    return v;
  };
  const company = text('company');
  const contactName = text('contactName', 3);
  const location = text('location');

  const email = clean(input.email).toLowerCase();
  if (!email) errors.email = 'required';
  else if (email.length > LEAD_LIMITS.email || !EMAIL_RE.test(email)) errors.email = 'invalid_email';

  const phone = clean(input.phone);
  const digits = phone.replace(/\D/g, '');
  if (!phone) errors.phone = 'required';
  else if (phone.length > LEAD_LIMITS.phone || !PHONE_CHARS_RE.test(phone) || digits.length < 9 || digits.length > 15)
    errors.phone = 'invalid_phone';

  const rawP = typeof input.participants === 'string' ? input.participants.trim() : input.participants;
  const participants = typeof rawP === 'number' ? rawP : rawP === '' || rawP == null ? NaN : Number(rawP);
  if (rawP === '' || rawP == null) errors.participants = 'required';
  else if (!Number.isInteger(participants) || participants < 1 || participants > LEAD_LIMITS.participantsMax)
    errors.participants = 'invalid_number';

  const preferredDates = clean(input.preferredDates);
  if (preferredDates.length > LEAD_LIMITS.preferredDates) errors.preferredDates = 'too_long';
  const notes = clean(input.notes);
  if (notes.length > LEAD_LIMITS.notes) errors.notes = 'too_long';

  if (input.privacy !== true) errors.privacy = 'privacy_required';

  if (Object.keys(errors).length > 0 || spam) return { ok: false, errors, spam };
  return {
    ok: true,
    data: {
      company,
      contactName,
      email,
      phone,
      location,
      participants,
      preferredDates: preferredDates || null,
      notes: notes || null,
      marketing: input.marketing === true,
      locale: input.locale === 'es' ? 'es' : 'ca',
    },
  };
}

export type LeadSummary = LeadData & { ref: string; experienceName: string; createdAt: string };

/** Correu que rep hola@impausa.com amb totes les dades del formulari. */
export function internalLeadEmail(l: LeadSummary, adminUrl: string): Email {
  const subject = `Nova sol·licitud d’informació — ${l.experienceName} · ${l.company} · ${l.ref}`;
  const pairs: [string, string][] = [
    ['Referència', l.ref],
    ['Experiència', l.experienceName],
    ['Empresa', l.company],
    ['Persona de contacte', l.contactName],
    ['Correu', l.email],
    ['Telèfon', l.phone],
    ['Municipi', l.location],
    ['Participants (aprox.)', String(l.participants)],
    ['Data o període preferent', l.preferredDates || '—'],
    ['Observacions', l.notes || '—'],
    ['Consentiment comercial', l.marketing ? 'Sí' : 'No'],
    ['Rebuda', formatTimestamp(l.createdAt) + ' (hora de Madrid)'],
  ];
  const link = adminUrl ? `${adminUrl.replace(/\/$/, '')}/admin?lead=${encodeURIComponent(l.ref)}` : '';
  const body = `
<h1 style="font-family:Montserrat,Arial,sans-serif;font-size:20px;color:${C.pine};margin:0 0 8px">Nova sol·licitud d’informació</h1>
<p style="font-size:15px;line-height:1.6;margin:0 0 20px"><strong>${esc(l.company)}</strong> vol informació sobre <strong>${esc(l.experienceName)}</strong>. Responeu aquest correu per escriure directament a ${esc(l.contactName)}.</p>
${rows(pairs)}
${link ? `<p style="margin:28px 0 0"><a href="${esc(link)}" style="display:inline-block;background:${C.ember};color:#ffffff;text-decoration:none;font-family:Montserrat,Arial,sans-serif;font-weight:700;font-size:14px;padding:12px 22px;border-radius:999px">Obre-la al panell privat</a></p>` : ''}`;
  const text = ['NOVA SOL·LICITUD D’INFORMACIÓ', '', ...pairs.map(([k, v]) => `${k}: ${v}`), '', link ? `Panell privat: ${link}` : ''].join('\n');
  return {
    subject,
    html: layout(subject, body, 'Notificació automàtica del formulari «Parlem?» del web. Conté dades personals: no la reenvieu fora de l’equip.'),
    text,
  };
}
