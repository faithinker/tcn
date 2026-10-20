import type { APIRoute } from 'astro';
import { handleAccountMutation } from '../../../lib/account/route';
import { updateProfile } from '../../../lib/account/repository';
export const prerender = false;
export const PATCH: APIRoute = ({ request }) =>
  handleAccountMutation(request, async (db, user, body) => ({
    profile: await updateProfile(db, user, body),
  }));
