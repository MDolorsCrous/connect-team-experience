// Pàgina de reserva genèrica: /reserva/<slug>. Serveix per a qualsevol experiència
// (workshop, team building…) donada d'alta a la base de dades, sense tocar codi.
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useT } from '../i18n';
import { BookingFlow } from '../components/BookingFlow';
import { Logo } from '../components/Brand';
import { Footer } from './Landing';
import { fetchExperience, type ExperienceInfo } from '../lib/api';
import { formatDuration } from '../../shared/format.ts';

export function Reserva() {
  const { slug = '' } = useParams();
  const t = useT();
  const [exp, setExp] = useState<ExperienceInfo | null | undefined>(undefined);

  useEffect(() => {
    fetchExperience(slug).then(setExp).catch(() => setExp(null));
  }, [slug]);
  useEffect(() => {
    if (exp) document.title = `${exp.name} · Prereserva | IMPAUSA`;
  }, [exp]);

  return (
    <>
      <header className="bg-pine-950">
        <div className="container-x flex h-16 items-center">
          <a href="/" aria-label="IMPAUSA"><Logo className="h-6 w-auto" /></a>
        </div>
      </header>
      <main className="min-h-[60vh] bg-cream-200 py-14 sm:py-20">
        <div className="container-x">
          {exp === null ? (
            <p className="rounded-2xl bg-white p-8 text-center">{t.booking.notFound}</p>
          ) : (
            <>
              <div className="mb-10 max-w-2xl">
                <p className="kicker mb-3">{t.booking.kicker}</p>
                <h1 className="text-3xl font-extrabold text-pine-900 sm:text-4xl">{exp?.name ?? '…'}</h1>
                {exp && <p className="mt-3 text-ink-muted">{formatDuration(exp.durationMinutes)} · {t.booking.genericIntro}</p>}
              </div>
              <BookingFlow slug={slug} />
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
