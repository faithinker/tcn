import { describe, expect, it } from 'vitest';
import { canAccess, meetsRequirement, tierOf, type SessionUser } from './permissions';

const advisor = {
  id: 'advisor',
  username: 'advisor',
  displayName: 'Advisor',
  role: 'member',
  status: 'approved',
  isExecutive: false,
  canAccessDirectorsForum: true,
} as SessionUser;

describe('special directors forum access', () => {
  it('allows an approved member to read, write and edit their own directors post', () => {
    expect(tierOf(advisor)).toBe('member');
    expect(canAccess(advisor, { kind: 'forum.read', board: 'directors' })).toBe(true);
    expect(canAccess(advisor, { kind: 'forum.write', board: 'directors' })).toBe(true);
    expect(
      canAccess(advisor, { kind: 'forum.edit', board: 'directors', authorId: advisor.id }),
    ).toBe(true);
    expect(
      canAccess(advisor, { kind: 'forum.delete', board: 'directors', authorId: advisor.id }),
    ).toBe(true);
  });
  it('does not grant operational or executive permissions', () => {
    for (const kind of [
      'seminar.write',
      'media.write',
      'qna.answer',
      'users.list',
      'users.decide',
    ] as const) {
      expect(canAccess(advisor, { kind })).toBe(false);
    }
    expect(meetsRequirement(advisor, 'officer')).toBe(false);
    expect(canAccess(advisor, { kind: 'forum.edit', board: 'directors', authorId: 'other' })).toBe(
      false,
    );
    expect(
      canAccess(advisor, { kind: 'forum.delete', board: 'directors', authorId: 'other' }),
    ).toBe(false);
  });
  it.each(['pending', 'rejected'] as const)('ignores special access when %s', (status) => {
    expect(canAccess({ ...advisor, status }, { kind: 'forum.read', board: 'directors' })).toBe(
      false,
    );
  });
  it('revokes access and own-post mutations immediately', () => {
    const revoked = { ...advisor, canAccessDirectorsForum: false } as SessionUser;
    for (const kind of ['forum.read', 'forum.write', 'forum.edit', 'forum.delete'] as const) {
      expect(canAccess(revoked, { kind, board: 'directors', authorId: advisor.id })).toBe(false);
    }
  });
});
