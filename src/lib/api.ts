// Accés públic a dades: disponibilitat i creació de prereserves.
import type { BookingInput } from '../../shared/validation.ts';
import { madridToday } from '../../shared/format.ts';
import { DEMO_MODE, supabase } from './supabase';

export type PublicStatus = 'disponible' | 'pendent' | 'no_disponible';

export type PublicSlot = {
  day: string;
  slotKey: string;
  label: string;
  startTime: string;
  endTime: string;
  status: PublicStatus;
};

export type SlotType = { key: string; label: string; startTime: string; endTime: string };

/** Tot el que el calendari necessita saber d'una experiència: ve de la base de dades. */
export type ExperienceInfo = {
  slug: string;
  name: string;
  durationMinutes: number;
  maxParticipants: number | null;
  slotTypes: SlotType[];
};

export type BookingResult = {
  ref: string;
  day: string;
  slotKey: string;
  slotLabel: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  emailSent: boolean;
};

export class ApiError extends Error {
  constructor(
    public code: string,
    public fields: Record<string, string> = {},
  ) {
    super(code);
  }
}

export async function fetchExperience(slug: string): Promise<ExperienceInfo | null> {
  if (DEMO_MODE) return demo.experience(slug);
  if (!supabase) throw new ApiError('LOAD_ERROR');
  const { data, error } = await supabase.rpc('public_experience', { p_slug: slug });
  if (error) throw new ApiError('LOAD_ERROR');
  const r = (data as { slug: string; name: string; duration_minutes: number; max_participants: number | null; slot_types: { key: string; label: string; start_time: string; end_time: string }[] }[])[0];
  if (!r) return null;
  return {
    slug: r.slug,
    name: r.name,
    durationMinutes: r.duration_minutes,
    maxParticipants: r.max_participants,
    slotTypes: r.slot_types.map((t) => ({ key: t.key, label: t.label, startTime: t.start_time, endTime: t.end_time })),
  };
}

export async function fetchAvailability(slug: string, from: string, to: string): Promise<PublicSlot[]> {
  if (DEMO_MODE) return demo.availability(from, to);
  if (!supabase) throw new ApiError('LOAD_ERROR');
  const { data, error } = await supabase.rpc('public_availability', { p_slug: slug, p_from: from, p_to: to });
  if (error) throw new ApiError('LOAD_ERROR');
  return (data as { day: string; slot_key: string; label: string; start_time: string; end_time: string; status: PublicStatus }[]).map(
    (r) => ({ day: r.day, slotKey: r.slot_key, label: r.label, startTime: r.start_time, endTime: r.end_time, status: r.status }),
  );
}

export async function createBooking(input: BookingInput): Promise<BookingResult> {
  if (DEMO_MODE) return demo.create(input);
  let res: Response;
  try {
    res = await fetch('/api/prereserva', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch {
    throw new ApiError('NETWORK');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error || 'SERVER_ERROR', body.fields || {});
  return body as BookingResult;
}

// ---------------------------------------------------------------------------
// Mode demostració (només quan no hi ha Supabase configurat). Dades inventades
// a la memòria del navegador: res no es desa ni s'envia.
// ---------------------------------------------------------------------------
const demo = (() => {
  const state = new Map<string, PublicStatus>();
  const TYPES = [
    { key: 'mati', label: 'Christmas Morning Experience', start: '10:00:00', end: '13:30:00' },
    { key: 'tarda', label: 'Christmas Afternoon Experience', start: '16:00:00', end: '19:30:00' },
  ];
  const seed = () => {
    if (state.size) return;
    const today = madridToday();
    for (let d = new Date(Date.UTC(2026, 10, 2)); d <= new Date(Date.UTC(2026, 11, 22)); d.setUTCDate(d.getUTCDate() + 1)) {
      const wd = d.getUTCDay();
      if (wd === 0 || wd === 6) continue;
      const day = d.toISOString().slice(0, 10);
      TYPES.forEach((t, i) => {
        const n = d.getUTCDate() + i;
        const st: PublicStatus = day <= today ? 'no_disponible' : n % 11 === 0 ? 'pendent' : n % 13 === 0 ? 'no_disponible' : 'disponible';
        state.set(`${day}|${t.key}`, st);
      });
    }
  };
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  return {
    async experience(slug: string): Promise<ExperienceInfo> {
      return {
        slug,
        name: 'CONNECT Christmas Experience',
        durationMinutes: 210,
        maxParticipants: 50,
        slotTypes: TYPES.map((t) => ({ key: t.key, label: t.label, startTime: t.start, endTime: t.end })),
      };
    },
    async availability(from: string, to: string): Promise<PublicSlot[]> {
      seed();
      await wait(250);
      return [...state.entries()]
        .map(([k, status]) => {
          const [day, key] = k.split('|');
          const t = TYPES.find((x) => x.key === key)!;
          return { day, slotKey: key, label: t.label, startTime: t.start, endTime: t.end, status };
        })
        .filter((s) => s.day >= from && s.day <= to)
        .sort((a, b) => (a.day + a.slotKey).localeCompare(b.day + b.slotKey));
    },
    async create(input: BookingInput): Promise<BookingResult> {
      seed();
      await wait(600);
      const k = `${input.day}|${input.slotKey}`;
      if (state.get(k) !== 'disponible') throw new ApiError('SLOT_UNAVAILABLE');
      state.set(k, 'pendent');
      const t = TYPES.find((x) => x.key === input.slotKey)!;
      return {
        ref: 'DEMO-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
        day: input.day,
        slotKey: t.key,
        slotLabel: t.label,
        startTime: t.start,
        endTime: t.end,
        durationMinutes: 210,
        emailSent: false,
      };
    },
  };
})();

// ---------------------------------------------------------------------------
// Formulari «Parlem?»: les dades s'envien a /api/contacte, que les desa i les
// reenvia automàticament a hola@impausa.com.
// ---------------------------------------------------------------------------
export async function createLead(input: import('../../shared/lead.ts').LeadInput): Promise<{ ref: string }> {
  if (DEMO_MODE) {
    await new Promise((r) => setTimeout(r, 500));
    return { ref: 'DEMO-' + Math.random().toString(36).slice(2, 8).toUpperCase() };
  }
  let res: Response;
  try {
    res = await fetch('/api/contacte', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch {
    throw new ApiError('NETWORK');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error || 'SERVER_ERROR', body.fields || {});
  return body as { ref: string };
}
