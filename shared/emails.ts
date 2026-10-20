// Plantilles dels correus transaccionals. HTML senzill amb taules i estils
// en línia (és el que suporten de debò els clients de correu).

import { formatDayLong, formatDuration, formatTime, formatTimestamp } from './format.ts';

export type BookingSummary = {
  ref: string;
  experienceName: string;
  day: string;
  slotLabel: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  company: string;
  contactName: string;
  email: string;
  phone: string;
  location: string | null;
  participants: number;
  notes: string | null;
  marketing: boolean;
  createdAt: string;
};

export type Email = { subject: string; html: string; text: string };

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const C = { pine: '#14261F', cream: '#FAF6F1', ember: '#D9733F', text: '#2C2C2A', muted: '#6B6B66', line: '#E6DED3' };

export function layout(title: string, body: string, footer: string): string {
  return `<!doctype html><html lang="ca"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${C.cream};font-family:Lato,Arial,Helvetica,sans-serif;color:${C.text}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.cream}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:${C.pine};padding:28px 32px">
  <div style="font-family:Montserrat,Arial,sans-serif;font-weight:700;font-size:13px;letter-spacing:3px;color:${C.ember}">CONNECT</div>
  <div style="font-family:Montserrat,Arial,sans-serif;font-weight:700;font-size:18px;letter-spacing:1px;color:#ffffff">TEAM EXPERIENCE</div>
  <div style="font-size:12px;color:#B9CBBF;margin-top:6px">by IMPAUSA</div>
</td></tr>
<tr><td style="padding:32px">${body}</td></tr>
<tr><td style="padding:20px 32px;border-top:1px solid ${C.line};font-size:12px;line-height:1.6;color:${C.muted}">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

export function rows(pairs: [string, string][]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px">${pairs
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid ${C.line};color:${C.muted};width:42%;vertical-align:top">${esc(k)}</td><td style="padding:8px 0;border-bottom:1px solid ${C.line};font-weight:700;vertical-align:top">${esc(v).replace(/\n/g, '<br>')}</td></tr>`,
    )
    .join('')}</table>`;
}

const slotText = (b: BookingSummary) =>
  `${b.slotLabel} · ${formatTime(b.startTime)}–${formatTime(b.endTime)} h`;

function summaryPairs(b: BookingSummary): [string, string][] {
  return [
    ['Referència', b.ref],
    ['Experiència', b.experienceName],
    ['Data', formatDayLong(b.day)],
    ['Franja', slotText(b)],
    ['Durada', formatDuration(b.durationMinutes)],
    ['Empresa', b.company],
    ['Persona de contacte', b.contactName],
    ['Correu', b.email],
    ['Telèfon', b.phone],
    ['Municipi', b.location || '—'],
    ['Participants (aprox.)', String(b.participants)],
    ['Observacions', b.notes || '—'],
  ];
}

export type ContactInfo = { email: string; phone: string; web: string; legalName: string };

export function customerConfirmationEmail(b: BookingSummary, contact: ContactInfo): Email {
  const subject = `Hem rebut la vostra sol·licitud — ${b.experienceName}`;
  const disclaimer = 'Aquesta comunicació confirma la recepció de la sol·licitud, no la reserva definitiva de la data.';
  const body = `
<h1 style="font-family:Montserrat,Arial,sans-serif;font-size:22px;line-height:1.3;color:${C.pine};margin:0 0 16px">La vostra sol·licitud s’ha rebut correctament!</h1>
<p style="font-size:15px;line-height:1.6;margin:0 0 12px">Hola, ${esc(b.contactName)}:</p>
<p style="font-size:15px;line-height:1.6;margin:0 0 12px">Gràcies per voler viure <strong>${esc(b.experienceName)}</strong> amb IMPAUSA. Hem rebut la vostra petició i contactarem amb vosaltres per confirmar la disponibilitat i concretar els detalls de l’experiència.</p>
<p style="font-size:14px;line-height:1.6;margin:0 0 24px;padding:12px 16px;background:${C.cream};border-left:4px solid ${C.ember};border-radius:4px"><strong>${esc(disclaimer)}</strong></p>
<h2 style="font-family:Montserrat,Arial,sans-serif;font-size:15px;color:${C.pine};margin:0 0 8px">Resum de la sol·licitud</h2>
${rows(summaryPairs(b))}
<p style="font-size:14px;line-height:1.6;margin:24px 0 0">Si voleu modificar alguna dada, responeu aquest correu o escriviu a <a href="mailto:${esc(contact.email)}" style="color:${C.ember}">${esc(contact.email)}</a>.</p>`;
  const footer = `${esc(contact.legalName)} · <a href="mailto:${esc(contact.email)}" style="color:${C.muted}">${esc(contact.email)}</a> · ${esc(contact.phone)} · <a href="${esc(contact.web)}" style="color:${C.muted}">${esc(contact.web.replace(/^https?:\/\//, ''))}</a><br>Rebeu aquest correu perquè heu sol·licitat una prereserva al nostre web. Les vostres dades es tracten segons la nostra política de privacitat.`;

  const text = [
    'LA VOSTRA SOL·LICITUD S’HA REBUT CORRECTAMENT!',
    '',
    `Hola, ${b.contactName}:`,
    '',
    `Gràcies per voler viure ${b.experienceName} amb IMPAUSA. Hem rebut la vostra petició i contactarem amb vosaltres per confirmar la disponibilitat i concretar els detalls de l’experiència.`,
    '',
    disclaimer,
    '',
    'RESUM',
    ...summaryPairs(b).map(([k, v]) => `${k}: ${v}`),
    '',
    `${contact.legalName} · ${contact.email} · ${contact.phone} · ${contact.web}`,
  ].join('\n');

  return { subject, html: layout(subject, body, footer), text };
}

export function internalNotificationEmail(b: BookingSummary, adminUrl: string): Email {
  const subject = `Nova prereserva — ${b.experienceName} · ${b.company} · ${b.ref}`;
  const pairs: [string, string][] = [
    ...summaryPairs(b),
    ['Consentiment comercial', b.marketing ? 'Sí' : 'No'],
    ['Rebuda', formatTimestamp(b.createdAt) + ' (hora de Madrid)'],
  ];
  const link = `${adminUrl.replace(/\/$/, '')}/admin?sol=${encodeURIComponent(b.ref)}`;
  const body = `
<h1 style="font-family:Montserrat,Arial,sans-serif;font-size:20px;color:${C.pine};margin:0 0 8px">Nova prereserva</h1>
<p style="font-size:15px;line-height:1.6;margin:0 0 20px"><strong>${esc(b.company)}</strong> ha sol·licitat la franja <strong>${esc(slotText(b))}</strong> del <strong>${esc(formatDayLong(b.day))}</strong>. La franja ha quedat en estat <em>pendent</em> fins que la gestioneu.</p>
${rows(pairs)}
<p style="margin:28px 0 0"><a href="${esc(link)}" style="display:inline-block;background:${C.ember};color:#ffffff;text-decoration:none;font-family:Montserrat,Arial,sans-serif;font-weight:700;font-size:14px;padding:12px 22px;border-radius:999px">Obre-la al panell privat</a></p>`;
  const text = [
    'NOVA PRERESERVA',
    '',
    ...pairs.map(([k, v]) => `${k}: ${v}`),
    '',
    `Panell privat: ${link}`,
  ].join('\n');
  return { subject, html: layout(subject, body, 'Notificació interna automàtica del motor de reserves IMPAUSA. Conté dades personals: no la reenvieu fora de l’equip.'), text };
}
