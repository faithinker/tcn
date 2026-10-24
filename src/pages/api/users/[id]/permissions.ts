import type { APIRoute } from 'astro';
import { handleUserMutation } from '../../../../lib/users/route';
export const prerender = false;
export const PATCH: APIRoute = ({ request, params }) =>
  handleUserMutation(request, params.id, 'permissions');
