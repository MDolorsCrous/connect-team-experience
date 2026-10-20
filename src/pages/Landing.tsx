// Landing de CONNECT TEAM EXPERIENCE, segons el catàleg final.
// Sense calendari: el formulari «Parlem?» envia les dades a hola@impausa.com (Netlify Forms).
import { useT } from '../i18n';
import { ContactForm } from '../components/ContactForm';
import { ConnectWordmark, DiscCircles, DiscDots, Icon, Logo } from '../components/Brand';
import { LOCAL_MODE } from '../lib/api';

const DISC_TEXT = ['text-disc-d', 'text-disc-i', 'text-disc-s', 'text-disc-c'];
const DISC_BORDER = ['border-disc-d', 'border-disc-i', 'border-disc-s', 'border-disc-c'];

export function Landing() {
  const t = useT();
  return (
    <>
      <a href="#contingut" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2">
        {t.nav.skip}
      </a>
      {LOCAL_MODE && <div className="bg-gold px-4 py-2 text-center text-sm font-semibold text-pine-950 print:hidden">{t.demo}</div>}
      <Header />
      <main id="contingut">
        <Hero />
        <PrintIndex />
        <Challenge />
        <Solution />
        <Disc />
        <Dynamics />
        <BigChallenge />
        <Benefits />
        <Contact />
      </main>
      <Footer />
    </>
  );
}

