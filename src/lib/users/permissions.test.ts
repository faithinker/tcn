import { expect, it } from 'vitest';
import { validateUserChange } from './permissions';

const actor = { id: 'actor', status: 'approved', role: 'officer', isExecutive: true } as const;
const target = {
  id: 'target',
  status: 'pending',
  role: 'member',
  isExecutive: false,
  canAccessDirectorsForum: false,
  revision: 1,
} as const;
it('allows only explicit status transitions', () => {
  expect(validateUserChange(actor, target, 'status', { status: 'approved' })).toEqual({
    status: 'approved',
    role: 'member',
    isExecutive: false,
    canAccessDirectorsForum: false,
  });
  expect(() =>
    validateUserChange(actor, { ...target, status: 'approved' }, 'status', { status: 'rejected' }),
  ).toThrow('transition_conflict');
});
it('protects self and every raw executive including pending/rejected', () => {
  for (const status of ['pending', 'approved', 'rejected'] as const) {
    expect(() =>
      validateUserChange(actor, { ...target, status, isExecutive: true }, 'status', {
        status: 'approved',
      }),
    ).toThrow('protected_user');
  }
  expect(() =>
    validateUserChange(actor, { ...target, id: actor.id }, 'status', { status: 'approved' }),
  ).toThrow('protected_user');
});
it('requires approved officer executive actors and approved permission targets', () => {
  for (const change of [{ status: 'pending' }, { role: 'member' }, { isExecutive: false }]) {
    expect(() =>
      validateUserChange({ ...actor, ...change }, target, 'status', { status: 'approved' }),
    ).toThrow('forbidden');
  }
  expect(() =>
    validateUserChange(actor, target, 'permissions', {
      role: 'member',
      isExecutive: false,
      canAccessDirectorsForum: true,
    }),
  ).toThrow('transition_conflict');
});
it('validates the complete final permissions without coercion', () => {
  const approved = { ...target, status: 'approved' };
  for (const value of [
    { role: 'member', isExecutive: true, canAccessDirectorsForum: false },
    { role: 'officer', isExecutive: false, canAccessDirectorsForum: true },
    { role: 'officer', isExecutive: 1, canAccessDirectorsForum: false },
    { role: 'officer', isExecutive: false },
  ]) {
    expect(() => validateUserChange(actor, approved, 'permissions', value)).toThrow(
      'invalid_permissions',
    );
  }
  expect(
    validateUserChange(actor, approved, 'permissions', {
      role: 'member',
      isExecutive: false,
      canAccessDirectorsForum: true,
    }),
  ).toMatchObject({ canAccessDirectorsForum: true });
});
