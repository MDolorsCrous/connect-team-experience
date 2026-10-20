// Enviament del formulari «Parlem?» amb Netlify Forms.
// Netlify rep la sol·licitud, l'envia per correu a hola@impausa.com (es configura al panell de
// Netlify) i la desa al seu llistat de Forms. No hi ha base de dades ni servidor propi.
import { NETLIFY_FORM, toNetlifyFields, type LeadData } from '../../shared/lead.ts';

/** En local (npm run dev) Netlify no hi és: el formulari es valida però no s'envia. */
export const LOCAL_MODE = import.meta.env.DEV;

export class ApiError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

export async function submitLead(data: LeadData, honeypot: string): Promise<void> {
  if (LOCAL_MODE) {
    await new Promise((r) => setTimeout(r, 500));
    return;
  }
  const body = new URLSearchParams({ 'form-name': NETLIFY_FORM, website: honeypot, ...toNetlifyFields(data) });
  let res: Response;
  try {
    res = await fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  } catch {
    throw new ApiError('NETWORK');
  }
  if (!res.ok) throw new ApiError('SERVER_ERROR');
}
