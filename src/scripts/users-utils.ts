export function permissionState(
  role: string,
  isExecutive: boolean,
  canAccessDirectorsForum: boolean,
) {
  return {
    role,
    isExecutive: role === 'officer' && isExecutive,
    canAccessDirectorsForum: role === 'member' && canAccessDirectorsForum,
  };
}
export function userMutationMessage(status: number): string {
  if (status === 409)
    return 'This account changed or the request conflicts with an earlier decision. Reload the latest state before trying again.';
  if (status === 403)
    return 'Your permission or this account’s protection changed. Reload before continuing.';
  if (status === 400)
    return 'Check the selected permissions. Executive authority requires Officer; special forum access requires Member.';
  if (status === 404) return 'This account is no longer available. Reload the user list.';
  if (status === 503) return 'User management is temporarily unavailable. Try again later.';
  return 'The change could not be confirmed. Retry the same action to safely check its result.';
}
