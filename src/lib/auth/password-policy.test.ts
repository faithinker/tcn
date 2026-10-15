import { describe, expect, it } from 'vitest';
import { checkPasswordPolicy, MIN_PASSWORD_LENGTH } from './password-policy';

const reason = (password: string, username = 'editor') => {
  const result = checkPasswordPolicy(password, username);
  return result.ok ? null : result.reason;
};

describe('checkPasswordPolicy', () => {
  it('accepts a long passphrase', () => {
    expect(checkPasswordPolicy('correct horse battery staple', 'editor')).toEqual({ ok: true });
    expect(checkPasswordPolicy('t7!Qm92-lowercase-Xv', 'editor')).toEqual({ ok: true });
  });

  it('requires at least 12 characters', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(12);
    expect(reason('Xk9$mQ2!vL7')).toMatch(/at least 12/);
    expect(reason('Xk9$mQ2!vL7p')).toBeNull();
  });

  it('caps the length so an absurd value cannot be hashed', () => {
    expect(reason('a1B!'.repeat(40))).toMatch(/at most 128/);
  });

  it('rejects passwords that contain the username, ignoring case', () => {
    expect(reason('MyEditor-Is-Great-2026', 'editor')).toMatch(/username/);
    expect(reason('xxEDITORxxxxxxxxxx', 'editor')).toMatch(/username/);
  });

  it('ignores a username too short to be meaningful', () => {
    expect(reason('ab-correct-horse-battery', 'ab')).toBeNull();
  });

  it('rejects a single repeated character, a repeating unit and plain sequences', () => {
    expect(reason('aaaaaaaaaaaa')).toMatch(/repetitive|sequence/);
    expect(reason('abababababab')).toMatch(/repetitive|sequence/);
    expect(reason('123123123123')).toMatch(/repetitive|sequence/);
    expect(reason('123456789012')).toMatch(/repetitive|sequence/);
    expect(reason('987654321098')).toMatch(/repetitive|sequence/);
    expect(reason('abcdefghijkl')).toMatch(/repetitive|sequence/);
  });

  it.each([
    'password1234',
    'Password!!!!!',
    'qwertyuiop12',
    'letmein123456',
    'Transcultural1',
    'TheTCN-2026!!',
    'iloveyou12345',
    'administrator1',
  ])('rejects a common word with decoration: %s', (password) => {
    expect(reason(password, 'someone')).toMatch(/common/);
  });

  it('allows a common word buried in a genuinely long phrase', () => {
    expect(reason('password-correct-horse-battery-staple', 'someone')).toBeNull();
  });
});
