import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Logo } from '../components/Brand';
import { api, type Booking, type Experience } from './data';
import { Dashboard } from './Dashboard';
import { BookingsView } from './Bookings';
import { CalendarAdmin } from './CalendarAdmin';
import { SettingsView } from './Settings';
import { LeadsView } from './Leads';

type Tab = 'contactes' | 'resum' | 'sollicituds' | 'calendari' | 'configuracio';
// Les pestanyes del motor de reserves (calendari) només surten si hi ha prereserves o amb ?motor=1:
// la web actual no ofereix reserva, només el formulari «Parlem?».
const TABS: [Tab, string, boolean?][] = [
  ['contactes', 'Sol·licituds'],
  ['resum', 'Reserves: resum', true],
  ['sollicituds', 'Prereserves', true],
  ['calendari', 'Calendari', true],
  ['configuracio', 'Configuració'],
];

export default function AdminApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    document.title = 'Panell privat · IMPAUSA';
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex, nofollow';
    document.head.appendChild(robots);
    if (!supabase) return setSession(null);
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => {
      sub.subscription.unsubscribe();
      robots.remove();
    };
  }, []);

  if (!supabase)
    return <Shell><p className="rounded-2xl bg-white p-8">El panell necessita Supabase configurat (variables <code>VITE_SUPABASE_URL</code> i <code>VITE_SUPABASE_ANON_KEY</code>).</p></Shell>;
  if (session === undefined) return <Shell><p className="p-8 text-center">Carregant…</p></Shell>;
  if (!session) return <Shell><Login /></Shell>;
  return <Panel email={session.user.email ?? ''} />;
}

