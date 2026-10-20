import { useEffect, useMemo, useState } from 'react';
import { formatDayLong, formatTime, formatTimestamp } from '../../shared/format.ts';
import {
  api,
  bookingsToCsv,
  CLOSED_LOST,
  COMMERCIAL_LABEL,
  COMMERCIAL_ORDER,
  humanError,
  type AuditEntry,
  type Booking,
  type CommercialStatus,
  type Note,
} from './data';

const BADGE: Record<CommercialStatus, string> = {
  nova: 'bg-ember/15 text-ember-dark',
  contacte_pendent: 'bg-gold/20 text-[#7A5A0E]',
  negociacio: 'bg-disc-c/15 text-disc-c',
  confirmada: 'bg-disc-s/15 text-[#1E6E43]',
  cancellada: 'bg-ink/10 text-ink-muted',
  no_convertida: 'bg-ink/10 text-ink-muted',
};

export function StatusBadge({ s }: { s: CommercialStatus }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${BADGE[s]}`}>{COMMERCIAL_LABEL[s]}</span>;
}

export function BookingsView({ bookings, reload, initialRef }: { bookings: Booking[]; reload: () => Promise<void>; initialRef: string | null }) {
  const [filter, setFilter] = useState<CommercialStatus | 'totes' | 'obertes'>('totes');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (initialRef) {
      const b = bookings.find((x) => x.ref === initialRef);
      if (b) setOpenId(b.id);
    }
  }, [initialRef, bookings]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return bookings.filter(
      (b) =>
        (filter === 'totes' || (filter === 'obertes' ? !CLOSED_LOST.includes(b.commercial_status) && b.commercial_status !== 'confirmada' : b.commercial_status === filter)) &&
        (!needle || [b.ref, b.company, b.contact_name, b.email].some((v) => v.toLowerCase().includes(needle))),
    );
  }, [bookings, filter, q]);

  const exportCsv = () => {
    const blob = new Blob([bookingsToCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `prereserves-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const open = bookings.find((b) => b.id === openId) ?? null;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_28rem]">
      <div className="rounded-2xl bg-white p-4 shadow-soft">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input className="field max-w-xs py-2" placeholder="Cerca empresa, contacte, referència…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cerca" />
          <select className="field w-auto py-2" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label="Filtra per estat">
            <option value="totes">Totes</option>
            <option value="obertes">Per gestionar</option>
            {COMMERCIAL_ORDER.map((s) => <option key={s} value={s}>{COMMERCIAL_LABEL[s]}</option>)}
          </select>
          <button className="btn ml-auto border border-pine-900 py-2 text-xs text-pine-900 hover:bg-pine-900 hover:text-white" onClick={exportCsv} disabled={!rows.length}>
            Exporta CSV ({rows.length})
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-b border-cream-300 text-xs uppercase tracking-wider text-ink-muted">
              <tr><th className="py-2 pr-3">Data i franja</th><th className="py-2 pr-3">Empresa</th><th className="py-2 pr-3">Part.</th><th className="py-2 pr-3">Estat</th><th className="py-2">Rebuda</th></tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr
                  key={b.id}
                  className={`cursor-pointer border-b border-cream-200 hover:bg-cream ${b.id === openId ? 'bg-cream' : ''}`}
                  onClick={() => setOpenId(b.id)}
                >
                  <td className="py-3 pr-3">
                    <button className="text-left font-semibold text-pine-900 underline-offset-2 hover:underline" onClick={() => setOpenId(b.id)}>
                      {b.day.split('-').reverse().join('/')} · {b.slot_key === 'mati' ? 'Matí' : b.slot_key === 'tarda' ? 'Tarda' : b.slot_label}
                    </button>
                    {!b.holds_slot && <span className="ml-2 text-xs text-ink-muted">(franja alliberada)</span>}
                  </td>
                  <td className="py-3 pr-3">{b.company}<div className="text-xs text-ink-muted">{b.ref}</div></td>
                  <td className="py-3 pr-3">{b.participants}</td>
                  <td className="py-3 pr-3"><StatusBadge s={b.commercial_status} /></td>
                  <td className="py-3 text-xs text-ink-muted">{formatTimestamp(b.created_at)}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-ink-muted">Cap sol·licitud amb aquests filtres.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {open ? <BookingDetail key={open.id} b={open} reload={reload} onClose={() => setOpenId(null)} /> : (
        <div className="hidden rounded-2xl border-2 border-dashed border-cream-300 p-8 text-center text-sm text-ink-muted xl:block">Seleccioneu una sol·licitud per veure’n el detall.</div>
      )}
    </div>
  );
}

