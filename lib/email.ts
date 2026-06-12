/**
 * lib/email.ts
 * Utilitário de envio de email via Resend.
 * Requer RESEND_API_KEY e EMAIL_FROM nas variáveis de ambiente.
 */

import { Resend } from 'resend';

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM = process.env.EMAIL_FROM ?? 'Disrupy <noreply@disrupy.com>';

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY não configurado — email não enviado para:', to);
    return { ok: false, error: 'RESEND_API_KEY não configurado' };
  }

  try {
    const result = await getResend().emails.send({ from: FROM, to, subject, html });
    if (result.error) {
      console.error('[email] Erro Resend:', result.error);
      return { ok: false, error: result.error.message };
    }
    return { ok: true, id: result.data?.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error('[email] Exceção ao enviar:', msg);
    return { ok: false, error: msg };
  }
}
