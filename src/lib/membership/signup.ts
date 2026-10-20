import {
  AccountError,
  normalizeEmail,
  normalizeNewPassword,
  objectInput,
  parseProfile,
} from '../account/policy';
export interface SignupInput {
  username: string;
  password: string;
  displayName: string;
  affiliation: string | null;
}
type SignupResult =
  { ok: false; error: string; reason?: string } | { ok: true; value: SignupInput };
export function validateSignup(input: unknown): SignupResult {
  try {
    const body = objectInput(input);
    if (
      Object.keys(body).some(
        (k) =>
          !['email', 'password', 'passwordConfirmation', 'displayName', 'affiliation'].includes(k),
      )
    )
      throw new AccountError('invalid_fields');
    const username = normalizeEmail(body.email);
    const password = normalizeNewPassword(body.password, body.passwordConfirmation, username);
    const profile = parseProfile({
      displayName: body.displayName,
      ...(body.affiliation !== undefined ? { affiliation: body.affiliation } : {}),
    });
    return { ok: true, value: { username, password, ...profile } };
  } catch (error) {
    if (error instanceof AccountError) return { ok: false, error: error.code };
    throw error;
  }
}
