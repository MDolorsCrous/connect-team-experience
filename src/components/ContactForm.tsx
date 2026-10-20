// Formulari «Parlem?»: l'empresa interessada deixa les seves dades i s'envien
// automàticament a hola@impausa.com (via /api/contacte). Sense calendari ni reserva.
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useLocale, useT } from '../i18n';
import { ApiError, createLead } from '../lib/api';
import { LEAD_LIMITS, validateLead, type LeadInput } from '../../shared/lead.ts';
import { Icon } from './Brand';

type FormState = {
  company: string;
  contactName: string;
  email: string;
  phone: string;
  location: string;
  participants: string;
  preferredDates: string;
  notes: string;
  privacy: boolean;
  marketing: boolean;
  website: string;
};

const EMPTY: FormState = {
  company: '',
  contactName: '',
  email: '',
  phone: '',
  location: '',
  participants: '',
  preferredDates: '',
  notes: '',
  privacy: false,
  marketing: false,
  website: '',
};

export function ContactForm() {
  const t = useT().contact;
  const locale = useLocale();
  const uid = useId();
  const [f, setF] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ ref: string; form: FormState } | null>(null);
  const startedAt = useRef(Date.now());
  const summaryRef = useRef<HTMLDivElement>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: '' }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setServerError(null);
    const input: LeadInput = { ...f, locale, startedAt: startedAt.current };
    const v = validateLead(input);
    if (!v.ok && Object.keys(v.errors).length > 0) {
      setErrors(v.errors as Record<string, string>);
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    setSending(true);
    try {
      const res = await createLead(input);
      setDone({ ref: res.ref, form: f });
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'SERVER_ERROR';
      if (err instanceof ApiError && Object.keys(err.fields).length) setErrors(err.fields);
      setServerError(t.serverErrors[code] ?? t.serverErrors.SERVER_ERROR);
    } finally {
      setSending(false);
    }
  };

  if (done)
    return (
      <Done
        ref_={done.ref}
        form={done.form}
        onAnother={() => {
          setDone(null);
          setF(EMPTY);
          startedAt.current = Date.now();
        }}
      />
    );

  const errorList = Object.entries(errors).filter(([, v]) => v);
  const fieldProps = (k: keyof FormState) => ({
    id: `${uid}-${k}`,
    'aria-invalid': errors[k] ? (true as const) : undefined,
    'aria-describedby': errors[k] ? `${uid}-${k}-err` : undefined,
  });
  const Err = ({ k }: { k: keyof FormState }) =>
    errors[k] ? (
      <p id={`${uid}-${k}-err`} className="mt-1.5 text-sm font-semibold text-disc-d">{t.errors[errors[k]] ?? t.errors.invalid}</p>
    ) : null;
  const labels: Record<string, string> = {
    company: t.company,
    contactName: t.contactName,
    email: t.email,
    phone: t.phone,
    location: t.location,
    participants: t.participants,
    preferredDates: t.preferredDates,
    notes: t.notes,
    privacy: t.privacyLink,
  };
  const [privA, privB] = t.privacy('§').split('§');

  return (
    <form onSubmit={submit} noValidate className="rounded-3xl bg-white p-5 text-ink shadow-soft sm:p-8">
      <h3 className="mb-5 font-head text-xl font-bold text-pine-900">{t.formTitle}</h3>

      {errorList.length > 0 && (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="mb-6 rounded-2xl border border-disc-d/40 bg-disc-d/5 p-4 text-sm">
          <p className="font-bold">{t.errorSummary}</p>
          <ul className="mt-1 list-disc pl-5">
            {errorList.map(([k]) => (
              <li key={k}><a className="underline" href={`#${uid}-${k}`}>{labels[k] ?? k}</a></li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="label" htmlFor={`${uid}-company`}>{t.company} *</label>
          <input className="field" {...fieldProps('company')} autoComplete="organization" maxLength={LEAD_LIMITS.company} value={f.company} onChange={(e) => set('company', e.target.value)} />
          <Err k="company" />
        </div>
        <div>
          <label className="label" htmlFor={`${uid}-contactName`}>{t.contactName} *</label>
          <input className="field" {...fieldProps('contactName')} autoComplete="name" maxLength={LEAD_LIMITS.contactName} value={f.contactName} onChange={(e) => set('contactName', e.target.value)} />
          <Err k="contactName" />
        </div>
        <div>
          <label className="label" htmlFor={`${uid}-email`}>{t.email} *</label>
          <input className="field" {...fieldProps('email')} type="email" inputMode="email" autoComplete="email" maxLength={LEAD_LIMITS.email} value={f.email} onChange={(e) => set('email', e.target.value)} />
          <Err k="email" />
        </div>
        <div>
          <label className="label" htmlFor={`${uid}-phone`}>{t.phone} *</label>
          <input className="field" {...fieldProps('phone')} type="tel" inputMode="tel" autoComplete="tel" maxLength={LEAD_LIMITS.phone} value={f.phone} onChange={(e) => set('phone', e.target.value)} />
          <Err k="phone" />
        </div>
        <div>
          <label className="label" htmlFor={`${uid}-location`}>{t.location} *</label>
          <input className="field" {...fieldProps('location')} autoComplete="address-level2" maxLength={LEAD_LIMITS.location} value={f.location} onChange={(e) => set('location', e.target.value)} />
          <p className="mt-1.5 text-xs text-ink-muted">{t.locationHint}</p>
          <Err k="location" />
        </div>
        <div>
          <label className="label" htmlFor={`${uid}-participants`}>{t.participants} *</label>
          <input className="field" {...fieldProps('participants')} type="number" inputMode="numeric" min={1} max={LEAD_LIMITS.participantsMax} step={1} value={f.participants} onChange={(e) => set('participants', e.target.value)} />
          <p className="mt-1.5 text-xs text-ink-muted">{t.participantsHint}</p>
          <Err k="participants" />
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor={`${uid}-preferredDates`}>
            {t.preferredDates} <span className="font-normal text-ink-muted">({t.optional})</span>
          </label>
          <input className="field" {...fieldProps('preferredDates')} maxLength={LEAD_LIMITS.preferredDates} placeholder={t.preferredDatesHint} value={f.preferredDates} onChange={(e) => set('preferredDates', e.target.value)} />
          <Err k="preferredDates" />
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor={`${uid}-notes`}>
            {t.notes} <span className="font-normal text-ink-muted">({t.optional})</span>
          </label>
          <textarea className="field min-h-28" {...fieldProps('notes')} maxLength={LEAD_LIMITS.notes} placeholder={t.notesHint} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
          <Err k="notes" />
        </div>
      </div>

      {/* Honeypot: invisible per a persones i lectors de pantalla */}
      <div className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <label>Web<input tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => set('website', e.target.value)} name="website" /></label>
      </div>

      <div className="mt-6 space-y-3 rounded-2xl bg-cream p-4 text-sm sm:p-5">
        <label className="flex items-start gap-3">
          <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-pine-900" {...fieldProps('privacy')} checked={f.privacy} onChange={(e) => set('privacy', e.target.checked)} />
          <span>
            {privA}
            <a href="/privacitat" target="_blank" rel="noopener" className="font-semibold text-pine-800 underline">{t.privacyLink}</a>
            {privB} *
          </span>
        </label>
        <Err k="privacy" />
        <label className="flex items-start gap-3">
          <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-pine-900" checked={f.marketing} onChange={(e) => set('marketing', e.target.checked)} />
          <span>{t.marketing}</span>
        </label>
        <details className="text-xs leading-relaxed text-ink-muted">
          <summary className="cursor-pointer font-semibold text-pine-800">{t.gdprTitle}</summary>
          <p className="mt-2">{t.gdpr}</p>
        </details>
      </div>

      {serverError && <p role="alert" className="mt-5 rounded-2xl bg-disc-d/10 p-4 text-sm font-semibold text-disc-d">{serverError}</p>}

      <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center">
        <button type="submit" className="btn-primary w-full shrink-0 whitespace-nowrap md:w-auto" disabled={sending}>
          {sending ? t.submitting : t.submit}
        </button>
        <p className="text-sm text-ink-muted md:max-w-md">{t.reassurance}</p>
      </div>
    </form>
  );
}

function Done({ ref_, form, onAnother }: { ref_: string; form: FormState; onAnother: () => void }) {
  const t = useT().contact;
  const h = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    h.current?.focus();
    h.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);
  const L = t.done.labels;
  const rows: [string, string][] = [
    [L.ref, ref_],
    [L.company, form.company.trim()],
    [L.contact, form.contactName.trim()],
    [L.email, form.email.trim()],
    [L.phone, form.phone.trim()],
    [L.location, form.location.trim()],
    [L.participants, form.participants.trim()],
    [L.preferredDates, form.preferredDates.trim() || '—'],
    [L.notes, form.notes.trim() || '—'],
  ];
  return (
    <div className="rounded-3xl bg-white p-6 text-ink shadow-soft sm:p-10">
      <span className="mb-5 grid h-14 w-14 place-items-center rounded-full bg-disc-s/15 text-disc-s">
        <Icon name="check" className="h-7 w-7" />
      </span>
      <h3 ref={h} tabIndex={-1} className="font-head text-2xl font-extrabold leading-tight text-pine-900 outline-none sm:text-3xl">
        {t.done.title}
      </h3>
      <p className="mt-4 text-lg leading-relaxed">{t.done.body}</p>
      <h4 className="mb-2 mt-8 font-head font-bold text-pine-900">{t.done.summary}</h4>
      <dl className="divide-y divide-cream-300 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="grid gap-1 py-2.5 sm:grid-cols-[12rem_1fr]">
            <dt className="text-ink-muted">{k}</dt>
            <dd className="whitespace-pre-line break-words font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <button className="btn mt-8 border-2 border-pine-900 text-pine-900 hover:bg-pine-900 hover:text-white" onClick={onAnother}>{t.done.another}</button>
    </div>
  );
}
