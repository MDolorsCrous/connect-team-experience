import { useMemo } from 'react';
import { formatDayLong } from '../../shared/format.ts';
import { CLOSED_LOST, COMMERCIAL_LABEL, COMMERCIAL_ORDER, OPEN_STATUSES, type Booking } from './data';

export function Dashboard({ bookings }: { bookings: Booking[] }) {
  const k = useMemo(() => {
    const total = bookings.length;
    const pending = bookings.filter((b) => OPEN_STATUSES.includes(b.commercial_status)).length;
    const confirmed = bookings.filter((b) => b.commercial_status === 'confirmada').length;
    const lost = bookings.filter((b) => CLOSED_LOST.includes(b.commercial_status)).length;
    const participants = bookings.filter((b) => !CLOSED_LOST.includes(b.commercial_status)).reduce((s, b) => s + b.participants, 0);
    const closed = confirmed + lost;
    const byDay = new Map<string, number>();
    bookings.forEach((b) => byDay.set(b.day, (byDay.get(b.day) ?? 0) + 1));
    const top = [...byDay.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5);
    const bySlot = new Map<string, number>();
    bookings.forEach((b) => bySlot.set(b.slot_label, (bySlot.get(b.slot_label) ?? 0) + 1));
    const byStatus = COMMERCIAL_ORDER.map((s) => [s, bookings.filter((b) => b.commercial_status === s).length] as const);
    return { total, pending, confirmed, participants, closed, top, bySlot, byStatus };
  }, [bookings]);

  const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)} %` : '—');
  const tiles: [string, string, string?][] = [
    ['Prereserves totals', String(k.total)],
    ['Pendents de gestionar', String(k.pending), 'Nova, contacte pendent o en negociació'],
    ['Reserves confirmades', String(k.confirmed)],
    ['Participants potencials', k.participants.toLocaleString('ca-ES'), 'Sense comptar cancel·lades ni no convertides'],
    ['Conversió', pct(k.confirmed, k.total), 'Confirmades sobre el total'],
    ['Conversió de tancades', pct(k.confirmed, k.closed), 'Confirmades sobre les ja resoltes'],
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map(([l, v, h]) => (
          <div key={l} className="rounded-2xl bg-white p-5 shadow-soft">
            <p className="text-sm text-ink-muted">{l}</p>
            <p className="mt-1 font-head text-3xl font-extrabold text-pine-900">{v}</p>
            {h && <p className="mt-1 text-xs text-ink-muted">{h}</p>}
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 shadow-soft">
          <h2 className="mb-3 font-head font-bold text-pine-900">Dates amb més demanda</h2>
          {k.top.length === 0 ? (
            <p className="text-sm text-ink-muted">Encara no hi ha sol·licituds.</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {k.top.map(([d, n]) => (
                <li key={d} className="flex justify-between gap-3">
                  <span className="first-letter:uppercase">{formatDayLong(d)}</span>
                  <span className="font-bold">{n}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-soft">
          <h2 className="mb-3 font-head font-bold text-pine-900">Per estat comercial</h2>
          <ul className="space-y-2 text-sm">
            {k.byStatus.map(([s, n]) => (
              <li key={s} className="flex justify-between"><span>{COMMERCIAL_LABEL[s]}</span><span className="font-bold">{n}</span></li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-soft">
          <h2 className="mb-3 font-head font-bold text-pine-900">Per modalitat</h2>
          <ul className="space-y-2 text-sm">
            {[...k.bySlot.entries()].map(([s, n]) => (
              <li key={s} className="flex justify-between"><span>{s}</span><span className="font-bold">{n}</span></li>
            ))}
            {k.bySlot.size === 0 && <li className="text-ink-muted">—</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
