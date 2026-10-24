import { AccountError } from './policy';
export interface MailBindings {
  AUTH_MAIL_MODE?: string;
  AUTH_MAIL_FROM?: string;
  AUTH_PUBLIC_ORIGIN?: string;
  RESEND_API_KEY?: string;
}
export type MailCategory = 'signup' | 'reset' | 'security';
const SEND_BUDGET_LIMITS: Record<MailCategory, readonly [daily: number, monthly: number]> = {
  signup: [70, 1800],
  reset: [85, 2600],
  security: [90, 2900],
};
export function localMail(request: Request, bindings: MailBindings) {
  return (
    bindings.AUTH_MAIL_MODE === 'local' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(new URL(request.url).hostname)
  );
}
export function mailOrigin(request: Request, bindings: MailBindings) {
  if (localMail(request, bindings)) return new URL(request.url).origin;
  try {
    const url = new URL(bindings.AUTH_PUBLIC_ORIGIN ?? '');
    if (url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/')
      return url.origin;
  } catch {
    /* fail closed below */
  }
  throw new AccountError('email_unavailable', 503);
}
export function requireMailReady(request: Request, bindings: MailBindings) {
  mailOrigin(request, bindings);
  if (
    !localMail(request, bindings) &&
    (!bindings.RESEND_API_KEY ||
      !bindings.AUTH_MAIL_FROM ||
      !/^\S+@\S+\.\S+$/.test(bindings.AUTH_MAIL_FROM))
  )
    throw new AccountError('email_unavailable', 503);
}
export async function sendAccountMail(
  db: D1Database,
  request: Request,
  bindings: MailBindings,
  to: string,
  subject: string,
  text: string,
  deliveryKey = crypto.randomUUID(),
  category: MailCategory = 'security',
) {
  requireMailReady(request, bindings);
  if (localMail(request, bindings)) {
    await db
      .prepare('DELETE FROM auth_local_mail WHERE created_at<?')
      .bind(Math.floor(Date.now() / 1000) - 3600)
      .run();
    await db
      .prepare(
        'INSERT INTO auth_local_mail(id,recipient,subject,body,created_at) VALUES (?,?,?,?,?)',
      )
      .bind(crypto.randomUUID(), to, subject, text, Math.floor(Date.now() / 1000))
      .run();
    return;
  }
  const date = new Date().toISOString();
  const [dailyLimit, monthlyLimit] = SEND_BUDGET_LIMITS[category];
  for (const [period, limit] of [
    [date.slice(0, 10), dailyLimit],
    [date.slice(0, 7), monthlyLimit],
  ] as const) {
    const result = await db
      .prepare(
        'INSERT INTO auth_mail_limits(key,attempts,started_at,last_sent_at) VALUES (?,1,0,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1,last_sent_at=excluded.last_sent_at WHERE attempts<?',
      )
      .bind('send-budget:' + period, Math.floor(Date.now() / 1000), limit)
      .run();
    if (result.meta.changes !== 1) {
      // Makes an exhausted budget visible in Workers observability; the address is never logged.
      console.warn(
        JSON.stringify({
          event: 'mail_budget_refused',
          category,
          period: period.length === 10 ? 'day' : 'month',
        }),
      );
      throw new AccountError('email_unavailable', 503);
    }
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${bindings.RESEND_API_KEY}`,
      'Idempotency-Key': deliveryKey,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      from: `Transcultural Network <${bindings.AUTH_MAIL_FROM}>`,
      to: [to],
      subject,
      text,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new AccountError('email_unavailable', 503);
}
export async function securityNotice(
  db: D1Database,
  request: Request,
  bindings: MailBindings,
  email: string,
  kind: 'password' | 'withdrawal',
) {
  if (!email.includes('@')) return;
  // Retry once in memory; never retain a withdrawn user's original address for a queue.
  const deliveryKey = crypto.randomUUID();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await sendAccountMail(
        db,
        request,
        bindings,
        email,
        kind === 'password' ? 'Your TCN password was changed' : 'Your TCN account was closed',
        kind === 'password'
          ? 'Your password was changed. If you did not request this, contact the TCN Secretariat immediately.'
          : 'Your TCN account has been closed. If you did not request this, contact the TCN Secretariat immediately.',
        deliveryKey,
      );
      return;
    } catch {
      /* Provider errors may contain recipient details: do not log them. */
    }
  }
  console.warn(JSON.stringify({ event: 'account_security_notice_failed', kind }));
}
