export interface UserState {
  id: string;
  status: string;
  role: string;
  isExecutive: boolean;
  canAccessDirectorsForum?: boolean;
}
export class UserChangeError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}
export function requireUserManager(actor: UserState | null): asserts actor is UserState {
  if (!actor || actor.status !== 'approved' || actor.role !== 'officer' || !actor.isExecutive) {
    throw new UserChangeError('forbidden', 403);
  }
}
export function validateUserChange(
  actor: UserState,
  target: UserState,
  kind: 'status' | 'permissions',
  input: unknown,
) {
  requireUserManager(actor);
  if (target.id === actor.id || target.isExecutive)
    throw new UserChangeError('protected_user', 403);
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new UserChangeError('invalid_payload', 400);
  const value = input as Record<string, unknown>;
  const state = {
    status: target.status,
    role: target.role,
    isExecutive: target.isExecutive,
    canAccessDirectorsForum: target.canAccessDirectorsForum === true,
  };
  if (kind === 'status') {
    if (value.status !== 'approved' && value.status !== 'rejected')
      throw new UserChangeError('invalid_status', 400);
    if (!(
      target.status === 'pending' ||
      (target.status === 'rejected' && value.status === 'approved')
    ))
      throw new UserChangeError('transition_conflict', 409);
    return { ...state, status: value.status };
  }
  if (target.status !== 'approved') throw new UserChangeError('transition_conflict', 409);
  if (
    (value.role !== 'member' && value.role !== 'officer') ||
    typeof value.isExecutive !== 'boolean' ||
    typeof value.canAccessDirectorsForum !== 'boolean' ||
    (value.isExecutive && value.role !== 'officer') ||
    (value.canAccessDirectorsForum && value.role !== 'member')
  )
    throw new UserChangeError('invalid_permissions', 400);
  return {
    ...state,
    role: value.role,
    isExecutive: value.isExecutive,
    canAccessDirectorsForum: value.canAccessDirectorsForum,
  };
}
