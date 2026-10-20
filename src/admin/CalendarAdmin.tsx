import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatTime, madridToday } from '../../shared/format.ts';
import { api, humanError, SLOT_LABEL, type Booking, type Experience, type Slot, type SlotStatus, type SlotType } from './data';

const PILL: Record<SlotStatus, string> = {
  disponible: 'bg-disc-s/15 text-[#1E6E43] border-disc-s/40',
  pendent: 'bg-gold/20 text-[#7A5A0E] border-gold/50',
  confirmada: 'bg-pine-900 text-white border-pine-900',
  bloquejada: 'bg-ink/10 text-ink-muted border-ink/20',
};

export function CalendarAdmin({ exp, bookings, onChanged }: { exp: Experience; bookings: Booking[]; onChanged: () => Promise<void> }) {
  // Navegació lliure per mesos: el motor serveix per a qualsevol època de l'any
  const [month, setMonth] = useState(() => madridToday().slice(0, 7));
  const [types, setTypes] = useState<SlotType[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [onlyEnabled, setOnlyEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [y, m] = month.split('-').map(Number);
  const shift = (n: number) => {
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    setMonth(d.toISOString().slice(0, 7));
  };
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const from = `${month}-01`;
  const to = `${month}-${String(daysInMonth).padStart(2, '0')}`;
  const today = madridToday();

  const load = useCallback(async () => {
    const [t, s] = await Promise.all([api.slotTypes(exp.id), api.slots(exp.id, from, to)]);
    setTypes(t);
    setSlots(s);
  }, [exp.id, from, to]);

  useEffect(() => {
    load().catch((e) => setMsg({ ok: false, text: humanError(e) }));
  }, [load]);

  const run = async (fn: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      await Promise.all([load(), onChanged()]);
      if (done) setMsg({ ok: true, text: done });
    } catch (e) {
      setMsg({ ok: false, text: humanError(e) });
    } finally {
      setBusy(false);
    }
  };

  const slotMap = useMemo(() => {
    const mm = new Map<string, Slot>();
    slots.forEach((s) => mm.set(`${s.day}|${s.slot_type_id}`, s));
    return mm;
  }, [slots]);
  const holder = useMemo(() => {
    const mm = new Map<string, Booking>();
    bookings.filter((b) => b.holds_slot && b.slot_id).forEach((b) => mm.set(b.slot_id!, b));
    return mm;
  }, [bookings]);

  const days = Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
  const title = `${new Intl.DateTimeFormat('ca-ES', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)))} ${y}`;

  return (
    <div className="rounded-2xl bg-white p-4 shadow-soft sm:p-6">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <button className="rounded-full px-3 py-1.5 hover:bg-cream-200 disabled:opacity-30" onClick={() => shift(-1)} aria-label="Mes anterior">←</button>
        <h2 className="min-w-40 text-center font-head text-lg font-bold text-pine-900 first-letter:uppercase">{title}</h2>
        <button className="rounded-full px-3 py-1.5 hover:bg-cream-200 disabled:opacity-30" onClick={() => shift(1)} aria-label="Mes següent">→</button>
        <label className="ml-2 flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-pine-900" checked={onlyEnabled} onChange={(e) => setOnlyEnabled(e.target.checked)} />
          Només dies habilitats
        </label>
        <button
          className="btn ml-auto bg-pine-900 py-2 text-xs text-white"
          disabled={busy}
          onClick={() => run(async () => {
            const n = await api.enableRange(exp.id, from > today ? from : today, to, [1, 2, 3, 4, 5]);
            setMsg({ ok: true, text: `${n} franges noves habilitades.` });
          })}
        >
          Habilita els dies laborables del mes
        </button>
      </div>
      <ul className="mb-4 flex flex-wrap gap-3 text-xs">
        {(Object.keys(SLOT_LABEL) as SlotStatus[]).map((s) => (
          <li key={s} className={`rounded-full border px-2.5 py-1 font-semibold ${PILL[s]}`}>{SLOT_LABEL[s]}</li>
        ))}
      </ul>
      {msg && <p role="status" className={`mb-3 rounded-xl p-3 text-sm ${msg.ok ? 'bg-disc-s/10 text-[#1E6E43]' : 'bg-disc-d/10 text-disc-d'}`}>{msg.text}</p>}

      <div className="divide-y divide-cream-200">
        {days.map((d) => {
          const daySlots = types.map((t) => ({ t, s: slotMap.get(`${d}|${t.id}`) }));
          const enabled = daySlots.some((x) => x.s);
          if (onlyEnabled && !enabled) return null;
          const date = new Date(`${d}T12:00:00Z`);
          const weekend = [0, 6].includes(date.getUTCDay());
          const past = d <= today;
          const label = new Intl.DateTimeFormat('ca-ES', { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);
          return (
            <div key={d} className={`flex flex-col gap-2 py-3 lg:flex-row lg:items-center ${weekend && !enabled ? 'opacity-50' : ''} ${past ? 'opacity-60' : ''}`}>
              <div className="w-28 shrink-0 font-head text-sm font-bold first-letter:uppercase text-pine-900">{label}</div>
              <div className="flex flex-1 flex-wrap gap-2">
                {enabled ? (
                  daySlots.map(({ t, s }) => {
                    if (!s) return <span key={t.id} className="rounded-xl border border-dashed border-cream-300 px-3 py-2 text-xs text-ink-muted">{t.key === 'mati' ? 'Matí' : 'Tarda'}: no habilitada</span>;
                    const h = holder.get(s.id);
                    return (
                      <div key={t.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${PILL[s.status]}`}>
                        <span className="font-bold">{t.key === 'mati' ? 'Matí' : t.key === 'tarda' ? 'Tarda' : t.label} {formatTime(t.start_time)}</span>
                        <span>· {SLOT_LABEL[s.status]}</span>
                        {h && <a className="underline" href={`/admin?sol=${h.ref}`}>{h.company}</a>}
                        {!h && !past && (s.status === 'disponible' || s.status === 'bloquejada') && (
                          <button className="ml-1 rounded-full bg-white/70 px-2 py-0.5 font-semibold text-ink hover:bg-white" disabled={busy} onClick={() => run(() => api.setSlotOpen(s.id, s.status !== 'disponible'))}>
                            {s.status === 'disponible' ? 'Tanca' : 'Obre'}
                          </button>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <span className="text-xs text-ink-muted">Dia no habilitat</span>
                )}
              </div>
              {!past && (
                <div className="flex gap-2">
                  {enabled ? (
                    <>
                      <button className="rounded-full border border-cream-300 px-3 py-1.5 text-xs font-semibold hover:bg-cream" disabled={busy} onClick={() => run(() => api.setDayOpen(exp.id, d, false), 'Dia bloquejat (les franges amb sol·licitud no es toquen).')}>Bloqueja el dia</button>
                      <button className="rounded-full border border-cream-300 px-3 py-1.5 text-xs font-semibold hover:bg-cream" disabled={busy} onClick={() => run(() => api.setDayOpen(exp.id, d, true))}>Obre el dia</button>
                      <button className="rounded-full border border-disc-d/40 px-3 py-1.5 text-xs font-semibold text-disc-d hover:bg-disc-d/5" disabled={busy} onClick={() => run(() => api.setDayEnabled(exp.id, d, false), 'Dia deshabilitat.')}>Deshabilita</button>
                    </>
                  ) : (
                    <button className="rounded-full bg-pine-900 px-3 py-1.5 text-xs font-semibold text-white" disabled={busy} onClick={() => run(() => api.setDayEnabled(exp.id, d, true), 'Dia habilitat amb totes les franges.')}>Habilita</button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
