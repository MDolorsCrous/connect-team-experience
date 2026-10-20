// Panell: sol·licituds d'informació rebudes pel formulari «Parlem?».
import { useEffect, useMemo, useState } from 'react';
import { formatTimestamp } from '../../shared/format.ts';
import { humanError, LEAD_LABEL, LEAD_ORDER, leadsApi, leadsToCsv, type Lead, type LeadStatus, type Note } from './data';

const BADGE: Record<LeadStatus, string> = {
  nova: 'bg-ember/15 text-ember-dark',
  contactada: 'bg-gold/20 text-[#7A5A0E]',
  en_negociacio: 'bg-disc-c/15 text-disc-c',
  guanyada: 'bg-disc-s/15 text-[#1E6E43]',
  perduda: 'bg-ink/10 text-ink-muted',
};

export function LeadsView() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<LeadStatus | 'totes'>('totes');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const reload = async (): Promise<Lead[] | null> => {
    try {
      const list = await leadsApi.list();
      setLeads(list);
      return list;
    } catch (e) {
      setError(humanError(e));
      return null;
    }
  };
  useEffect(() => {
    // Enllaç del correu intern: /admin?lead=CTE-XXXX obre directament la sol·licitud
    reload().then((list) => {
      const ref = new URLSearchParams(location.search).get('lead');
      if (ref && list) setOpenId(list.find((l) => l.ref === ref)?.id ?? null);
    });
  }, []);

  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (leads ?? []).filter(
      (l) => (filter === 'totes' || l.status === filter) && (!n || [l.ref, l.company, l.contact_name, l.email, l.location ?? ''].some((v) => v.toLowerCase().includes(n))),
    );
  }, [leads, filter, q]);

  const k = useMemo(() => {
    const all = leads ?? [];
    const won = all.filter((l) => l.status === 'guanyada').length;
    return [
      ['Sol·licituds rebudes', String(all.length)],
      ['Pendents de contactar', String(all.filter((l) => l.status === 'nova').length)],
      ['En negociació', String(all.filter((l) => l.status === 'en_negociacio').length)],
      ['Contractades', String(won)],
      ['Participants potencials', all.filter((l) => l.status !== 'perduda').reduce((s, l) => s + l.participants, 0).toLocaleString('ca-ES')],
      ['Conversió', all.length ? `${Math.round((won / all.length) * 100)} %` : '—'],
    ] as [string, string][];
  }, [leads]);

  const exportCsv = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([leadsToCsv(rows)], { type: 'text/csv;charset=utf-8' }));
    a.download = `sollicituds-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const open = (leads ?? []).find((l) => l.id === openId) ?? null;

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="rounded-xl bg-disc-d/10 p-3 text-sm text-disc-d">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {k.map(([l, v]) => (
          <div key={l} className="rounded-2xl bg-white p-4 shadow-soft">
            <p className="text-xs text-ink-muted">{l}</p>
            <p className="mt-1 font-head text-2xl font-extrabold text-pine-900">{v}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_28rem]">
        <div className="rounded-2xl bg-white p-4 shadow-soft">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input className="field max-w-xs py-2" placeholder="Cerca empresa, contacte, municipi…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cerca" />
            <select className="field w-auto py-2" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label="Filtra per estat">
              <option value="totes">Totes</option>
              {LEAD_ORDER.map((s) => <option key={s} value={s}>{LEAD_LABEL[s]}</option>)}
            </select>
            <button className="btn ml-auto border border-pine-900 py-2 text-xs text-pine-900 hover:bg-pine-900 hover:text-white" onClick={exportCsv} disabled={!rows.length}>
              Exporta CSV ({rows.length})
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] text-left text-sm">
              <thead className="border-b border-cream-300 text-xs uppercase tracking-wider text-ink-muted">
                <tr><th className="py-2 pr-3">Empresa</th><th className="py-2 pr-3">Municipi</th><th className="py-2 pr-3">Part.</th><th className="py-2 pr-3">Estat</th><th className="py-2">Rebuda</th></tr>
              </thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.id} className={`cursor-pointer border-b border-cream-200 hover:bg-cream ${l.id === openId ? 'bg-cream' : ''}`} onClick={() => setOpenId(l.id)}>
                    <td className="py-3 pr-3">
                      <button className="text-left font-semibold text-pine-900 hover:underline" onClick={() => setOpenId(l.id)}>{l.company}</button>
                      <div className="text-xs text-ink-muted">{l.contact_name} · {l.ref}</div>
                    </td>
                    <td className="py-3 pr-3">{l.location ?? '—'}</td>
                    <td className="py-3 pr-3">{l.participants}</td>
                    <td className="py-3 pr-3"><span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${BADGE[l.status]}`}>{LEAD_LABEL[l.status]}</span></td>
                    <td className="py-3 text-xs text-ink-muted">{formatTimestamp(l.created_at)}</td>
                  </tr>
                ))}
                {leads && rows.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-ink-muted">Cap sol·licitud amb aquests filtres.</td></tr>}
                {!leads && !error && <tr><td colSpan={5} className="py-10 text-center text-ink-muted">Carregant…</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        {open ? (
          <LeadDetail key={open.id + open.updated_at} l={open} reload={reload} onClose={() => setOpenId(null)} />
        ) : (
          <div className="hidden rounded-2xl border-2 border-dashed border-cream-300 p-8 text-center text-sm text-ink-muted xl:block">Seleccioneu una sol·licitud per veure’n el detall.</div>
        )}
      </div>
    </div>
  );
}

