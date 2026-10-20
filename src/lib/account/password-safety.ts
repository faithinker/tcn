import { bytesToHex } from '../crypto';
import { AccountError } from './policy';
import { localMail, type MailBindings } from './mail';
export async function assertPasswordNotBreached(
  password: string,
  request: Request,
  bindings: MailBindings,
) {
  if (localMail(request, bindings)) return;
  // SHA-1 is used only for the public k-anonymity lookup, never for password storage.
  const hash = bytesToHex(
    new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(password))),
  ).toUpperCase();
  let body: string;
  try {
    const response = await fetch('https://api.pwnedpasswords.com/range/' + hash.slice(0, 5), {
      headers: { 'Add-Padding': 'true' },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error('unavailable');
    body = await response.text();
  } catch {
    throw new AccountError('password_check_unavailable', 503);
  }
  if (
    body.split(/\r?\n/).some((line) => {
      const [suffix, count] = line.split(':');
      return suffix === hash.slice(5) && Number(count) > 0;
    })
  )
    throw new AccountError('weak_password');
}
