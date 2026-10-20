import { useEffect } from 'react';
import { Footer } from './Landing';
import { Logo } from '../components/Brand';

// ⚠️ Esborrany pendent de validació jurídica. Els camps marcats amb
// <Pending> no s'han pogut verificar en cap material d'IMPAUSA.
const Pending = ({ children }: { children: string }) => (
  <mark className="rounded bg-gold/30 px-1 font-semibold text-ink">[PENDENT DE VALIDAR: {children}]</mark>
);

export function Privacy() {
  useEffect(() => {
    document.title = 'Política de privacitat · CONNECT Team Experience | IMPAUSA';
  }, []);
  return (
    <>
      <header className="bg-pine-950">
        <div className="container-x flex h-16 items-center">
          <a href="/" aria-label="Torna a l'inici"><Logo className="h-6 w-auto" /></a>
        </div>
      </header>
      <main className="container-x max-w-3xl py-16">
        <p className="kicker mb-3">Versió 2026-10-v2</p>
        <h1 className="mb-8 text-3xl font-extrabold text-pine-900 sm:text-4xl">Política de privacitat — sol·licituds d’informació</h1>
        <div className="space-y-8 leading-relaxed text-ink [&_h2]:mb-2 [&_h2]:font-head [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-pine-900">
          <section>
            <h2>1. Responsable del tractament</h2>
            <p>
              IMPAUSA POWER S.L. · NIF <Pending>NIF</Pending> · Domicili <Pending>adreça social</Pending> · Correu:{' '}
              <a className="underline" href="mailto:hola@impausa.com">hola@impausa.com</a> · Telèfon: 613 026 544.
            </p>
          </section>
          <section>
            <h2>2. Quines dades tractem</h2>
            <p>
              Nom de l’empresa, nom i cognoms i càrrec de la persona de contacte, correu professional, telèfon, nombre
              aproximat de participants, municipi, data o període preferent, observacions que ens vulgueu indicar i la data
              i hora de la sol·licitud. El servei de formularis (Netlify) pot registrar l’adreça IP per filtrar enviaments
              automàtics (correu brossa).
              No us demanem dades de categories especials: no les incloeu a les observacions.
            </p>
          </section>
          <section>
            <h2>3. Finalitat i base jurídica</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Atendre la vostra sol·licitud d’informació, contactar-vos i preparar-vos una proposta: aplicació de mesures precontractuals a petició vostra (art. 6.1.b RGPD).</li>
              <li>Enviar-vos informació d’altres experiències d’IMPAUSA, només si ho heu marcat: consentiment (art. 6.1.a RGPD), revocable en qualsevol moment.</li>
              <li>Prevenir l’ús abusiu del formulari: interès legítim (art. 6.1.f RGPD).</li>
            </ul>
          </section>
          <section>
            <h2>4. Conservació</h2>
            <p>
              Conservem les dades el temps necessari per atendre la sol·licitud i, si es contracta l’experiència, durant
              la relació comercial i els terminis legals aplicables. Les sol·licituds que no es concretin s’eliminen
              passats 24 mesos. <Pending>termini definitiu de conservació</Pending>
            </p>
          </section>
          <section>
            <h2>5. Destinataris i encarregats</h2>
            <p>
              No cedim les dades a tercers excepte obligació legal. Hi accedeixen proveïdors tecnològics que actuen com a
              encarregats del tractament: Netlify, Inc. (allotjament del web i recepció del formulari, que reenvia a
              hola@impausa.com) i el proveïdor del correu electrònic d’IMPAUSA. Netlify pot tractar dades fora de l’Espai
              Econòmic Europeu amb les garanties de les clàusules contractuals tipus de la Comissió Europea.
              <Pending>proveïdor de correu d’IMPAUSA</Pending>
            </p>
          </section>
          <section>
            <h2>6. Drets</h2>
            <p>
              Podeu exercir els drets d’accés, rectificació, supressió, oposició, limitació del tractament i
              portabilitat escrivint a <a className="underline" href="mailto:hola@impausa.com">hola@impausa.com</a>.
              Si considereu que no s’han atès correctament, podeu reclamar davant l’Autoritat Catalana de Protecció de
              Dades (apdcat.cat) o l’Agència Espanyola de Protecció de Dades (aepd.es).
            </p>
          </section>
          <section>
            <h2>7. Galetes</h2>
            <p>
              Aquest web no fa servir galetes, ni de publicitat ni d’analítica, ni carrega tipografies o scripts de tercers.
            </p>
          </section>
          <p className="text-sm text-ink-muted">
            Podeu consultar l’entorn legal complet d’IMPAUSA a{' '}
            <a className="underline" href="https://www.impausa.com/entorn_legal_impausa.html">impausa.com</a>.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