function BookingDetail({ b, reload, onClose }: { b: Booking; reload: () => Promise<void>; onClose: () => void }) {
  const [status, setStatus] = useState<CommercialStatus>(b.commercial_status);
  const [release, setRelease] = useState(true);
  const [notes, setNotes] = useState<Note[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadSide = async () => {
    const [n, a] = await Promise.all([api.notes(b.id), api.audit('bookings', b.id)]);
    setNotes(n);
    setAudit(a);
  };
  useEffect(() => {
    loadSide().catch((e) => setMsg({ ok: false, text: humanError(e) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b.id, b.updated_at]);

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      await reload();
      await loadSide();
      setMsg({ ok: true, text: done });
    } catch (e) {
      setMsg({ ok: false, text: humanError(e) });
    } finally {
      setBusy(false);
    }
  };

  const losing = CLOSED_LOST.includes(status);
  const anonymized = !!b.anonymized_at;

  return (
    <aside className="rounded-2xl bg-white p-5 shadow-soft xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto" aria-label={`Sol·licitud ${b.ref}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-ink-muted">{b.ref}</p>
          <h2 className="font-head text-lg font-bold text-pine-900">{b.company}</h2>
          <StatusBadge s={b.commercial_status} />
        </div>
        <button className="rounded-full px-3 py-1 text-sm hover:bg-cream-200" onClick={onClose} aria-label="Tanca el detall">✕</button>
      </div>

      <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2 text-sm">
        <dt className="text-ink-muted">Data</dt><dd className="first-letter:uppercase">{formatDayLong(b.day)}</dd>
        <dt className="text-ink-muted">Franja</dt><dd>{b.slot_label} · {formatTime(b.start_time)}–{formatTime(b.end_time)} h</dd>
        <dt className="text-ink-muted">Franja retinguda</dt><dd>{b.holds_slot ? 'Sí (bloqueja altres prereserves)' : 'No, alliberada'}</dd>
        <dt className="text-ink-muted">Contacte</dt><dd>{b.contact_name}</dd>
        <dt className="text-ink-muted">Correu</dt><dd className="break-all">{anonymized ? b.email : <a className="underline" href={`mailto:${b.email}`}>{b.email}</a>}</dd>
        <dt className="text-ink-muted">Telèfon</dt><dd>{anonymized ? b.phone : <a className="underline" href={`tel:${b.phone.replace(/\s/g, '')}`}>{b.phone}</a>}</dd>
        <dt className="text-ink-muted">Municipi</dt><dd>{b.location || '—'}</dd>
        <dt className="text-ink-muted">Participants</dt><dd>{b.participants}</dd>
        <dt className="text-ink-muted">Observacions</dt><dd className="whitespace-pre-line break-words">{b.notes || '—'}</dd>
        <dt className="text-ink-muted">Consentiment comercial</dt><dd>{b.marketing_consent ? 'Sí' : 'No'}</dd>
        <dt className="text-ink-muted">Rebuda</dt><dd>{formatTimestamp(b.created_at)}</dd>
        <dt className="text-ink-muted">Correus</dt>
        <dd className="text-xs">Client: {b.confirmation_email_at ? '✓ enviat' : '✗ no enviat'} · Intern: {b.internal_email_at ? '✓ enviat' : '✗ no enviat'}</dd>
        <dt className="text-ink-muted">Contactat</dt><dd>{b.contacted_at ? formatTimestamp(b.contacted_at) : 'Encara no'}</dd>
      </dl>

      {!anonymized && (
        <>
          <div className="mt-5 rounded-xl bg-cream p-4">
            <label className="label" htmlFor="st">Estat comercial</label>
            <select id="st" className="field py-2" value={status} onChange={(e) => setStatus(e.target.value as CommercialStatus)}>
              {COMMERCIAL_ORDER.map((s) => <option key={s} value={s}>{COMMERCIAL_LABEL[s]}</option>)}
            </select>
            {losing && b.holds_slot && (
              <label className="mt-3 flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-pine-900" checked={release} onChange={(e) => setRelease(e.target.checked)} />
                Allibera la franja perquè altres empreses la puguin sol·licitar
              </label>
            )}
            {status === 'confirmada' && <p className="mt-2 text-xs text-ink-muted">La franja quedarà com a <strong>reserva confirmada</strong> al calendari.</p>}
            <button
              className="btn-primary mt-3 w-full py-2.5"
              disabled={busy || (status === b.commercial_status && !(losing && release && b.holds_slot))}
              onClick={() => run(() => api.updateBooking(b.id, status, losing && release), 'Estat actualitzat.')}
            >
              Desa l’estat
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn border border-pine-900 py-2 text-xs text-pine-900" disabled={busy} onClick={() => run(() => api.markContacted(b.id, !b.contacted_at), b.contacted_at ? 'Contacte desmarcat.' : 'Contacte registrat.')}>
              {b.contacted_at ? 'Desmarca el contacte' : 'Marca contacte realitzat'}
            </button>
            {b.holds_slot && b.commercial_status !== 'confirmada' && (
              <button
                className="btn border border-disc-d py-2 text-xs text-disc-d"
                disabled={busy}
                onClick={() => confirm('La franja tornarà a estar disponible al públic. Continuar?') && run(() => api.releaseSlot(b.id), 'Franja alliberada.')}
              >
                Allibera la franja
              </button>
            )}
          </div>
        </>
      )}
      {msg && <p role="status" className={`mt-3 text-sm ${msg.ok ? 'text-[#1E6E43]' : 'text-disc-d'}`}>{msg.text}</p>}

      <section className="mt-6">
        <h3 className="mb-2 font-head text-sm font-bold text-pine-900">Notes internes</h3>
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg bg-cream p-3 text-sm">
              <p className="whitespace-pre-line break-words">{n.body}</p>
              <p className="mt-1 text-xs text-ink-muted">{n.author_email ?? '—'} · {formatTimestamp(n.created_at)}</p>
            </li>
          ))}
          {notes.length === 0 && <li className="text-sm text-ink-muted">Cap nota.</li>}
        </ul>
        {!anonymized && (
          <form
            className="mt-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!note.trim()) return;
              run(() => api.addNote(b.id, note.trim()), 'Nota afegida.').then(() => setNote(''));
            }}
          >
            <textarea className="field min-h-20 text-sm" maxLength={4000} placeholder="Afegeix una nota interna…" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Nova nota interna" />
            <button className="btn mt-2 bg-pine-900 py-2 text-xs text-white" disabled={busy || !note.trim()}>Afegeix nota</button>
          </form>
        )}
      </section>

      <section className="mt-6">
        <h3 className="mb-2 font-head text-sm font-bold text-pine-900">Historial de canvis</h3>
        <ol className="space-y-1.5 text-xs text-ink-muted">
          {audit.map((a) => (
            <li key={a.id}>
              <span className="font-semibold text-ink">{formatTimestamp(a.at)}</span> · {a.actor_email ?? 'sistema'} · {describe(a)}
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}

function describe(a: AuditEntry): string {
  if (a.action === 'insert') return 'sol·licitud creada';
  const parts: string[] = [];
  const b = a.before ?? {}, n = a.after ?? {};
  if (b.commercial_status !== n.commercial_status)
    parts.push(`estat: ${COMMERCIAL_LABEL[b.commercial_status as CommercialStatus]} → ${COMMERCIAL_LABEL[n.commercial_status as CommercialStatus]}`);
  if (b.holds_slot !== n.holds_slot) parts.push(n.holds_slot ? 'torna a retenir la franja' : 'franja alliberada');
  if (b.contacted_at !== n.contacted_at) parts.push(n.contacted_at ? 'contacte registrat' : 'contacte desmarcat');
  if (b.anonymized_at !== n.anonymized_at) parts.push('dades anonimitzades');
  return parts.join(' · ') || a.action;
}
