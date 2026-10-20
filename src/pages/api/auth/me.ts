import type { APIRoute } from 'astro';
import {
  getSessionUser,
  createCsrfToken,
  getSessionSecret,
  readSessionToken,
} from '../../../lib/auth';
import { canAccess } from '../../../lib/auth/permissions';
import { memberFeaturesEnabled } from '../../../lib/member-features';
import { clearAccountCookies } from '../../../lib/account/cookies';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const user = await getSessionUser(request);
  if (!user) {
    const headers = new Headers();
    if (readSessionToken(request)) {
      clearAccountCookies(headers, new URL(request.url).protocol === 'https:');
    }
    return Response.json(
      {
        ok: true,
        authenticated: false,
        memberFeaturesEnabled: memberFeaturesEnabled(),
      },
      { headers },
    );
  }

  return Response.json({
    ok: true,
    authenticated: true,
    csrfToken: await createCsrfToken('account', readSessionToken(request)!, getSessionSecret()),
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
