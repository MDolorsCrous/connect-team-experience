// Accés a dades del panell privat. Tot passa per RLS + RPC amb comprovació de rol.
import { supabase } from '../lib/supabase';

export type CommercialStatus = 'nova' | 'contacte_pendent' | 'negociacio' | 'confirmada' | 'cancellada' | 'no_convertida';
export type SlotStatus = 'disponible' | 'pendent' | 'confirmada' | 'bloquejada';

export const COMMERCIAL_LABEL: Record<CommercialStatus, string> = {
  nova: 'Nova sol·licitud',
  contacte_pendent: 'Contacte pendent',
  negociacio: 'En negociació',
  confirmada: 'Reserva confirmada',
  cancellada: 'Cancel·lada',
  no_convertida: 'No convertida',
};
export const COMMERCIAL_ORDER = Object.keys(COMMERCIAL_LABEL) as CommercialStatus[];
export const OPEN_STATUSES: CommercialStatus[] = ['nova', 'contacte_pendent', 'negociacio'];
export const CLOSED_LOST: CommercialStatus[] = ['cancellada', 'no_convertida'];

export const SLOT_LABEL: Record<SlotStatus, string> = {
  disponible: 'Disponible',
  pendent: 'Prereserva pendent',
  confirmada: 'Reserva confirmada',
  bloquejada: 'Bloquejada',
};

export type Experience = { id: string; slug: string; name: string; duration_minutes: number; max_participants: number | null };
export type SlotType = { id: string; key: string; label: string; start_time: string; end_time: string; sort: number };
export type Slot = { id: string; day: string; status: SlotStatus; slot_type_id: string };
export type Booking = {
  id: string;
  ref: string;
  slot_id: string | null;
  day: string;
  slot_key: string;
  slot_label: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  company: string;
  contact_name: string;
  email: string;
  phone: string;
  location: string | null;
  participants: number;
  notes: string | null;
  marketing_consent: boolean;
  privacy_version: string;
  commercial_status: CommercialStatus;
  holds_slot: boolean;
  contacted_at: string | null;
  confirmation_email_at: string | null;
  internal_email_at: string | null;
  anonymized_at: string | null;
  created_at: string;
  updated_at: string;
};
export type Note = { id: string; body: string; author_email: string | null; created_at: string };
export type AuditEntry = { id: number; at: string; actor_email: string | null; action: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null };

const db = () => {
  if (!supabase) throw new Error('Supabase no està configurat (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
  return supabase;
};

/** Converteix els codis d'error de les RPC en missatges per a l'equip. */
export function humanError(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? String(e);
  const map: Record<string, string> = {
    FORBIDDEN: 'No teniu permisos per fer aquesta acció.',
    DAY_HAS_BOOKINGS: 'Aquest dia té sol·licituds actives. Allibereu-les abans de deshabilitar-lo.',
    SLOT_HAS_BOOKING: 'Aquesta franja té una sol·licitud activa. Gestioneu-la des de Sol·licituds.',
    SLOT_UNAVAILABLE: 'La franja ja no està lliure: una altra sol·licitud l’ocupa o està bloquejada.',
    SLOT_NOT_FOUND: 'La franja no existeix.',
    BOOKING_NOT_FOUND: 'La sol·licitud no existeix.',
    INVALID_RANGE: 'Rang de dates no vàlid.',
  };
  const key = Object.keys(map).find((k) => msg.includes(k));
  return key ? map[key] : msg;
}

async function ok<T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(humanError(error));
  return data;
}

export const api = {
  isStaff: () => ok(db().rpc('is_staff')) as Promise<boolean>,
  isAdmin: () => ok(db().rpc('is_admin')) as Promise<boolean>,
  experiences: () => ok(db().from('experiences').select('id, slug, name, duration_minutes, max_participants').order('created_at')) as Promise<Experience[]>,
  slotTypes: (exp: string) =>
    ok(db().from('slot_types').select('id, key, label, start_time, end_time, sort').eq('experience_id', exp).order('sort')) as Promise<SlotType[]>,
  slots: (exp: string, from: string, to: string) =>
    ok(db().from('slots').select('id, day, status, slot_type_id').eq('experience_id', exp).gte('day', from).lte('day', to)) as Promise<Slot[]>,
  bookings: (exp: string) =>
    ok(db().from('bookings').select('*').eq('experience_id', exp).order('created_at', { ascending: false })) as Promise<Booking[]>,
  notes: (booking: string) =>
    ok(db().from('booking_notes').select('id, body, author_email, created_at').eq('booking_id', booking).order('created_at')) as Promise<Note[]>,
  addNote: async (booking: string, body: string) => {
    const { data } = await db().auth.getUser();
    return ok(db().from('booking_notes').insert({ booking_id: booking, body, author_id: data.user?.id, author_email: data.user?.email }));
  },
  audit: (entity: string, id: string) =>
    ok(db().from('audit_log').select('id, at, actor_email, action, before, after').eq('entity', entity).eq('entity_id', id).order('at', { ascending: false }).limit(50)) as Promise<AuditEntry[]>,
  updateBooking: (id: string, status: CommercialStatus, release: boolean) =>
    ok(db().rpc('admin_update_booking', { p_booking: id, p_status: status, p_release: release })),
  releaseSlot: (id: string) => ok(db().rpc('admin_release_slot', { p_booking: id })),
  markContacted: (id: string, contacted: boolean) => ok(db().rpc('admin_mark_contacted', { p_booking: id, p_contacted: contacted })),
  setDayEnabled: (exp: string, day: string, enabled: boolean) =>
    ok(db().rpc('admin_set_day_enabled', { p_experience: exp, p_day: day, p_enabled: enabled })),
  setDayOpen: (exp: string, day: string, open: boolean) => ok(db().rpc('admin_set_day_open', { p_experience: exp, p_day: day, p_open: open })),
  setSlotOpen: (slot: string, open: boolean) => ok(db().rpc('admin_set_slot_open', { p_slot: slot, p_open: open })),
  enableRange: (exp: string, from: string, to: string, weekdays: number[]) =>
    ok(db().rpc('admin_enable_range', { p_experience: exp, p_from: from, p_to: to, p_weekdays: weekdays })) as Promise<number>,
  settings: () => ok(db().from('app_settings').select('key, value')) as Promise<{ key: string; value: unknown }[]>,
  saveSetting: (key: string, value: unknown) => ok(db().from('app_settings').update({ value, updated_at: new Date().toISOString() }).eq('key', key)),
  purge: () => ok(db().rpc('purge_personal_data')) as Promise<number>,
};

