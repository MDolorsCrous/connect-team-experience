// Calendari de prereserves REUTILITZABLE: rep el slug d'una experiència i llegeix de la base
// de dades les franges, la durada, el màxim de participants i els mesos amb dates obertes.
// Serveix igual per a CONNECT Christmas, CONNECT Team Building o qualsevol workshop.
import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { useT, useLocale } from '../i18n';
import {
  ApiError,
  createBooking,
  fetchAvailability,
  fetchExperience,
  type BookingResult,
  type ExperienceInfo,
  type PublicSlot,
} from '../lib/api';
import { validateBooking, LIMITS, type BookingInput } from '../../shared/validation.ts';
import { formatDayLong, formatDuration, formatTime, madridToday } from '../../shared/format.ts';
import { Icon } from './Brand';

type Step = 'pick' | 'form' | 'done';

const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** Icona segons l'hora d'inici: matí (sol) o tarda/vespre (lluna). */
const slotIcon = (startTime: string) => (Number(startTime.slice(0, 2)) < 14 ? 'sun' : 'moon');

export function BookingFlow({ slug }: { slug: string }) {
  const t = useT();
  const [exp, setExp] = useState<ExperienceInfo | null>(null);
  const [slots, setSlots] = useState<PublicSlot[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [day, setDay] = useState<string | null>(null);
  const [slotKey, setSlotKey] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('pick');
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<{ booking: BookingResult; form: FormState } | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const today = madridToday();
      const [e, data] = await Promise.all([fetchExperience(slug), fetchAvailability(slug, addDays(today, 1), addDays(today, 400))]);
      if (!e) throw new Error('NOT_FOUND');
      setExp(e);
      setSlots(data);
      return data;
    } catch {
      setLoadError(true);
      return null;
    }
  }, [slug]);

  useEffect(() => {
    load().then((data) => {
      if (!data) return;
      const first = data.find((s) => s.status === 'disponible') ?? data[0];
      if (first) setMonth(first.day.slice(0, 7));
    });
  }, [load]);

  // Els mesos que es poden consultar són els que tenen alguna franja oberta per IMPAUSA
  const months = useMemo(() => [...new Set((slots ?? []).map((s) => s.day.slice(0, 7)))].sort(), [slots]);
  const byDay = useMemo(() => {
    const m = new Map<string, PublicSlot[]>();
    for (const s of slots ?? []) m.set(s.day, [...(m.get(s.day) ?? []), s]);
    return m;
  }, [slots]);

  const daySlots = day ? byDay.get(day) ?? [] : [];
  const chosen = daySlots.find((s) => s.slotKey === slotKey) ?? null;
  const anyOpen = (slots ?? []).some((s) => s.status === 'disponible');
  const monthIdx = month ? months.indexOf(month) : -1;

  const chooseSlot = (key: string) => {
    setSlotKey(key);
    setStep('form');
    setNotice(null);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const onConflict = async (code: string) => {
    setNotice(t.form.serverErrors[code] ?? t.form.serverErrors.SERVER_ERROR);
    setSlotKey(null);
    setStep('pick');
    await load();
  };

  if (step === 'done' && result && exp) {
    return (
      <Confirmation
        exp={exp}
        result={result.booking}
        form={result.form}
        onAnother={() => {
          setResult(null);
          setSlotKey(null);
          setDay(null);
          setStep('pick');
          load();
        }}
      />
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      {/* Calendari */}
      <div className="rounded-3xl bg-white p-4 shadow-soft sm:p-6">
        {loadError ? (
          <div className="py-10 text-center" role="alert">
            <p className="mb-4">{t.booking.loadError}</p>
            <button className="btn-primary" onClick={() => load()}>{t.booking.retry}</button>
          </div>
        ) : !slots ? (
          <p className="py-16 text-center text-ink-muted" aria-live="polite">{t.booking.loading}</p>
        ) : month ? (
          <Calendar
            month={month}
            canPrev={monthIdx > 0}
            canNext={monthIdx >= 0 && monthIdx < months.length - 1}
            onPrev={() => setMonth(months[monthIdx - 1])}
            onNext={() => setMonth(months[monthIdx + 1])}
            byDay={byDay}
            selected={day}
            onSelect={(d) => {
              setDay(d);
              setSlotKey(null);
              setStep('pick');
              setNotice(null);
            }}
          />
        ) : null}
        {slots && !anyOpen && !loadError && <p className="mt-4 rounded-xl bg-cream-200 p-4 text-sm">{t.booking.noDays}</p>}
      </div>

      {/* Franges del dia */}
      <div className="flex flex-col gap-4">
        {notice && (
          <p role="alert" className="rounded-2xl border border-ember/40 bg-ember/10 p-4 text-sm text-ink">
            {notice}
          </p>
        )}
        {!day ? (
          <div className="flex h-full min-h-40 flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-cream-300 p-8 text-center text-ink-muted">
            <p>{t.booking.pickDay}</p>
            {exp && (
              <ul className="space-y-1 text-sm">
                {exp.slotTypes.map((s) => (
                  <li key={s.key}>
                    <strong className="text-pine-900">{s.label}</strong> · <span className="whitespace-nowrap">{formatTime(s.startTime)}–{formatTime(s.endTime)} h</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div aria-live="polite">
            <h3 className="mb-3 font-head text-lg font-bold text-pine-900">{capFirst(formatDayLong(day))}</h3>
            <div className="grid gap-3">
              {daySlots.map((s) => (
                <SlotCard key={s.slotKey} slot={s} selected={s.slotKey === slotKey} onChoose={() => chooseSlot(s.slotKey)} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Formulari */}
      <div ref={formRef} className="md:col-span-2">
        {step === 'form' && day && chosen && exp && (
          <BookingForm
            exp={exp}
            day={day}
            slot={chosen}
            onChange={() => {
              setStep('pick');
              setSlotKey(null);
            }}
            onDone={(booking, form) => {
              setResult({ booking, form });
              setStep('done');
            }}
            onConflict={onConflict}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Calendar(props: {
  month: string;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  byDay: Map<string, PublicSlot[]>;
  selected: string | null;
  onSelect: (day: string) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const [y, m] = props.month.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7; // dilluns = 0
  const title = capFirst(`${new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'ca-ES', { month: 'long', timeZone: 'UTC' }).format(first)} ${y}`);
  const today = madridToday();

  const cells: (string | null)[] = [...Array(offset).fill(null)];
  for (let d = 1; d <= days; d++) cells.push(`${props.month}-${String(d).padStart(2, '0')}`);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button className="grid h-10 w-10 place-items-center rounded-full hover:bg-cream-200 disabled:opacity-30" onClick={props.onPrev} disabled={!props.canPrev} aria-label={t.booking.prevMonth}>
          <Icon name="arrow" className="h-5 w-5 rotate-180" />
        </button>
        <h3 className="font-head text-lg font-bold text-pine-900" aria-live="polite">{title}</h3>
        <button className="grid h-10 w-10 place-items-center rounded-full hover:bg-cream-200 disabled:opacity-30" onClick={props.onNext} disabled={!props.canNext} aria-label={t.booking.nextMonth}>
          <Icon name="arrow" className="h-5 w-5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center" role="grid" aria-label={title}>
        {t.booking.weekdays.map((w) => (
          <div key={w} className="pb-2 font-head text-[11px] font-bold uppercase tracking-wider text-ink-muted" role="columnheader">{w}</div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />;
          const ss = props.byDay.get(d) ?? [];
          const open = ss.filter((s) => s.status === 'disponible').length;
          const clickable = d > today && ss.some((s) => s.status !== 'no_disponible');
          const sel = props.selected === d;
          const num = Number(d.slice(8));
          return (
            <button
              key={d}
              disabled={!clickable}
              onClick={() => props.onSelect(d)}
              aria-pressed={sel}
              aria-label={ss.length ? t.booking.dayLabel(formatDayLong(d, locale), open) : formatDayLong(d, locale)}
              className={[
                'relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition sm:text-base',
                sel ? 'bg-pine-900 font-bold text-white' : clickable ? 'bg-cream-200 font-semibold text-pine-900 hover:bg-pine-200' : 'text-ink-muted/40',
              ].join(' ')}
            >
              {num}
              {ss.length > 0 && d > today && (
                <span className="mt-1 flex gap-0.5" aria-hidden="true">
                  {ss.map((s) => (
                    <span
                      key={s.slotKey}
                      className={`h-1.5 w-3 rounded-full ${s.status === 'disponible' ? 'bg-disc-s' : s.status === 'pendent' ? 'bg-disc-i' : sel ? 'bg-white/30' : 'bg-ink-muted/25'}`}
                    />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-muted">
        <li className="flex items-center gap-2"><span className="h-1.5 w-4 rounded-full bg-disc-s" />{t.booking.legend.available}</li>
        <li className="flex items-center gap-2"><span className="h-1.5 w-4 rounded-full bg-disc-i" />{t.booking.legend.pending}</li>
        <li className="flex items-center gap-2"><span className="h-1.5 w-4 rounded-full bg-ink-muted/25" />{t.booking.legend.unavailable}</li>
      </ul>
    </div>
  );
}

function SlotCard({ slot, selected, onChoose }: { slot: PublicSlot; selected: boolean; onChoose: () => void }) {
  const t = useT();
  const available = slot.status === 'disponible';
  return (
    <div
      className={[
        'flex flex-col gap-3 rounded-2xl border-2 p-4 sm:flex-row sm:items-center sm:justify-between md:flex-col md:items-stretch lg:flex-row lg:items-center lg:p-5',
        selected ? 'border-ember bg-white' : available ? 'border-transparent bg-white shadow-soft' : 'border-transparent bg-cream-200',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${available ? 'bg-pine-900 text-gold-light' : 'bg-cream-300 text-ink-muted'}`}>
          <Icon name={slotIcon(slot.startTime)} className="h-5 w-5" />
        </span>
        <div>
          <p className="font-head text-sm font-bold text-pine-900">{slot.label}</p>
          <p className="text-sm text-ink-muted">
            {formatTime(slot.startTime)}–{formatTime(slot.endTime)} h
          </p>
          <p className={`mt-1 text-xs font-bold uppercase tracking-wide ${available ? 'text-disc-s' : slot.status === 'pendent' ? 'text-[#A97E14]' : 'text-ink-muted'}`}>
            {t.booking.status[slot.status]}
          </p>
          {slot.status === 'pendent' && <p className="mt-1 text-xs text-ink-muted">{t.booking.pendingHelp}</p>}
        </div>
      </div>
      {available && (
        <button className={selected ? 'btn border-2 border-ember text-ember' : 'btn-primary'} onClick={onChoose} aria-pressed={selected}>
          {selected ? <><Icon name="check" className="h-4 w-4" />{t.booking.chosen}</> : t.booking.choose}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

type FormState = {
  company: string;
  contactName: string;
  email: string;
  phone: string;
  location: string;
  participants: string;
  notes: string;
  privacy: boolean;
  marketing: boolean;
  website: string;
};

const EMPTY: FormState = { company: '', contactName: '', email: '', phone: '', location: '', participants: '', notes: '', privacy: false, marketing: false, website: '' };

function BookingForm(props: {
  exp: ExperienceInfo;
  day: string;
  slot: PublicSlot;
  onChange: () => void;
  onDone: (b: BookingResult, f: FormState) => void;
  onConflict: (code: string) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const uid = useId();
  const [f, setF] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const startedAt = useRef(Date.now());
  const summaryRef = useRef<HTMLDivElement>(null);
  const max = props.exp.maxParticipants;

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: '' }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setServerError(null);
    const input: BookingInput = {
      slug: props.exp.slug,
      day: props.day,
      slotKey: props.slot.slotKey,
      company: f.company,
      contactName: f.contactName,
      email: f.email,
      phone: f.phone,
      location: f.location,
      participants: f.participants,
      notes: f.notes,
      privacy: f.privacy,
      marketing: f.marketing,
      locale,
      website: f.website,
      startedAt: startedAt.current,
    };
    const v = validateBooking(input, Date.now(), { maxParticipants: max });
    // Si hi ha errors de camp es mostren sempre; el filtre antirobot el decideix el servidor
    if (!v.ok && Object.keys(v.errors).length > 0) {
      setErrors(v.errors as Record<string, string>);
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    setSending(true);
    try {
      const res = await createBooking(input);
      props.onDone(res, f);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'SERVER_ERROR';
      if (['SLOT_UNAVAILABLE', 'SLOT_NOT_FOUND', 'SLOT_PAST'].includes(code)) return props.onConflict(code);
      if (err instanceof ApiError && Object.keys(err.fields).length) setErrors(err.fields);
      setServerError(t.form.serverErrors[code] ?? t.form.serverErrors.SERVER_ERROR);
    } finally {
      setSending(false);
    }
  };

  const errorList = Object.entries(errors).filter(([, v]) => v);
  const fieldProps = (k: keyof FormState) => ({
    id: `${uid}-${k}`,
    'aria-invalid': errors[k] ? (true as const) : undefined,
    'aria-describedby': errors[k] ? `${uid}-${k}-err` : undefined,
  });
  const errText = (code: string) => (code === 'participants_max' && max ? t.form.participantsMax(max) : t.form.errors[code] ?? t.form.errors.invalid);
  const Err = ({ k }: { k: keyof FormState }) =>
    errors[k] ? <p id={`${uid}-${k}-err`} className="mt-1.5 text-sm font-semibold text-disc-d">{errText(errors[k])}</p> : null;
  const labels: Record<string, string> = {
    company: t.form.company,
    contactName: t.form.contactName,
    email: t.form.email,
    phone: t.form.phone,
    location: t.form.location,
    participants: t.form.participants,
    notes: t.form.notes,
    privacy: t.form.privacyLink,
  };

  return (
    <form onSubmit={submit} noValidate className="rounded-3xl bg-white p-5 shadow-soft sm:p-8">
      <div className="mb-6 flex flex-col gap-3 rounded-2xl bg-pine-900 p-4 text-white sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gold-light">{t.form.selected}</p>
          <p className="font-head font-bold">{props.slot.label}</p>
          <p className="text-sm text-pine-200">
            {capFirst(formatDayLong(props.day))} · {formatTime(props.slot.startTime)}–{formatTime(props.slot.endTime)} h
          </p>
        </div>
        <button type="button" className="btn-ghost self-start py-2 text-xs sm:self-auto" onClick={props.onChange}>{t.form.change}</button>
      </div>

      <h3 className="mb-5 font-head text-xl font-bold text-pine-900">{t.form.title}</h3>

      {errorList.length > 0 && (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="mb-6 rounded-2xl border border-disc-d/40 bg-disc-d/5 p-4 text-sm">
          <p className="font-bold">{t.form.errorSummary}</p>
          <ul className="mt-1 list-disc pl-5">
            {errorList.map(([k]) => (
              <li key={k}><a className="underline" href={`#${uid}-${k}`}>{labels[k] ?? k}</a></li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="label" htmlFor={`${uid}-company`}>{t.form.company} *</label>
          <input className="field" {...fieldProps('company')} autoComplete="organization" maxLength={LIMITS.company} required value={f.company} onChange={(e) => set('company', e.target.value)} />
          <Err k="company" />
        </div>
        <div>
          <label className="label" htmlFor={`${uid}-contactName`}>{t.form.contactName} *</label>
          <input className="field" {...fieldProps('contactName')} autoComplete="name" maxLength={LIMITS.contactName} required value={f.contactName} onChange={(e) => set('contactName', e.target.value)} />
          <Err k="contactName" />
        </div>
        <div>
          <label className="label" htmlFor={`${uid}-email`}>{t.form.email} *</label>
          <input className="field" {...fieldProps('email')} type="email" inputMode="email" autoComplete="email" maxLength={LIMITS.email} required value={f.email} onChange={(e) => set('email', e.target.value)} />
          <Err k="email" />
        </div>
        <div>
          <label className="label" htmlFor={`${uid}-phone`}>{t.form.phone} *</label>
          <input className="field" {...fieldProps('phone')} type="tel" inputMode="tel" autoComplete="tel" maxLength={LIMITS.phone} required value={f.phone} onChange={(e) => set('phone', e.target.value)} />
          <Err k="phone" />
        </div>
        <div>
          <label className="label" htmlFor={`${uid}-location`}>{t.form.location} *</label>
          <input className="field" {...fieldProps('location')} autoComplete="address-level2" maxLength={LIMITS.location} required value={f.location} onChange={(e) => set('location', e.target.value)} />
          <p className="mt-1.5 text-xs text-ink-muted">{t.form.locationHint}</p>
          <Err k="location" />
        </div>
        <div>
          <label className="label" htmlFor={`${uid}-participants`}>{t.form.participants} *</label>
          <input className="field" {...fieldProps('participants')} type="number" inputMode="numeric" min={1} max={max ?? 1000} step={1} required value={f.participants} onChange={(e) => set('participants', e.target.value)} />
          <p className="mt-1.5 text-xs text-ink-muted">{max ? t.form.participantsHintMax(max) : t.form.participantsHint}</p>
          <Err k="participants" />
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor={`${uid}-notes`}>
            {t.form.notes} <span className="font-normal text-ink-muted">({t.form.optional})</span>
          </label>
          <textarea className="field min-h-28" {...fieldProps('notes')} maxLength={LIMITS.notes} placeholder={t.form.notesHint} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
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
          <span>{renderPrivacy(t.form.privacy('§'), t.form.privacyLink)} *</span>
        </label>
        <Err k="privacy" />
        <label className="flex items-start gap-3">
          <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-pine-900" checked={f.marketing} onChange={(e) => set('marketing', e.target.checked)} />
          <span>{t.form.marketing}</span>
        </label>
        <details className="text-xs leading-relaxed text-ink-muted">
          <summary className="cursor-pointer font-semibold text-pine-800">{t.form.gdprTitle}</summary>
          <p className="mt-2">{t.form.gdpr}</p>
        </details>
      </div>

      {serverError && <p role="alert" className="mt-5 rounded-2xl bg-disc-d/10 p-4 text-sm font-semibold text-disc-d">{serverError}</p>}

      <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center">
        <button type="submit" className="btn-primary w-full md:w-auto" disabled={sending}>
          {sending ? t.form.submitting : t.form.submit}
        </button>
        <p className="text-sm text-ink-muted md:max-w-md">{t.form.reassurance}</p>
      </div>
    </form>
  );
}

/** Substitueix el marcador § pel vincle a la política de privacitat. */
function renderPrivacy(text: string, linkText: string) {
  const [a, b] = text.split('§');
  return (
    <>
      {a}
      <a href="/privacitat" target="_blank" rel="noopener" className="font-semibold text-pine-800 underline">{linkText}</a>
      {b}
    </>
  );
}

// ---------------------------------------------------------------------------

function Confirmation({ exp, result, form, onAnother }: { exp: ExperienceInfo; result: BookingResult; form: FormState; onAnother: () => void }) {
  const t = useT();
  const h = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    h.current?.focus();
    h.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);
  const L = t.confirmation.labels;
  const rows: [string, string][] = [
    [L.ref, result.ref],
    [L.experience, exp.name],
    [L.date, capFirst(formatDayLong(result.day))],
    [L.slot, `${result.slotLabel} · ${formatTime(result.startTime)}–${formatTime(result.endTime)} h`],
    [L.duration, formatDuration(result.durationMinutes)],
    [L.company, form.company.trim()],
    [L.contact, form.contactName.trim()],
    [L.email, form.email.trim()],
    [L.phone, form.phone.trim()],
    [L.location, form.location.trim()],
    [L.participants, form.participants.trim()],
    [L.notes, form.notes.trim() || '—'],
  ];
  return (
    <div className="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-soft sm:p-10">
      <span className="mb-5 grid h-14 w-14 place-items-center rounded-full bg-disc-s/15 text-disc-s">
        <Icon name="check" className="h-7 w-7" />
      </span>
      <h3 ref={h} tabIndex={-1} className="font-head text-2xl font-extrabold uppercase leading-tight text-pine-900 outline-none sm:text-3xl">
        {t.confirmation.title}
      </h3>
      <p className="mt-4 text-lg leading-relaxed">{t.confirmation.body(exp.name)}</p>
      <p className="mt-5 rounded-xl border-l-4 border-ember bg-cream p-4 font-semibold">{t.confirmation.disclaimer}</p>
      <p className="mt-4 text-sm text-ink-muted">{result.emailSent ? t.confirmation.emailSent(form.email.trim()) : t.confirmation.emailNotSent}</p>
      <h4 className="mb-2 mt-8 font-head font-bold text-pine-900">{t.confirmation.summary}</h4>
      <dl className="divide-y divide-cream-300 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="grid gap-1 py-2.5 sm:grid-cols-[12rem_1fr]">
            <dt className="text-ink-muted">{k}</dt>
            <dd className="whitespace-pre-line break-words font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <button className="btn mt-8 border-2 border-pine-900 text-pine-900 hover:bg-pine-900 hover:text-white" onClick={onAnother}>{t.confirmation.another}</button>
    </div>
  );
}
