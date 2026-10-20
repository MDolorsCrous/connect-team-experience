// i18n mínim. Per afegir el castellà: crear es.ts amb el mateix tipus Dict
// i registrar-lo a DICTS. La resta de l'app ja llegeix tot de useT().
import { createContext, useContext } from 'react';
import { ca, type Dict } from './ca';

export type Locale = 'ca' | 'es';
export const DICTS: Partial<Record<Locale, Dict>> = { ca };
export const DEFAULT_LOCALE: Locale = 'ca';

export const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export function useT(): Dict {
  const locale = useLocale();
  return DICTS[locale] ?? ca;
}
