import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const EXPERIENCE_SLUG = (import.meta.env.VITE_EXPERIENCE_SLUG as string | undefined) || 'connect-christmas-2026';

const missing = !url || !anon;

/** Sense Supabase configurat, NOMÉS en desenvolupament la part pública funciona en mode demostració.
 *  En producció, sense configuració, el calendari mostra error (mai dades falses). */
export const DEMO_MODE = missing && import.meta.env.DEV;

export const supabase: SupabaseClient | null = missing
  ? null
  : createClient(url!, anon!, { auth: { persistSession: true, autoRefreshToken: true } });
