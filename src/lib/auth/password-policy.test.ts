import { describe, expect, it } from 'vitest';
import { normalizeNewPassword } from '../account/policy';
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

  it('requires at least 15 characters', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(15);
    expect(reason('Xk9$mQ2!vL7pRt')).toMatch(/at least 15/);
    expect(reason('Xk9$mQ2!vL7pRtB')).toBeNull();
  });

  it('caps the length at 64 characters', () => {
    expect(reason('Xk9$mQ2!'.repeat(8))).toBeNull();
    expect(reason('Xk9$mQ2!'.repeat(8) + 'z')).toMatch(/at most 64/);
  });

  it('counts code points after NFC, so Korean text and decomposed forms count once per letter', () => {
    const composed = '한글비밀번호를열다섯자로맞춘다'; // 15 letters
    expect(composed.normalize('NFC')).toHaveLength(15);
    expect(reason(composed)).toBeNull();
    expect(reason(composed.normalize('NFD'))).toBeNull();
    expect(reason(composed.slice(1))).toMatch(/at least 15/);
  });

  it('rejects control and invisible characters', () => {
    expect(reason('correct horse\u200Bbattery staple')).toMatch(/invisible|control/);
    expect(reason('correct horse\nbattery staple')).toMatch(/invisible|control/);
    expect(reason('correct horse\uFEFFbattery staple')).toMatch(/invisible|control/);
  });

  it('agrees with the web password policy on the same inputs', () => {
    const samples = [
      'Xk9$mQ2!vL7pRt',
      'Xk9$mQ2!vL7pRtB',
      'Xk9$mQ2!'.repeat(8),
      'Xk9$mQ2!'.repeat(8) + 'z',
      '한글비밀번호를열다섯자로맞춘다',
      '한글비밀번호를열다섯자로맞춘다'.normalize('NFD'),
      'correct horse\u200Bbattery staple',
      'correct horse battery staple',
      'password-correct-horse-battery-staple',
      'someone-is-here-1234567',
      'aaaaaaaaaaaaaaaa',
      '1234567890123456',
      'Transcultural1234',
    ];
    for (const sample of samples) {
      let web = true;
      try {
        normalizeNewPassword(sample, sample, 'someone');
      } catch {
        web = false;
      }
      expect(checkPasswordPolicy(sample, 'someone').ok, sample).toBe(web);
    }
  });

  it('rejects passwords that contain the username, ignoring case', () => {
    expect(reason('MyEditor-Is-Great-2026', 'editor')).toMatch(/username/);
    expect(reason('xxEDITORxxxxxxxxxx', 'editor')).toMatch(/username/);
  });

  it('ignores a username too short to be meaningful', () => {
    expect(reason('ab-correct-horse-battery', 'ab')).toBeNull();
  });

  it('rejects a single repeated character, a repeating unit and plain sequences', () => {
    expect(reason('aaaaaaaaaaaaaaaa')).toMatch(/repetitive|sequence/);
    expect(reason('ababababababababab')).toMatch(/repetitive|sequence/);
    expect(reason('123123123123123')).toMatch(/repetitive|sequence/);
    expect(reason('123456789012345')).toMatch(/repetitive|sequence/);
    expect(reason('987654321098765')).toMatch(/repetitive|sequence/);
    expect(reason('abcdefghijklmno')).toMatch(/repetitive|sequence/);
  });

  it.each([
    'password1234567',
    'Password!!!!!!!!!!',
    'qwertyuiop123456',
    'letmein48291573',
    'Transcultural1234',
    'TheTCN-2026!!!!!!',
    'iloveyou12345678',
    'administrator1234',
  ])('rejects a common word with decoration: %s', (password) => {
    expect(reason(password, 'someone')).toMatch(/common/);
  });

  it('allows a common word buried in a genuinely long phrase', () => {
    expect(reason('password-correct-horse-battery-staple', 'someone')).toBeNull();
  });
});
