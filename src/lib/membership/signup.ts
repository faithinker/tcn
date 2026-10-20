import { checkPasswordPolicy } from '../auth/password-policy';

export interface SignupInput {
  username: string;
  password: string;
  displayName: string;
  affiliation: string | null;
}
type SignupResult =
  { ok: false; error: string; reason?: string } | { ok: true; value: SignupInput };

export function validateSignup(input: unknown): SignupResult {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return { ok: false, error: 'invalid_fields' };
  const body = input as Record<string, unknown>;
  if (
    Object.keys(body).some(
      (key) => !['email', 'password', 'displayName', 'affiliation'].includes(key),
    )
  )
    return { ok: false, error: 'invalid_fields' };
  if (
    typeof body.email !== 'string' ||
    typeof body.password !== 'string' ||
    typeof body.displayName !== 'string' ||
    (body.affiliation !== undefined && typeof body.affiliation !== 'string')
  )
    return { ok: false, error: 'invalid_fields' };
  const username = body.email.trim().toLowerCase();
  const displayName = body.displayName.trim();
  const affiliation = (body.affiliation as string | undefined)?.trim() || null;
  if (username.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username))
    return { ok: false, error: 'invalid_email' };
  if (
    !displayName ||
    displayName.length > 100 ||
    (affiliation?.length ?? 0) > 200 ||
    /[\u0000-\u001f\u007f]/.test(displayName + (affiliation ?? ''))
  )
    return { ok: false, error: 'invalid_profile' };
  const policy = checkPasswordPolicy(body.password, username);
  if (!policy.ok) return { ok: false, error: 'invalid_password', reason: policy.reason };
  return { ok: true, value: { username, password: body.password, displayName, affiliation } };
}
