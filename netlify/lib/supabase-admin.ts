// Client de Supabase amb la service role. NOMÉS al servidor (Netlify Functions).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_NOT_CONFIGURED');
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

export const CONTACT = {
  legalName: process.env.CONTACT_LEGAL_NAME || 'IMPAUSA POWER S.L.',
  email: process.env.CONTACT_EMAIL || 'hola@impausa.com',
  phone: process.env.CONTACT_PHONE || '613 026 544',
  web: process.env.CONTACT_WEB || 'https://www.impausa.com',
};
