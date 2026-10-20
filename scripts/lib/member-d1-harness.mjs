// Run migrations against an isolated workerd D1 instance, never the developer or remote database.
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { unstable_splitSqlQuery } from 'wrangler';

const root = new URL('../../', import.meta.url);

export async function openMemberD1Harness(workerEntry) {
  const script = workerEntry
    ? (
        await build({
          entryPoints: [fileURLToPath(new URL(workerEntry, root))],
          bundle: true,
          write: false,
          format: 'esm',
          platform: 'browser',
          target: 'es2022',
          external: ['cloudflare:workers'],
        })
      ).outputFiles[0].text
    : 'export default { fetch() { return new Response("member D1 harness"); } };';
  const runtime = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script,
      compatibilityDate: '2026-07-25',
      compatibilityFlags: ['nodejs_compat'],
      d1Databases: { DB: 'tcn-member-harness' },
      bindings: {
        MEMBER_FEATURES_ENABLED: 'true',
        SIGNUP_ENABLED: 'true',
        SESSION_SECRET: 'isolated-member-harness-secret',
      },
    }),
  );
  try {
    const db = await runtime.getD1Database('DB');
    const dir = new URL('migrations/', root);
    for (const file of (await readdir(dir)).filter((name) => name.endsWith('.sql')).sort()) {
      for (const sql of unstable_splitSqlQuery(await readFile(new URL(file, dir), 'utf8'))) {
        await db.prepare(sql).run();
      }
    }
    return {
      db,
      fetch: (...args) => runtime.dispatchFetch(...args),
      dispose: () => runtime.dispose(),
    };
  } catch (error) {
    await runtime.dispose();
    throw error;
  }
}
