import type { APIRoute } from 'astro';
import { getSessionUser } from '../../../lib/auth';
import { canAccess } from '../../../lib/auth/permissions';
import { memberFeaturesEnabled } from '../../../lib/member-features';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const user = await getSessionUser(request);
  if (!user)
    return Response.json({
      ok: true,
      authenticated: false,
      memberFeaturesEnabled: memberFeaturesEnabled(),
    });

  return Response.json({
    ok: true,
    authenticated: true,
    memberFeaturesEnabled: memberFeaturesEnabled(),
    capabilities: {
      directorsForum:
        memberFeaturesEnabled() && canAccess(user, { kind: 'forum.read', board: 'directors' }),
      assemblyForum:
        memberFeaturesEnabled() && canAccess(user, { kind: 'forum.read', board: 'assembly' }),
      manageUsers: memberFeaturesEnabled() && canAccess(user, { kind: 'users.list' }),
      manageContent: canAccess(user, { kind: 'seminar.write' }),
    },
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
    },
  });
};
