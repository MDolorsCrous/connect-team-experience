import { useEffect, useState } from 'react';
import { api, humanError } from './data';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export function SettingsView() {
  const [emails, setEmails] = useState('');
  const [months, setMonths] = useState('24');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .settings()
      .then((rows) => {
        const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
        setEmails(Array.isArray(s.notification_emails) ? (s.notification_emails as string[]).join('\n') : '');
        setMonths(String(s.retention_months ?? 24));
      })
      .catch((e) => setMsg({ ok: false, text: humanError(e) }));
  }, []);

  const save = async () => {
    const list = emails.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
    const bad = list.filter((e) => !EMAIL_RE.test(e));
    if (bad.length) return setMsg({ ok: false, text: `Adreces no vàlides: ${bad.join(', ')}` });
    const n = Number(months);
    if (!Number.isInteger(n) || n < 1 || n > 120) return setMsg({ ok: false, text: 'La retenció ha de ser entre 1 i 120 mesos.' });
    setBusy(true);
    try {
      await api.saveSetting('notification_emails', [...new Set(list)]);
      await api.saveSetting('retention_months', n);
      setEmails([...new Set(list)].join('\n'));
      setMsg({ ok: true, text: 'Configuració desada.' });
    } catch (e) {
      setMsg({ ok: false, text: humanError(e) });
    } finally {
      setBusy(false);
    }
  };

  const purge = async () => {
    if (!confirm(`S’anonimitzaran les dades de contacte de les sol·licituds tancades de fa més de ${months} mesos. No es pot desfer. Continuar?`)) return;
    setBusy(true);
    try {
      const n = await api.purge();
      setMsg({ ok: true, text: `${n} sol·licituds anonimitzades.` });
    } catch (e) {
      setMsg({ ok: false, text: humanError(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl bg-white p-6 shadow-soft">
        <h2 className="mb-1 font-head text-lg font-bold text-pine-900">Notificacions internes</h2>
        <p className="mb-4 text-sm text-ink-muted">Adreces que reben un correu a cada nova prereserva. Una per línia.</p>
        <textarea className="field min-h-32 font-mono text-sm" value={emails} onChange={(e) => setEmails(e.target.value)} aria-label="Adreces de notificació" placeholder="comercial@impausa.com" />
        <h2 className="mb-1 mt-6 font-head text-lg font-bold text-pine-900">Retenció de dades</h2>
        <p className="mb-3 text-sm text-ink-muted">Mesos que es conserven les dades de contacte de sol·licituds tancades abans d’anonimitzar-les (tasca diària automàtica).</p>
        <input className="field w-32" type="number" min={1} max={120} value={months} onChange={(e) => setMonths(e.target.value)} aria-label="Mesos de retenció" />
        <div className="mt-6 flex flex-wrap gap-3">
          <button className="btn-primary py-2.5" disabled={busy} onClick={save}>Desa</button>
          <button className="btn border border-disc-d py-2.5 text-disc-d" disabled={busy} onClick={purge}>Aplica la retenció ara</button>
        </div>
        {msg && <p role="status" className={`mt-4 text-sm ${msg.ok ? 'text-[#1E6E43]' : 'text-disc-d'}`}>{msg.text}</p>}
      </div>
      <div className="rounded-2xl bg-white p-6 text-sm leading-relaxed shadow-soft">
        <h2 className="mb-3 font-head text-lg font-bold text-pine-900">Equip amb accés</h2>
        <p>Per seguretat, els comptes no es creen des d’aquí. Per donar accés a una persona:</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Supabase → Authentication → Users → <em>Invite user</em> amb el seu correu.</li>
          <li>Afegiu-la a la taula <code>staff</code> amb el rol <code>comercial</code> o <code>admin</code> (vegeu <code>docs/OPERACIONS.md</code>).</li>
        </ol>
        <p className="mt-3 text-ink-muted">El rol <strong>comercial</strong> gestiona calendari i sol·licituds; <strong>admin</strong>, a més, aquesta configuració.</p>
      </div>
    </div>
  );
}
