// Tasca programada diària: anonimitza les dades personals de les sol·licituds
// tancades més antigues que el període de retenció (app_settings.retention_months).
import { supabaseAdmin } from '../lib/supabase-admin.ts';

export default async () => {
  const { data, error } = await supabaseAdmin().rpc('purge_personal_data');
  if (error) {
    console.error('[purge] error', error.message);
    return new Response('error', { status: 500 });
  }
  console.log(`[purge] sol·licituds anonimitzades: ${data}`);
  return new Response('ok');
};

export const config = { schedule: '@daily' };
