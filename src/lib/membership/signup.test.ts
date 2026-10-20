import { describe, expect, it } from 'vitest';
import { validateSignup } from './signup';

const valid = {
  email: '  Researcher@Example.ORG ',
  password: 'A river carries many stories',
  passwordConfirmation: 'A river carries many stories',
  displayName: ' Researcher ',
  affiliation: ' University ',
};
describe('signup input', () => {
  it('normalizes email and trims public profile fields', () => {
    expect(validateSignup(valid)).toEqual({
      ok: true,
      value: {
        username: 'researcher@example.org',
        password: valid.password,
        displayName: 'Researcher',
        affiliation: 'University',
      },
    });
  });
  it.each([
    'role',
    'status',
    'isExecutive',
    'is_executive',
    'canAccessDirectorsForum',
    'can_access_directors_forum',
    'sessionVersion',
  ])('rejects injected %s', (key) => {
    expect(validateSignup({ ...valid, [key]: false })).toMatchObject({
      ok: false,
      error: 'invalid_fields',
    });
  });
  it.each([
    null,
    [],
    { ...valid, email: 'invalid' },
    { ...valid, email: 'x'.repeat(255) + '@example.org' },
    { ...valid, displayName: '' },
    { ...valid, displayName: 'x'.repeat(101) },
    { ...valid, affiliation: 'x'.repeat(201) },
    { ...valid, password: 'short' },
    { ...valid, password: 'x'.repeat(129) },
    { ...valid, password: 'password123456' },
  ])('rejects invalid input %j', (input) => {
    expect(validateSignup(input).ok).toBe(false);
  });
  it('allows omitted affiliation but requires strings for supplied values', () => {
    const { affiliation, ...input } = valid;
    expect(validateSignup(input)).toMatchObject({ ok: true, value: { affiliation: null } });
    expect(validateSignup({ ...input, affiliation: {} }).ok).toBe(false);
  });
  it.each(['Admin', '관리자', 'Withdrawn member', 'ＴＣＮ', 'Secretariat'])(
    'blocks reserved display name %s',
    (displayName) => {
      expect(validateSignup({ ...valid, displayName })).toMatchObject({
        ok: false,
        error: 'reserved_name',
      });
    },
  );
  it('requires matching password confirmation', () => {
    expect(validateSignup({ ...valid, passwordConfirmation: 'different value' }).ok).toBe(false);
    const { passwordConfirmation, ...missing } = valid;
    expect(validateSignup(missing).ok).toBe(false);
  });
  it('accepts 15–64 code points without imposing a symbol requirement', () => {
    for (const password of ['several quiet rivers', 'a'.repeat(64), '🌊'.repeat(15)]) {
      expect(validateSignup({ ...valid, password, passwordConfirmation: password }).ok).toBe(true);
    }
    for (const password of [
      'a'.repeat(14),
      'a'.repeat(65),
      'a'.repeat(15) + '\u200b',
      'a'.repeat(15) + '\n',
    ]) {
      expect(validateSignup({ ...valid, password, passwordConfirmation: password }).ok).toBe(false);
    }
  });
  it('normalizes new Unicode passwords consistently before confirmation and hashing', () => {
    const password = 'A long cafe\u0301 beside the river';
    expect(
      validateSignup({ ...valid, password, passwordConfirmation: password.normalize('NFC') }),
    ).toMatchObject({
      ok: true,
      value: { password: password.normalize('NFC') },
    });
  });
});
