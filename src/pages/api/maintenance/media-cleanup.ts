import type { APIRoute } from 'astro';
import { requireOfficer } from '../../../lib/auth';
import {
  completeMediaCleanup,
  getBucket,
  getDB,
  listMediaCleanupKeys,
  recordMediaCleanupFailure,
} from '../../../lib/db';

export const prerender = false;

// 인증된 운영자가 호출하는 idempotent reconciliation endpoint.
export const POST: APIRoute = async ({ request }) => {
  const guard = await requireOfficer(request);
  if (!guard.ok) return guard.response;

  const db = getDB();
  const bucket = getBucket();
  const keys = await listMediaCleanupKeys(db);
  let completed = 0;
  let failed = 0;

  for (const key of keys) {
    try {
      await bucket.delete(key);
      await completeMediaCleanup(db, key);
      completed += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : 'R2 cleanup failed';
      console.error('media cleanup: retry failed', { key, error });
      await recordMediaCleanupFailure(db, key, message);
    }
  }

  return Response.json({
    ok: true,
    attempted: keys.length,
    completed,
    failed,
  });
};