function LeadDetail({ l, reload, onClose }: { l: Lead; reload: () => Promise<unknown>; onClose: () => void }) {
  const [status, setStatus] = useState<LeadStatus>(l.status);
  const [notes, setNotes] = useState<Note[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    leadsApi.notes(l.id).then(setNotes).catch((e) => setMsg({ ok: false, text: humanError(e) }));
  }, [l.id]);

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      await reload();
      setNotes(await leadsApi.notes(l.id));
      setMsg({ ok: true, text: done });
    } catch (e) {
      setMsg({ ok: false, text: humanError(e) });
    } finally {
      setBusy(false);
    }
  };
  const anonymized = !!l.anonymized_at;

  return (
    <aside className="rounded-2xl bg-white p-5 shadow-soft xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto" aria-label={`Sol·licitud ${l.ref}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-ink-muted">{l.ref}</p>
          <h2 className="font-head text-lg font-bold text-pine-900">{l.company}</h2>
        </div>
        <button className="rounded-full px-3 py-1 text-sm hover:bg-cream-200" onClick={onClose} aria-label="Tanca el detall">✕</button>
      </div>
      <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2 text-sm">
        <dt className="text-ink-muted">Contacte</dt><dd>{l.contact_name}</dd>
        <dt className="text-ink-muted">Correu</dt><dd className="break-all">{anonymized ? l.email : <a className="underline" href={`mailto:${l.email}`}>{l.email}</a>}</dd>
        <dt className="text-ink-muted">Telèfon</dt><dd>{anonymized ? l.phone : <a className="underline" href={`tel:${l.phone.replace(/\s/g, '')}`}>{l.phone}</a>}</dd>
        <dt className="text-ink-muted">Municipi</dt><dd>{l.location || '—'}</dd>
        <dt className="text-ink-muted">Participants</dt><dd>{l.participants}</dd>
        <dt className="text-ink-muted">Data preferent</dt><dd className="break-words">{l.preferred_dates || '—'}</dd>
        <dt className="text-ink-muted">Observacions</dt><dd className="whitespace-pre-line break-words">{l.notes || '—'}</dd>
        <dt className="text-ink-muted">Consentiment comercial</dt><dd>{l.marketing_consent ? 'Sí' : 'No'}</dd>
        <dt className="text-ink-muted">Rebuda</dt><dd>{formatTimestamp(l.created_at)}</dd>
        <dt className="text-ink-muted">Correu a hola@</dt><dd className="text-xs">{l.internal_email_at ? '✓ enviat' : '✗ no enviat (reviseu la configuració del correu)'}</dd>
      </dl>
      {!anonymized && (
        <div className="mt-5 rounded-xl bg-cream p-4">
          <label className="label" htmlFor="lst">Estat</label>
          <select id="lst" className="field py-2" value={status} onChange={(e) => setStatus(e.target.value as LeadStatus)}>
            {LEAD_ORDER.map((s) => <option key={s} value={s}>{LEAD_LABEL[s]}</option>)}
          </select>
          <button className="btn-primary mt-3 w-full py-2.5" disabled={busy || status === l.status} onClick={() => run(() => leadsApi.setStatus(l.id, status), 'Estat actualitzat.')}>
            Desa l’estat
          </button>
        </div>
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
              if (note.trim()) run(() => leadsApi.addNote(l.id, note.trim()), 'Nota afegida.').then(() => setNote(''));
            }}
          >
            <textarea className="field min-h-20 text-sm" maxLength={4000} placeholder="Afegeix una nota interna…" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Nova nota interna" />
            <button className="btn mt-2 bg-pine-900 py-2 text-xs text-white" disabled={busy || !note.trim()}>Afegeix nota</button>
          </form>
        )}
      </section>
    </aside>
  );
}
