// Enviament de correu transaccional desacoblat del proveïdor.
// EMAIL_PROVIDER=resend  -> API de Resend (https://resend.com), només fetch
// EMAIL_PROVIDER=log     -> no envia res; ho escriu al log (desenvolupament)

import type { Email } from '../../shared/emails.ts';

export type SendResult = { ok: true; id?: string } | { ok: false; error: string };

export async function sendEmail(to: string[], email: Email, replyTo?: string): Promise<SendResult> {
  const provider = (process.env.EMAIL_PROVIDER || 'log').toLowerCase();
  const recipients = to.map((s) => s.trim()).filter(Boolean);
  if (recipients.length === 0) return { ok: false, error: 'NO_RECIPIENTS' };

  if (provider === 'log') {
    console.log(`[mailer:log] to=${recipients.length} destinatari(s) subject="${email.subject}"`);
    return { ok: true, id: 'log' };
  }

  if (provider === 'resend') {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!key || !from) return { ok: false, error: 'EMAIL_NOT_CONFIGURED' };
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to: recipients,
          subject: email.subject,
          html: email.html,
          text: email.text,
          ...(replyTo ? { reply_to: replyTo } : {}),
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return { ok: false, error: `RESEND_${res.status}: ${(await res.text()).slice(0, 200)}` };
      const json = (await res.json()) as { id?: string };
      return { ok: true, id: json.id };
    } catch (e) {
      return { ok: false, error: `RESEND_FETCH: ${(e as Error).message}` };
    }
  }

  return { ok: false, error: `UNKNOWN_PROVIDER_${provider}` };
}
