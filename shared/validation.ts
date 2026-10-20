// Validació compartida: la fa servir el formulari (per guiar l'usuari)
// i la Netlify Function (que és la que mana). Sense dependències.

export type BookingInput = {
  slug: string;
  day: string; // YYYY-MM-DD
  slotKey: string;
  company: string;
  contactName: string;
  email: string;
  phone: string;
  location: string;
  participants: number | string;
  notes?: string;
  privacy: boolean;
  marketing?: boolean;
  locale?: string;
  website?: string; // honeypot: ha d'arribar buit
  startedAt?: number; // ms epoch en què es va mostrar el formulari
};

export type BookingData = {
  slug: string;
  day: string;
  slotKey: string;
  company: string;
  contactName: string;
  email: string;
  phone: string;
  location: string;
  participants: number;
  notes: string | null;
  marketing: boolean;
  locale: 'ca' | 'es';
};

export type FieldError =
  | 'required'
  | 'too_long'
  | 'invalid_email'
  | 'invalid_phone'
  | 'invalid_number'
  | 'participants_max'
  | 'privacy_required'
  | 'invalid';

export type ValidationResult =
  | { ok: true; data: BookingData }
  | { ok: false; errors: Partial<Record<keyof BookingInput, FieldError>>; spam?: boolean };

export const LIMITS = {
  company: 160,
  contactName: 160,
  email: 254,
  phone: 40,
  location: 120,
  notes: 2000,
  participantsMin: 1,
  participantsMax: 1000,
  minFillMs: 2500,
} as const;

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i;
// Dígits, espais, +, guions, punts i parèntesis; entre 9 i 15 dígits
const PHONE_CHARS_RE = /^[+()\d\s.-]+$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const KEY_RE = /^[a-z0-9_-]{2,60}$/;

const clean = (v: unknown) =>
  typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim() : '';

/** maxParticipants: límit de l'experiència (el servidor el torna a comprovar a la base de dades). */
export function validateBooking(
  input: Partial<BookingInput>,
  now = Date.now(),
  opts: { maxParticipants?: number | null } = {},
): ValidationResult {
  const errors: Partial<Record<keyof BookingInput, FieldError>> = {};

  // Antiabús silenciós: el robot no ha de saber per què falla
  const spam =
    clean(input.website) !== '' ||
    (typeof input.startedAt === 'number' && now - input.startedAt < LIMITS.minFillMs);

  const slug = clean(input.slug);
  const day = clean(input.day);
  const slotKey = clean(input.slotKey);
  if (!KEY_RE.test(slug)) errors.slug = 'invalid';
  if (!DAY_RE.test(day) || Number.isNaN(Date.parse(day + 'T00:00:00Z'))) errors.day = 'invalid';
  if (!KEY_RE.test(slotKey)) errors.slotKey = 'invalid';

  const text = (k: 'company' | 'contactName' | 'location', min = 2) => {
    const v = clean(input[k]);
    if (v.length < min) errors[k] = 'required';
    else if (v.length > LIMITS[k]) errors[k] = 'too_long';
    return v;
  };
  const company = text('company');
  const contactName = text('contactName', 3);
  const location = text('location');

  const email = clean(input.email).toLowerCase();
  if (!email) errors.email = 'required';
  else if (email.length > LIMITS.email || !EMAIL_RE.test(email)) errors.email = 'invalid_email';

  const phone = clean(input.phone);
  const digits = phone.replace(/\D/g, '');
  if (!phone) errors.phone = 'required';
  else if (phone.length > LIMITS.phone || !PHONE_CHARS_RE.test(phone) || digits.length < 9 || digits.length > 15)
    errors.phone = 'invalid_phone';

  const rawP = typeof input.participants === 'string' ? input.participants.trim() : input.participants;
  const participants = typeof rawP === 'number' ? rawP : rawP === '' || rawP == null ? NaN : Number(rawP);
  if (rawP === '' || rawP == null) errors.participants = 'required';
  else if (
    !Number.isInteger(participants) ||
    participants < LIMITS.participantsMin ||
    participants > LIMITS.participantsMax
  )
    errors.participants = 'invalid_number';
  else if (opts.maxParticipants && participants > opts.maxParticipants) errors.participants = 'participants_max';

  const notes = clean(input.notes);
  if (notes.length > LIMITS.notes) errors.notes = 'too_long';

  if (input.privacy !== true) errors.privacy = 'privacy_required';

  if (Object.keys(errors).length > 0 || spam) return { ok: false, errors, spam };

  return {
    ok: true,
    data: {
      slug,
      day,
      slotKey,
      company,
      contactName,
      email,
      phone,
      location,
      participants,
      notes: notes || null,
      marketing: input.marketing === true,
      locale: input.locale === 'es' ? 'es' : 'ca',
    },
  };
}
