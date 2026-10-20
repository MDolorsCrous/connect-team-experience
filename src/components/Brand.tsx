// Elements visuals de marca: logotip i el motiu dels quatre cercles del catàleg.

/** Logotip oficial IMPAUSA (SVG). Sobre fons fosc, en blanc; sobre fons clar, amb els colors originals sense modificar. */
export function Logo({ className = 'h-7 w-auto', onDark = true }: { className?: string; onDark?: boolean }) {
  return (
    <img
      src={onDark ? '/logo-impausa-blanc.svg' : '/logo-impausa.svg'}
      alt="IMPAUSA"
      width={816}
      height={115}
      className={className}
    />
  );
}

export function ConnectWordmark({ light = true, team = false }: { light?: boolean; team?: boolean }) {
  return (
    <span className="inline-flex flex-col font-head font-extrabold leading-none tracking-wide">
      <span className="text-ember-light">CONNECT</span>
      <span className={light ? 'text-white' : 'text-pine-900'}>{team ? 'TEAM EXPERIENCE' : 'CHRISTMAS EXPERIENCE'}</span>
    </span>
  );
}

/** Els quatre colors CONNECT entrellaçats, com a la pàgina 2 del catàleg. */
export function DiscCircles({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 220" className={className} aria-hidden="true">
      <circle cx="88" cy="82" r="62" fill="#D64545" fillOpacity=".18" stroke="#D64545" strokeWidth="2.5" />
      <circle cx="152" cy="76" r="46" fill="#E6B43C" fillOpacity=".18" stroke="#E6B43C" strokeWidth="2.5" />
      <circle cx="146" cy="146" r="54" fill="#2E9E62" fillOpacity=".18" stroke="#2E9E62" strokeWidth="2.5" />
      <circle cx="70" cy="160" r="36" fill="#2E78C2" fillOpacity=".18" stroke="#2E78C2" strokeWidth="2.5" />
    </svg>
  );
}

export function DiscDots({ className = '' }: { className?: string }) {
  return (
    <span className={`flex gap-2 ${className}`} aria-hidden="true">
      {['bg-disc-d', 'bg-disc-i', 'bg-disc-s', 'bg-disc-c'].map((c) => (
        <span key={c} className={`h-2.5 w-9 rounded-full ${c}`} />
      ))}
    </span>
  );
}

/** Estel fi daurat: l'únic guiny nadalenc, discret. */
export function Spark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19" strokeLinecap="round" opacity=".55" />
      <path d="M12 6.5l1.4 4.1 4.1 1.4-4.1 1.4L12 17.5l-1.4-4.1L6.5 12l4.1-1.4z" fill="currentColor" stroke="none" />
    </svg>
  );
}

type IconName = 'user' | 'users' | 'star' | 'cards' | 'heart' | 'mirror' | 'dots' | 'sun' | 'moon' | 'check' | 'clock' | 'arrow';

export function Icon({ name, className = 'h-6 w-6' }: { name: IconName; className?: string }) {
  const p: Record<IconName, JSX.Element> = {
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
    users: <><circle cx="8" cy="8" r="3.2" /><circle cx="16.5" cy="8" r="3.2" /><path d="M2 20c1-3.4 3.3-5 6-5s5 1.6 6 5M13 15.4c.9-.3 2.1-.4 3.5-.4 2.7 0 5 1.6 5.5 5" /></>,
    star: <path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8 6.6 19.7l1.1-6.1L3.2 9.4l6.1-.8z" />,
    cards: <><rect x="4" y="5" width="11" height="15" rx="2" /><path d="M9 3h9a2 2 0 012 2v12" /></>,
    heart: <path d="M12 20s-7.5-4.6-9-9.3C2 7.4 4.3 4.5 7.4 4.5c2 0 3.6 1.1 4.6 2.7 1-1.6 2.6-2.7 4.6-2.7 3.1 0 5.4 2.9 4.4 6.2C19.5 15.4 12 20 12 20z" />,
    mirror: <><rect x="5" y="3" width="14" height="18" rx="3" /><circle cx="12" cy="11" r="3" /></>,
    dots: <><circle cx="7.5" cy="7.5" r="3" /><circle cx="16.5" cy="7.5" r="3" /><circle cx="7.5" cy="16.5" r="3" /><circle cx="16.5" cy="16.5" r="3" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" /></>,
    moon: <path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" />,
    check: <path d="M4.5 12.5l5 5L19.5 7" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
    arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  };
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {p[name]}
    </svg>
  );
}