function Shell({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream-200">
      <header className="bg-pine-950">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            <Logo className="h-5 w-auto" />
            <span className="hidden font-head text-xs font-bold uppercase tracking-widest text-pine-200 sm:inline">Panell de reserves</span>
          </div>
          {right}
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6">{children}</div>
    </div>
  );
}

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setMsg({ kind: 'error', text: 'Correu o contrasenya incorrectes.' });
  };
  const reset = async () => {
    if (!email.trim()) return setMsg({ kind: 'error', text: 'Escriviu primer el correu.' });
    await supabase!.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/admin` });
    setMsg({ kind: 'info', text: 'Si el correu correspon a un compte de l’equip, rebreu un enllaç per restablir la contrasenya.' });
  };

  return (
    <form onSubmit={submit} className="mx-auto mt-10 max-w-sm rounded-3xl bg-white p-8 shadow-soft">
      <h1 className="mb-6 font-head text-xl font-bold text-pine-900">Accés de l’equip</h1>
      <label className="label" htmlFor="em">Correu</label>
      <input id="em" className="field mb-4" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <label className="label" htmlFor="pw">Contrasenya</label>
      <input id="pw" className="field mb-6" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      {msg && <p role="alert" className={`mb-4 text-sm ${msg.kind === 'error' ? 'text-disc-d' : 'text-pine-700'}`}>{msg.text}</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? 'Entrant…' : 'Entra'}</button>
      <button type="button" className="mt-4 w-full text-sm text-pine-700 underline" onClick={reset}>He oblidat la contrasenya</button>
    </form>
  );
}

function SetPassword({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  return (
    <form
      className="mx-auto mt-6 max-w-sm rounded-3xl bg-white p-8 shadow-soft"
      onSubmit={async (e) => {
        e.preventDefault();
        if (pw.length < 12) return setErr('Mínim 12 caràcters.');
        const { error } = await supabase!.auth.updateUser({ password: pw });
        if (error) return setErr(error.message);
        onDone();
      }}
    >
      <h2 className="mb-4 font-head text-lg font-bold text-pine-900">Nova contrasenya</h2>
      <input className="field mb-3" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
      {err && <p className="mb-3 text-sm text-disc-d">{err}</p>}
      <button className="btn-primary w-full">Desa</button>
    </form>
  );
}

function Panel({ email }: { email: string }) {
  const [role, setRole] = useState<'loading' | 'none' | 'staff' | 'admin'>('loading');
  const [exps, setExps] = useState<Experience[]>([]);
  const [exp, setExp] = useState<Experience | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState('');
  const [recovery] = useState(() => location.hash.includes('type=recovery'));
  const [needsPw, setNeedsPw] = useState(recovery);
  const params = new URLSearchParams(location.search);
  const [tab, setTab] = useState<Tab>(params.get('sol') ? 'sollicituds' : 'contactes');
  const showEngine = params.has('motor') || params.has('sol') || bookings.length > 0;

  const reload = useCallback(async () => {
    if (!exp) return;
    try {
      setBookings(await api.bookings(exp.id));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [exp]);

  useEffect(() => {
    (async () => {
      try {
        const staff = await api.isStaff();
        if (!staff) return setRole('none');
        setRole((await api.isAdmin()) ? 'admin' : 'staff');
        const list = await api.experiences();
        setExps(list);
        setExp(list[0] ?? null);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const signOut = (
    <div className="flex items-center gap-3 text-xs text-pine-200">
      <span className="hidden sm:inline">{email}</span>
      <button className="rounded-full border border-white/20 px-3 py-1.5 hover:bg-white/10" onClick={() => supabase!.auth.signOut()}>Surt</button>
    </div>
  );

  if (needsPw) return <Shell right={signOut}><SetPassword onDone={() => { setNeedsPw(false); history.replaceState(null, '', '/admin'); }} /></Shell>;
  if (role === 'loading') return <Shell right={signOut}><p className="p-8 text-center">Comprovant permisos…</p></Shell>;
  if (role === 'none')
    return <Shell right={signOut}><p className="rounded-2xl bg-white p-8">Aquest compte no té accés al panell. Demaneu a una persona administradora que us hi afegeixi.</p></Shell>;

  return (
    <Shell right={signOut}>
      {error && <p role="alert" className="mb-4 rounded-xl bg-disc-d/10 p-3 text-sm text-disc-d">{error}</p>}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          {tab === 'contactes' ? (
            <>
              <p className="kicker">Formulari «Parlem?»</p>
              <h1 className="font-head text-2xl font-extrabold text-pine-900">CONNECT Team Experience</h1>
            </>
          ) : (
            <>
              <p className="kicker">Experiència</p>
              {exps.length > 1 ? (
                <select
                  className="field mt-1 w-auto py-2 font-head font-bold text-pine-900"
                  aria-label="Experiència"
                  value={exp?.id}
                  onChange={(e) => setExp(exps.find((x) => x.id === e.target.value) ?? null)}
                >
                  {exps.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              ) : (
                <h1 className="font-head text-2xl font-extrabold text-pine-900">{exp?.name ?? '—'}</h1>
              )}
              {exp && <p className="mt-1 text-xs text-ink-muted">Enllaç de reserva: <a className="underline" href={`/reserva/${exp.slug}`}>/reserva/{exp.slug}</a></p>}
                </>
          )}
        </div>
        <nav className="flex flex-wrap gap-1 rounded-full bg-white p-1 shadow-soft" aria-label="Seccions del panell">
          {TABS.filter(([k, , engine]) => (k !== 'configuracio' || role === 'admin') && (!engine || showEngine)).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              aria-current={tab === k ? 'page' : undefined}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === k ? 'bg-pine-900 text-white' : 'text-pine-900 hover:bg-cream-200'}`}
            >
              {l}
            </button>
          ))}
        </nav>
      </div>
      {tab === 'contactes' && <LeadsView />}
      {exp && tab === 'resum' && <Dashboard bookings={bookings} />}
      {exp && tab === 'sollicituds' && <BookingsView bookings={bookings} reload={reload} initialRef={params.get('sol')} />}
      {exp && tab === 'calendari' && <CalendarAdmin exp={exp} bookings={bookings} onChanged={reload} />}
      {exp && tab === 'configuracio' && role === 'admin' && <SettingsView />}
    </Shell>
  );
}
