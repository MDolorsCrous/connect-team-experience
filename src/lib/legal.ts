// Entorn legal d'IMPAUSA: s'obre a la mateixa pestanya i, en tornar (amb «Enrere» del
// navegador o amb el botó «← Tornar» de la pàgina legal), el web recupera el formulari
// a mig omplir i el punt de la pàgina. Mateix patró que Identify i LAIA.

/** L'únic lloc on és l'adreça de l'entorn legal. */
export const LEGAL_URL = 'https://www.impausa.com/entorn_legal_impausa.html';

const VUELTA = 'connect-team-vuelta';
const HORES_DE_TORNADA = 2;

/** Camps del formulari «Parlem?» que es recuperen (atribut name dels inputs). */
const CAMPS_TEXT = ['company', 'contactName', 'jobTitle', 'email', 'phone', 'location', 'participants', 'preferredDates', 'notes'] as const;
const CAMPS_CHECK = ['privacy', 'marketing'] as const;

export type Tornada = {
  form: Partial<Record<(typeof CAMPS_TEXT)[number], string> & Record<(typeof CAMPS_CHECK)[number], boolean>>;
  scroll: number;
  cuando: number;
};

const vuelta = {
  apuntar() {
    try {
      // El que està a mig escriure es llegeix del DOM: encara no és enlloc més.
      const form: Tornada['form'] = {};
      const f = document.querySelector<HTMLFormElement>('form[data-form="parlem"]');
      if (f) {
        for (const n of CAMPS_TEXT) {
          const el = f.elements.namedItem(n) as HTMLInputElement | HTMLTextAreaElement | null;
          if (el && el.value) form[n] = el.value;
        }
        for (const n of CAMPS_CHECK) {
          const el = f.elements.namedItem(n) as HTMLInputElement | null;
          if (el) form[n] = el.checked;
        }
      }
      const t: Tornada = { form, scroll: window.scrollY, cuando: Date.now() };
      // sessionStorage i no localStorage: és d'aquesta pestanya i mor amb ella.
      sessionStorage.setItem(VUELTA, JSON.stringify(t));
    } catch {}
  },
  leer(): Tornada | null {
    try {
      const d = JSON.parse(sessionStorage.getItem(VUELTA) || 'null');
      if (!d || typeof d !== 'object') return null;
      if (!(typeof d.cuando === 'number' && Date.now() - d.cuando < HORES_DE_TORNADA * 36e5)) return null;
      return d as Tornada;
    } catch {
      return null;
    }
  },
  olvidar() {
    try {
      sessionStorage.removeItem(VUELTA);
    } catch {}
  },
};

function esElEntornoLegal(a: HTMLAnchorElement): boolean {
  try {
    const legal = new URL(LEGAL_URL);
    return a.origin === legal.origin && a.pathname === legal.pathname;
  } catch {
    return false;
  }
}

/** Adreça de l'entorn legal amb ?return= cap a aquí (amb ?vuelta=1) per al botó «Tornar». */
export function entornoLegalConVuelta(): string {
  const legal = new URL(LEGAL_URL);
  // Només servit per http(s): la pàgina legal no accepta un return que sigui file://.
  if (/^https?:$/.test(location.protocol)) {
    const aqui = new URL(location.href);
    aqui.searchParams.set('vuelta', '1');
    legal.searchParams.set('return', aqui.href);
  }
  return legal.href;
}

/** Delegat al document: apunta on s'era abans de sortir per qualsevol enllaç que abandoni la pàgina. */
function apuntarSiSale(e: MouseEvent) {
  if (e.defaultPrevented) return;
  const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
  if (!a || a.target === '_blank' || !/^https?:$/.test(a.protocol)) return;
  // Una àncora d'aquesta mateixa pàgina no se'n va enlloc.
  if (a.origin === location.origin && a.pathname === location.pathname) return;
  // A l'entorn legal se li diu per on es torna. En el clic, no en dibuixar: així val
  // per al clic normal i per al ctrl+clic.
  if (esElEntornoLegal(a)) a.href = entornoLegalConVuelta();
  vuelta.apuntar();
}

let tornada: Tornada | null = null;

/**
 * S'executa un cop, abans de pintar res. Retorna el que s'ha de recuperar només si es
 * torna amb «Enrere» (navegació back_forward) o amb el botó «Tornar» (?vuelta=1).
 * Una recàrrega a mà o una adreça escrita arrenca el web com sempre.
 */
export function instalarTornada(): void {
  document.addEventListener('click', apuntarSiSale);
  // Si el navegador torna la pàgina sencera (bfcache) no cal res i l'apunt sobra.
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) vuelta.olvidar();
  });

  const d = vuelta.leer();
  vuelta.olvidar();
  const params = new URLSearchParams(location.search);
  const porElBoton = params.get('vuelta') === '1';
  if (porElBoton) {
    params.delete('vuelta');
    const resto = params.toString();
    try {
      window.history.replaceState(null, '', location.pathname + (resto ? '?' + resto : '') + location.hash);
    } catch {}
  }
  if (!d) return;
  const nav = performance.getEntriesByType ? (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined) : undefined;
  if (!porElBoton && nav && nav.type !== 'back_forward') return;
  tornada = d;
}

/** Dades del formulari a recuperar (les llegeix el formulari en crear-se, un sol cop). */
export function formulariRecuperat(): Tornada['form'] | null {
  return tornada ? tornada.form : null;
}

/** Torna al punt de la pàgina on s'era, quan ja s'ha pintat. */
export function tornarAlScroll(): void {
  if (!tornada) return;
  const y = tornada.scroll | 0;
  tornada = null;
  // Dos fotogrames: el formulari i les tipografies ja han ocupat el seu lloc.
  // «instant»: el web té scroll-behavior: smooth i no volem veure'l lliscar fins aquí.
  // Sense requestAnimationFrame: el navegador l'atura si la pestanya no és visible.
  const anar = () => window.scrollTo({ top: y, behavior: 'instant' });
  anar(); // la pàgina ja està pintada (es crida des d'un efecte)
  // Les tipografies poden canviar l'alçada en acabar de carregar: s'hi torna a anar.
  document.fonts?.ready.then(anar).catch(() => {});
}
