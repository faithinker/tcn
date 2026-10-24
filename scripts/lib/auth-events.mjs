// The local gates delete their fixture accounts, but the sign-in log keeps a row per sign-in and refuses to delete
// a young one. Lift that one trigger for the fixtures' rows and restore it in the same statement batch.
import { readFileSync } from 'node:fs';

const trigger = readFileSync(
  new URL('../../migrations/0013_auth_events.sql', import.meta.url),
  'utf8',
).match(/CREATE TRIGGER auth_events_no_early_delete[\s\S]*?END;/)[0];

/** `userIds` is SQL for an IN list: a quoted id literal or a `select id from users where ...` subquery. */
export function deleteAuthEventsSql(userIds) {
  return `DROP TRIGGER auth_events_no_early_delete; DELETE FROM auth_events WHERE user_id IN (${userIds}); ${trigger}`;
}
