import { securityNotice } from '../../../lib/account/mail';
import { mailBindings } from '../../../lib/account/public-route';
import type { APIRoute } from 'astro';
import { handleAccountMutation, onlyFields } from '../../../lib/account/route';
import { reauthenticate, withdrawAccount } from '../../../lib/account/repository';
import { AccountError } from '../../../lib/account/policy';
export const prerender = false;
export const POST: APIRoute = ({ request }) =>
  handleAccountMutation(
    request,
    async (db, user, body) => {
      onlyFields(body, ['currentPassword', 'confirmation', 'requestId']);
      if (body.confirmation !== true || typeof body.requestId !== 'string')
        throw new AccountError('invalid_fields');
      await reauthenticate(db, user, body.currentPassword);
      await withdrawAccount(db, user, body.requestId);
      await securityNotice(db, request, mailBindings(), user.username, 'withdrawal');
      return { redirectTo: '/account/withdrawn' };
    },
    true,
  );
