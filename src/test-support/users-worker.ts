// Bundled only by the isolated verification harness; never registered as an application route.
import { mutateUser, type UserMutationInput } from '../lib/users/repository';
export default {
  async fetch(request: Request, env: { DB: D1Database }) {
    const input = (await request.json()) as UserMutationInput & {
      boundary?: 'demote' | 'promote' | 'revision';
    };
    const database = input.boundary
      ? ({
          prepare: env.DB.prepare.bind(env.DB),
          batch: async (queries: D1PreparedStatement[]) => {
            if (input.boundary === 'demote')
              await env.DB.prepare('UPDATE users SET is_executive=0 WHERE id=?')
                .bind(input.actorId)
                .run();
            if (input.boundary === 'promote')
              await env.DB.prepare("UPDATE users SET role='officer',is_executive=1 WHERE id=?")
                .bind(input.targetId)
                .run();
            if (input.boundary === 'revision')
              await env.DB.prepare('UPDATE users SET revision=revision+1 WHERE id=?')
                .bind(input.targetId)
                .run();
            return env.DB.batch(queries);
          },
        } as unknown as D1Database)
      : env.DB;
    try {
      return Response.json({ ok: true, user: await mutateUser(database, input) });
    } catch (error) {
      const failure = error as { status?: number; code?: string };
      return Response.json(
        { ok: false, error: failure.code ?? 'internal_error' },
        { status: failure.status ?? 500 },
      );
    }
  },
};
