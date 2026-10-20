import { expect, it } from 'vitest';
import { permissionState, userMutationMessage } from './users-utils';
it('sends a complete permission state and clears member-only access for officers', () => {
  expect(permissionState('officer', true, true)).toEqual({
    role: 'officer',
    isExecutive: true,
    canAccessDirectorsForum: false,
  });
  expect(permissionState('member', true, true)).toEqual({
    role: 'member',
    isExecutive: false,
    canAccessDirectorsForum: true,
  });
});
it('distinguishes stale state from forbidden and retryable transport failure', () => {
  expect(userMutationMessage(409)).toContain('Reload');
  expect(userMutationMessage(403)).toContain('permission');
  expect(userMutationMessage(0)).toContain('Retry');
});
