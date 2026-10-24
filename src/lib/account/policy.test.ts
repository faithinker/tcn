import { describe, expect, it } from 'vitest';
import { AccountError, normalizeEmail } from './policy';

describe('normalizeEmail', () => {
  it.each([
    ['a@example.org', 'a@example.org'],
    ['  First.Last+tag@Sub.Example.ORG ', 'first.last+tag@sub.example.org'],
    ["o'brien@example.org", "o'brien@example.org"],
    ['jörg@example.org', 'jörg@example.org'],
    ['user@xn--80ak6aa92e.com', 'user@xn--80ak6aa92e.com'],
  ])('accepts %j', (input, expected) => {
    expect(normalizeEmail(input)).toBe(expected);
  });

  it.each([
    'evil<victim@x.com>',
    'victim@x.com>',
    'a"b@x.com',
    'a,b@x.com',
    'a;b@x.com',
    '(c)a@x.com',
    'a[b]@x.com',
    'a\\b@x.com',
    'a\u0001@x.com',
    'a b@x.com',
    'two@@x.com',
    'a@localhost',
    '',
    `${'a'.repeat(250)}@x.com`,
  ])('rejects %j', (input) => {
    expect(() => normalizeEmail(input)).toThrow(AccountError);
  });

  it('rejects a value that is not a string', () => {
    expect(() => normalizeEmail(undefined)).toThrow(AccountError);
    expect(() => normalizeEmail(['a@x.com'])).toThrow(AccountError);
  });
});
