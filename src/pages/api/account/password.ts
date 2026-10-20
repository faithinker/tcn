import { assertPasswordNotBreached } from '../../../lib/account/password-safety';
import { securityNotice } from '../../../lib/account/mail';
import { mailBindings } from '../../../lib/account/public-route';
import type { APIRoute } from 'astro';
import { handleAccountMutation, onlyFields } from '../../../lib/account/route';
import { reauthenticate, replacePassword } from '../../../lib/account/repository';
export const prerender = false;
export const POST: APIRoute = ({ request }) =>
  handleAccountMutation(
    request,
    async (db, user, body) => {
      onlyFields(body, ['currentPassword', 'newPassword', 'passwordConfirmation']);
      await reauthenticate(db, user, body.currentPassword);
      await replacePassword(db, user, body.newPassword, body.passwordConfirmation, (value) =>
        assertPasswordNotBreached(value, request, mailBindings()),
      );
      await securityNotice(db, request, mailBindings(), user.username, 'password');
      return { redirectTo: '/login?notice=password-changed' };
    },
    true,
  );
