// Sol·licitud d'informació («Parlem?»): validació del formulari i conversió als camps
// que rep Netlify Forms, que envia cada sol·licitud a hola@impausa.com.

export type LeadInput = {
  company: string;
  contactName: string;
  jobTitle: string;
  email: string;
  phone: string;
  location: string;
  participants: number | string;
  preferredDates?: string;
  notes?: string;
  privacy: boolean;
  marketing?: boolean;
  website?: string; // honeypot: ha d'arribar buit
  startedAt?: number; // ms en què es va mostrar el formulari
};

export type LeadData = {
  company: string;
  contactName: string;
  jobTitle: string;
  email: string;
  phone: string;
  location: string;
  participants: number;
  preferredDates: string | null;
  notes: string | null;
  marketing: boolean;
};

export type LeadFieldError = 'required' | 'too_long' | 'invalid_email' | 'invalid_phone' | 'invalid_number' | 'privacy_required';

export type LeadValidation =
  | { ok: true; data: LeadData }
  | { ok: false; errors: Partial<Record<keyof LeadInput, LeadFieldError>>; spam?: boolean };

export const LEAD_LIMITS = {
  company: 160,
  contactName: 160,
  jobTitle: 120,
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

  const text = (k: 'company' | 'contactName' | 'jobTitle' | 'location', min = 2) => {
    const v = clean(input[k]);
    if (v.length < min) errors[k] = 'required';
    else if (v.length > LEAD_LIMITS[k]) errors[k] = 'too_long';
    return v;
  };
  const company = text('company');
  const contactName = text('contactName', 3);
  const jobTitle = text('jobTitle');
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
      jobTitle,
      email,
      phone,
      location,
      participants,
      preferredDates: preferredDates || null,
      notes: notes || null,
      marketing: input.marketing === true,
    },
  };
}

/** Nom del formulari a Netlify i noms dels camps tal com arriben al correu de hola@impausa.com. */
export const NETLIFY_FORM = 'parlem';
export const NETLIFY_FIELDS = [
  'subject',
  'empresa',
  'persona_contacte',
  'carrec',
  'correu',
  'telefon',
  'municipi',
  'participants',
  'data_preferent',
  'observacions',
  'comunicacions_comercials',
  'politica_privacitat',
] as const;

export function toNetlifyFields(d: LeadData): Record<(typeof NETLIFY_FIELDS)[number], string> {
  return {
    // Netlify fa servir el camp «subject» com a assumpte del correu de notificació
    subject: `Nova sol·licitud d’informació — CONNECT Team Experience · ${d.company}`,
    empresa: d.company,
    persona_contacte: d.contactName,
    carrec: d.jobTitle,
    correu: d.email,
    telefon: d.phone,
    municipi: d.location,
    participants: String(d.participants),
    data_preferent: d.preferredDates ?? '',
    observacions: d.notes ?? '',
    comunicacions_comercials: d.marketing ? 'Sí' : 'No',
    politica_privacitat: 'Acceptada',
  };
}
