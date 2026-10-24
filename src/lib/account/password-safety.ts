import { bytesToHex } from '../crypto';
import { AccountError } from './policy';
import { localMail, type MailBindings } from './mail';
export async function assertPasswordNotBreached(
  password: string,
  request: Request,
  bindings: MailBindings,
) {
  if (localMail(request, bindings)) return;
  // The Pwned Passwords range API is keyed by SHA-1, so this is a lookup key and never how a password is stored.
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(password)); // NOSONAR typescript:S4790
  const hash = bytesToHex(new Uint8Array(digest)).toUpperCase();
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
