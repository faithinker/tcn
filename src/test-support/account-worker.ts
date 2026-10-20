import { env } from 'cloudflare:workers';
import { hashPassword } from '../lib/auth/password';
import { getUserById } from '../lib/db/users';
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
      return Response.json({ ok: true });
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
      } else if (action === '/withdraw') {
        await reauthenticate(db, user, 'Updated phrase beside the river');
        await withdrawAccount(db, user, 'd1-withdrawal-0001');
      }
      return Response.json({ ok: true });
    } catch (error) {
      return Response.json({ error: String(error) }, { status: 400 });
    }
  },
};