/** Només al PDF: índex navegable amb enllaços a cada secció. */
function PrintIndex() {
  const t = useT();
  const items: [string, string][] = [
    ['repte', t.challenge.kicker],
    ['solucio', t.what.kicker],
    ['eina', t.disc.kicker],
    ['dinamiques', t.dynamics.kicker],
    ['gran-repte', t.bigChallenge.kicker],
    ['beneficis', t.benefits.kicker],
    ['parlem', t.contact.boxTitle],
  ];
  return (
    <nav className="hidden bg-pine-900 py-10 text-white print:block print:break-after-page" aria-label={t.print.index}>
      <div className="container-x">
        <p className="kicker mb-4 text-ember-light">{t.print.index}</p>
        <ol className="grid grid-cols-2 gap-x-10 gap-y-3 font-head text-lg font-bold">
          {items.map(([id, label], i) => (
            <li key={id}>
              <a href={`#${id}`} className="flex items-baseline gap-3 hover:underline">
                <span className="text-sm text-gold">0{i + 1}</span>
                {label}
              </a>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}

function Header() {
  const t = useT();
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-pine-950/90 backdrop-blur print:static print:bg-pine-950">
      <div className="container-x flex h-16 items-center justify-between gap-4">
        <a href="/" aria-label="IMPAUSA · CONNECT Team Experience"><Logo className="h-5 w-auto sm:h-7" /></a>
        <nav className="hidden items-center gap-7 text-sm font-semibold text-pine-200 md:flex" aria-label="Principal">
          <a className="hover:text-white" href="#solucio">{t.nav.experience}</a>
          <a className="hover:text-white" href="#parlem">{t.nav.contact}</a>
        </nav>
        <a href="#parlem" className="btn-primary min-h-[44px] whitespace-nowrap px-5 py-2 text-xs lg:min-h-0">{t.nav.cta}</a>
      </div>
    </header>
  );
}

function Hero() {
  const t = useT();
  return (
    <section className="relative isolate overflow-hidden bg-pine-950 text-white">
      {/* Bokeh del catàleg */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-pine-700/60 sm:h-[28rem] sm:w-[28rem]" />
        <div className="absolute right-[18%] top-[30%] hidden h-64 w-64 rounded-full bg-pine-600/40 md:block" />
        <div className="absolute -bottom-20 right-[6%] h-48 w-48 rounded-full bg-pine-700/50" />
        <div className="absolute bottom-[12%] left-[45%] h-24 w-24 rounded-full bg-pine-600/30" />
      </div>
      <div className="container-x grid items-center gap-10 py-12 sm:py-20 print:min-h-[1060px] md:grid-cols-[1.4fr_1fr] md:gap-8 lg:grid-cols-[1.25fr_1fr] lg:gap-12 lg:py-28">
        <div>
          <p className="mb-4 font-head text-xs font-bold uppercase tracking-[0.3em] text-pine-200">{t.hero.eyebrow}</p>
          <DiscDots className="mb-6 sm:mb-8" />
          <h1 className="text-[clamp(2.1rem,9.5vw,3.5rem)] font-extrabold leading-[1.05] md:text-[clamp(2.6rem,5.8vw,4.25rem)]">{t.hero.title}</h1>
          <p className="mt-5 max-w-xl font-head text-lg font-semibold text-pine-200 sm:mt-6 sm:text-xl">{t.hero.subtitle}</p>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-pine-200/90 sm:text-lg">{t.hero.lead}</p>
          <div className="mt-8 flex flex-col gap-4 sm:mt-9 sm:flex-row sm:items-center">
            <a href="#parlem" className="btn-primary w-full px-7 py-4 text-sm sm:w-auto lg:text-[15px]">
              {t.hero.cta}
              <Icon name="arrow" className="h-4 w-4 shrink-0" />
            </a>
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-pine-200 sm:mt-8">
            {t.hero.facts.map((f) => (
              <li key={f} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-gold" />{f}</li>
            ))}
          </ul>
        </div>
        <div className="relative flex items-center gap-5 md:mx-auto md:w-full md:max-w-sm md:flex-col md:gap-0 lg:max-w-md">
          <DiscCircles className="w-24 shrink-0 drop-shadow-[0_20px_40px_rgba(0,0,0,.35)] sm:w-32 md:w-full" />
          <div className="md:mt-6 md:text-center">
            <div className="text-lg sm:text-xl md:text-2xl lg:text-3xl"><ConnectWordmark team /></div>
          </div>
        </div>
      </div>
    </section>
  );
}

const H2 = 'text-[1.7rem] font-extrabold leading-[1.15] sm:text-4xl lg:text-5xl';

function SectionHead({ id, kicker, title, dark = false, className = '' }: { id: string; kicker: string; title: string; dark?: boolean; className?: string }) {
  return (
    <>
      <p className={`kicker mb-3 ${dark ? 'text-ember-light' : ''}`}>{kicker}</p>
      <div className="rule" />
      <h2 id={id} className={`${H2} ${dark ? 'text-white' : 'text-pine-900'} ${className}`}>{title}</h2>
    </>
  );
}

function Challenge() {
  const t = useT();
  return (
    <section className="py-16 sm:py-24 lg:py-28" aria-labelledby="repte">
      <div className="container-x grid gap-12 lg:grid-cols-[1.3fr_1fr] lg:items-center">
        <div>
          <SectionHead id="repte" kicker={t.challenge.kicker} title={t.challenge.title} />
          {t.challenge.body.map((p) => (
            <p key={p} className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-muted">{p}</p>
          ))}
          <p className="mt-6 max-w-2xl font-head text-lg font-bold text-pine-900">{t.challenge.closing}</p>
        </div>
        <div>
          <DiscCircles className="mx-auto mb-8 hidden w-56 lg:block" />
          <ol className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            {t.challenge.steps.map((s, i) => (
              <li key={s} className="flex items-center gap-5 rounded-2xl bg-white p-5 shadow-soft">
                <span className="font-head text-sm font-bold text-ember">0{i + 1}</span>
                <span className="font-head text-xl font-extrabold uppercase tracking-wide text-pine-900">{s}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function Solution() {
  const t = useT();
  const icons = ['user', 'users', 'star'] as const;
  const compIcons = ['user', 'dots', 'heart', 'users', 'arrow', 'star'] as const;
  return (
    <section id="experiencia" className="bg-white py-16 sm:py-24 lg:py-28" aria-labelledby="solucio">
      <div className="container-x">
        <div className="max-w-3xl">
          <SectionHead id="solucio" kicker={t.what.kicker} title={t.what.title} />
          <p className="mt-6 text-lg leading-relaxed text-ink-muted">{t.what.body}</p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {t.what.journey.map((j, i) => (
            <article key={j.k} className={`rounded-3xl border-t-4 bg-cream p-7 ${['border-ember', 'border-pine-700', 'border-gold'][i]}`}>
              <p className="font-head text-xs font-bold uppercase tracking-[0.25em] text-ink-muted">{j.k}</p>
              <Icon name={icons[i]} className="my-5 h-9 w-9 text-pine-900" />
              <h3 className="text-xl font-extrabold text-pine-900">{j.t}</h3>
              <p className="mt-2 leading-relaxed text-ink-muted">{j.d}</p>
            </article>
          ))}
        </div>
        <h3 className="mb-6 mt-16 font-head text-lg font-bold text-pine-900">{t.what.competenciesTitle}</h3>
        <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          {t.what.competencies.map((c, i) => (
            <li key={c.t} className="flex gap-4">
              <Icon name={compIcons[i]} className="h-6 w-6 shrink-0 text-ember" />
              <div>
                <p className="font-head font-bold text-pine-900">{c.t}</p>
                <p className="text-sm leading-relaxed text-ink-muted">{c.d}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mx-auto mt-14 max-w-2xl text-center font-head text-xl font-bold leading-snug text-pine-900">{t.what.closing}</p>
      </div>
    </section>
  );
}

function Disc() {
  const t = useT();
  return (
    <section className="bg-pine-900 py-16 text-white sm:py-24 lg:py-28" aria-labelledby="eina">
      <div className="container-x">
        <SectionHead id="eina" kicker={t.disc.kicker} title={t.disc.title} dark />
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-pine-200">{t.disc.body}</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {t.disc.items.map((d, i) => (
            <div key={d.l} className={`rounded-2xl border-l-4 bg-pine-800 p-6 ${DISC_BORDER[i]}`}>
              <p className={`font-head text-3xl font-extrabold ${DISC_TEXT[i]}`}>{d.l}</p>
              <p className="mt-2 font-head text-sm font-bold uppercase tracking-wider">{d.n}</p>
              <p className="mt-2 text-sm leading-relaxed text-pine-200">{d.d}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 max-w-2xl font-serif text-xl italic text-ember-light">{t.disc.nuance}</p>
        <p className="mt-6 max-w-2xl font-head text-xl font-bold leading-snug sm:text-2xl">{t.disc.quote}</p>
        <p className="mt-8 max-w-3xl text-xs leading-relaxed text-pine-300/80">{t.disc.disclaimer}</p>
      </div>
    </section>
  );
}

function Dynamics() {
  const t = useT();
  const icons = ['cards', 'heart', 'mirror', 'dots', 'users'] as const;
  return (
    <section className="py-16 sm:py-24 lg:py-28" aria-labelledby="dinamiques">
      <div className="container-x">
        <SectionHead id="dinamiques" kicker={t.dynamics.kicker} title={t.dynamics.title} className="max-w-3xl" />
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {t.dynamics.items.map((d, i) => (
            <article key={d.t} className={`flex gap-5 rounded-2xl bg-white p-6 shadow-soft ${i === 4 ? 'md:col-span-2' : ''}`}>
              <Icon name={icons[i]} className="h-8 w-8 shrink-0 text-ember" />
              <div>
                <h3 className="font-head text-lg font-bold text-pine-900">{d.t}</h3>
                <p className="mt-1 leading-relaxed text-ink-muted">{d.d}</p>
              </div>
            </article>
          ))}
        </div>
        <p className="mt-12 max-w-2xl font-head text-xl font-bold leading-snug text-pine-900 sm:text-2xl">{t.dynamics.closing}</p>
      </div>
    </section>
  );
}

function BigChallenge() {
  const t = useT();
  return (
    <section className="bg-pine-950 py-16 text-white sm:py-24 lg:py-28" aria-labelledby="gran-repte">
      <div className="container-x">
        <SectionHead id="gran-repte" kicker={t.bigChallenge.kicker} title={t.bigChallenge.title} dark className="max-w-3xl" />
        {t.bigChallenge.body.map((p) => (
          <p key={p} className="mt-5 max-w-2xl text-lg leading-relaxed text-pine-200">{p}</p>
        ))}
        <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {t.bigChallenge.glasses.map((g, i) => (
            <div key={g.c} className="rounded-2xl bg-pine-800/80 p-6 text-center">
              <Glasses className={`mx-auto h-6 w-12 ${DISC_TEXT[i]}`} />
              <p className="mt-4 font-head text-sm font-bold uppercase tracking-wider">{g.c}</p>
              <p className="mt-1 text-sm text-pine-200">{g.d}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 max-w-2xl font-head text-xl font-bold leading-snug text-gold sm:text-2xl">{t.bigChallenge.closing}</p>
      </div>
    </section>
  );
}

function Glasses({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 20" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <circle cx="12" cy="10" r="8" />
      <circle cx="36" cy="10" r="8" />
      <path d="M20 10h8" />
    </svg>
  );
}

function Benefits() {
  const t = useT();
  return (
    <section className="bg-white py-16 sm:py-24 lg:py-28" aria-labelledby="beneficis">
      <div className="container-x">
        <SectionHead id="beneficis" kicker={t.benefits.kicker} title={t.benefits.title} className="max-w-3xl" />
        <p className="mt-6 max-w-3xl text-lg leading-relaxed text-ink-muted">{t.benefits.body}</p>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {[t.benefits.participant, t.benefits.company].map((b) => (
            <div key={b.t} className="rounded-3xl bg-cream p-8">
              <h3 className="text-lg font-extrabold text-pine-900">{b.t}</h3>
              <ul className="mt-4 space-y-3">
                {b.items.map((i) => (
                  <li key={i} className="flex gap-3 leading-relaxed text-ink-muted">
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-ember" />
                    {i}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {/* Recorregut de l'experiència, com al catàleg */}
        <div className="mt-12">
          <div className="h-3 rounded-full bg-gradient-to-r from-pine-900 via-pine-600 to-ember" aria-hidden="true" />
          <ol className="mt-3 grid grid-cols-5 gap-1 text-[10px] font-bold uppercase tracking-wider text-ink-muted sm:text-xs">
            {t.benefits.timeline.map((s, i) => (
              <li key={s} className={i === 0 ? 'text-left' : i === 4 ? 'text-right' : 'text-center'}>{s}</li>
            ))}
          </ol>
        </div>
        <p className="mx-auto mt-14 max-w-2xl text-center font-head text-xl font-bold leading-snug text-pine-900 sm:text-2xl">{t.benefits.quote}</p>
      </div>
    </section>
  );
}

function Contact() {
  const t = useT();
  return (
    <section className="relative isolate overflow-hidden bg-pine-900 py-16 text-white sm:py-24 lg:py-28" aria-labelledby="parlem">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-pine-700/50" />
        <div className="absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-pine-700/40" />
      </div>
      <div className="container-x grid gap-10 lg:grid-cols-[1fr_1.3fr] lg:gap-14">
        <div>
          <p className="kicker mb-3 text-ember-light">{t.contact.kicker}</p>
          <div className="rule" />
          <p className={`${H2} font-head text-white`}>{t.contact.title}</p>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-pine-200">{t.contact.body}</p>
          <div className="mt-8 rounded-2xl bg-ember p-6 text-pine-950">
            <h2 id="parlem" className="font-head text-2xl font-extrabold uppercase">{t.contact.boxTitle}</h2>
            <p className="mt-2 leading-relaxed">{t.contact.boxBody}</p>
          </div>
          <p className="mt-6 text-sm text-pine-200">
            {t.contact.direct}{' '}
            <a className="whitespace-nowrap font-semibold text-white underline" href="mailto:hola@impausa.com">hola@impausa.com</a> ·{' '}
            <a className="whitespace-nowrap font-semibold text-white underline" href="tel:+34613026544">613 026 544</a>
          </p>
        </div>
        <div className="print:hidden">
          <ContactForm />
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  const t = useT();
  return (
    <footer className="bg-pine-950 pb-10 text-sm text-pine-200">
      <div className="container-x flex flex-col gap-6 border-t border-white/10 pt-10 md:flex-row md:items-center md:justify-between">
        <div>
          <Logo className="h-6 w-auto" />
          <p className="mt-3 flex flex-col gap-1 sm:block">
            <span>IMPAUSA POWER S.L.</span>
            <span className="hidden sm:inline"> · </span>
            <a className="hover:text-white" href="mailto:hola@impausa.com">hola@impausa.com</a>
            <span className="hidden sm:inline"> · </span>
            <a className="whitespace-nowrap hover:text-white" href="tel:+34613026544">613 026 544</a>
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Legal">
          <a className="hover:text-white" href="https://www.impausa.com/entorn_legal_impausa.html">{t.footer.legal}</a>
          <a className="hover:text-white" href="https://www.impausa.com">impausa.com</a>
        </nav>
      </div>
      <p className="container-x mt-6 text-xs text-pine-300/60">© {new Date().getFullYear()} IMPAUSA POWER S.L. {t.footer.rights}</p>
    </footer>
  );
}
