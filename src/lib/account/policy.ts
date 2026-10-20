import { isWeakPasswordShape } from '../auth/password-policy';

export class AccountError extends Error {
  constructor(
    readonly code: string,
    readonly status = 400,
  ) {
    super(code);
  }
}
const RESERVED = new Set([
  '관리자',
  '운영자',
  '사무국',
  '회장',
  '임원',
  '탈퇴한회원',
  'admin',
  'administrator',
  'secretariat',
  'tcn',
  'withdrawnmember',
  'deleteduser',
]);
const controls = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;
export function parseProfile(input: Record<string, unknown>) {
  if (Object.keys(input).some((k) => !['displayName', 'affiliation'].includes(k)))
    throw new AccountError('invalid_fields');
  if (
    typeof input.displayName !== 'string' ||
    (input.affiliation !== undefined &&
      input.affiliation !== null &&
      typeof input.affiliation !== 'string')
  )
    throw new AccountError('invalid_profile');
  const displayName = input.displayName.trim();
  const affiliation =
    typeof input.affiliation === 'string' ? input.affiliation.trim() || null : null;
  if (
    !displayName ||
    [...displayName].length > 100 ||
    [...(affiliation ?? '')].length > 200 ||
    controls.test(displayName + (affiliation ?? ''))
  )
    throw new AccountError('invalid_profile');
  if (RESERVED.has(displayName.normalize('NFKC').toLowerCase().replace(/\s/g, '')))
    throw new AccountError('reserved_name');
  return { displayName, affiliation };
}
export function normalizeNewPassword(
  password: unknown,
  confirmation: unknown,
  username = '',
): string {
  if (typeof password !== 'string' || typeof confirmation !== 'string')
    throw new AccountError('invalid_password');
  const normalized = password.normalize('NFC');
  if (controls.test(normalized) || [...normalized].length < 15 || [...normalized].length > 64)
    throw new AccountError('invalid_password');
  if (normalized !== confirmation.normalize('NFC')) throw new AccountError('password_mismatch');
  if (!normalized.trim() || isWeakPasswordShape(normalized, username))
    throw new AccountError('weak_password');
  return normalized;
}
export function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string') throw new AccountError('invalid_email');
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new AccountError('invalid_email');
  return email;
}
export function objectInput(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new AccountError('invalid_fields');
  return value as Record<string, unknown>;
}