/** CSV amb separador ";" i BOM: s'obre bé a l'Excel en català/castellà. */
export function bookingsToCsv(rows: Booking[]): string {
  const cols: [string, (b: Booking) => unknown][] = [
    ['Referència', (b) => b.ref],
    ['Rebuda', (b) => b.created_at],
    ['Data', (b) => b.day],
    ['Franja', (b) => b.slot_label],
    ['Inici', (b) => b.start_time.slice(0, 5)],
    ['Fi', (b) => b.end_time.slice(0, 5)],
    ['Empresa', (b) => b.company],
    ['Contacte', (b) => b.contact_name],
    ['Correu', (b) => b.email],
    ['Telèfon', (b) => b.phone],
    ['Municipi', (b) => b.location ?? ''],
    ['Participants', (b) => b.participants],
    ['Observacions', (b) => b.notes ?? ''],
    ['Estat comercial', (b) => COMMERCIAL_LABEL[b.commercial_status]],
    ['Reté la franja', (b) => (b.holds_slot ? 'Sí' : 'No')],
    ['Contactat', (b) => b.contacted_at ?? ''],
    ['Consentiment comercial', (b) => (b.marketing_consent ? 'Sí' : 'No')],
  ];
  const cell = (v: unknown) => {
    let s = String(v ?? '');
    // Evita la injecció de fórmules en obrir-lo amb un full de càlcul
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [cols.map(([h]) => cell(h)).join(';'), ...rows.map((b) => cols.map(([, f]) => cell(f(b))).join(';'))];
  return '﻿' + lines.join('\r\n');
}

// ---------------------------------------------------------------------------
// Sol·licituds d'informació (formulari «Parlem?»)
// ---------------------------------------------------------------------------
export type LeadStatus = 'nova' | 'contactada' | 'en_negociacio' | 'guanyada' | 'perduda';
export const LEAD_LABEL: Record<LeadStatus, string> = {
  nova: 'Nova',
  contactada: 'Contactada',
  en_negociacio: 'En negociació',
  guanyada: 'Contractada',
  perduda: 'No convertida',
};
export const LEAD_ORDER = Object.keys(LEAD_LABEL) as LeadStatus[];

export type Lead = {
  id: string;
  ref: string;
  experience: string;
  company: string;
  contact_name: string;
  email: string;
  phone: string;
  location: string | null;
  participants: number;
  preferred_dates: string | null;
  notes: string | null;
  marketing_consent: boolean;
  status: LeadStatus;
  internal_email_at: string | null;
  anonymized_at: string | null;
  created_at: string;
  updated_at: string;
};

export const leadsApi = {
  list: () => ok(db().from('leads').select('*').order('created_at', { ascending: false })) as Promise<Lead[]>,
  setStatus: (id: string, status: LeadStatus) => ok(db().rpc('admin_set_lead_status', { p_lead: id, p_status: status })),
  notes: (id: string) =>
    ok(db().from('lead_notes').select('id, body, author_email, created_at').eq('lead_id', id).order('created_at')) as Promise<Note[]>,
  addNote: async (id: string, body: string) => {
    const { data } = await db().auth.getUser();
    return ok(db().from('lead_notes').insert({ lead_id: id, body, author_id: data.user?.id, author_email: data.user?.email }));
  },
};

export function leadsToCsv(rows: Lead[]): string {
  const cols: [string, (l: Lead) => unknown][] = [
    ['Referència', (l) => l.ref],
    ['Rebuda', (l) => l.created_at],
    ['Empresa', (l) => l.company],
    ['Contacte', (l) => l.contact_name],
    ['Correu', (l) => l.email],
    ['Telèfon', (l) => l.phone],
    ['Municipi', (l) => l.location ?? ''],
    ['Participants', (l) => l.participants],
    ['Data o període preferent', (l) => l.preferred_dates ?? ''],
    ['Observacions', (l) => l.notes ?? ''],
    ['Estat', (l) => LEAD_LABEL[l.status]],
    ['Correu a hola@ enviat', (l) => (l.internal_email_at ? 'Sí' : 'No')],
    ['Consentiment comercial', (l) => (l.marketing_consent ? 'Sí' : 'No')],
  ];
  const cell = (v: unknown) => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [cols.map(([h]) => cell(h)).join(';'), ...rows.map((l) => cols.map(([, f]) => cell(f(l))).join(';'))].join('\r\n');
}
