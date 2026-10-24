import { env } from 'cloudflare:workers';
import { hashPassword } from '../lib/auth/password';
import { getUserById } from '../lib/db/users';
import { AccountError } from '../lib/account/policy';
import { reauthenticate, replacePassword, withdrawAccount } from '../lib/account/repository';
export default {
  async fetch(request: Request) {
    const db = (env as unknown as { DB: D1Database }).DB;
    const action = new URL(request.url).pathname;
    if (action === '/setup') {
      await db
        .prepare(
          "INSERT INTO users(id,username,password_hash) VALUES ('probe','probe@example.org',?)",
        )
        .bind(await hashPassword('Original phrase beside the river'))
        .run();
      await db
        .prepare(
          "INSERT INTO auth_email_challenges(id,purpose,email,proof_hash,expires_at,created_at,consumed_at) VALUES ('used-signup','signup','probe@example.org','proof',9999999999,1,1)",
        )
        .run();
      await db
        .prepare(
          "INSERT INTO users(id,username,password_hash) VALUES ('burst','burst@example.org',?)",
        )
        .bind(await hashPassword('Original phrase beside the river'))
        .run();
      return Response.json({ ok: true });
    }
    if (action === '/reauth-burst') {
      // Parallel wrong guesses: only the first five may reach the password check.
      const burst = (await getUserById(db, 'burst'))!;
      const outcomes = await Promise.all(
        Array.from({ length: 8 }, () =>
          reauthenticate(db, burst, 'wrong').then(
            () => 'accepted',
            (error: unknown) => (error instanceof AccountError ? error.code : String(error)),
          ),
        ),
      );
      return Response.json({ outcomes });
    }
    const user = await getUserById(db, 'probe');
    if (!user) return Response.json({ error: 'missing' }, { status: 401 });
    try {
      if (action === '/password') {
        await reauthenticate(db, user, 'Original phrase beside the river');
        await replacePassword(
          db,
          user,
          'Updated phrase beside the river',
          'Updated phrase beside the river',
        );
      } else if (action === '/withdraw-stale') {
        // A session snapshot that an earlier password change or withdrawal already outdated.
        await withdrawAccount(
          db,
          { ...user, sessionVersion: user.sessionVersion - 1 },
          'd1-withdrawal-stale',
        );
      } else if (action === '/withdraw') {
        await reauthenticate(db, user, 'Updated phrase beside the river');
        await withdrawAccount(db, user, 'd1-withdrawal-0001');
      }
      return Response.json({ ok: true });
    } catch (error) {
      if (error instanceof AccountError)
        return Response.json({ error: error.code }, { status: error.status });
      return Response.json({ error: String(error) }, { status: 400 });
    }
  },
};
