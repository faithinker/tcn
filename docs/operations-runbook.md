# TCN Operations Runbook

## Release invariants

- Production deploys run only from `main` through the protected `production` GitHub Environment.
- D1 migrations must be additive and compatible with the currently deployed Worker.
- The workflow records a D1 Time Travel bookmark, applies migrations, deploys, waits for the deployed version to serve all traffic, then checks `/`, `/api/health`, and `/api/ready`.
- The version gate stands between the deploy and the smoke tests. It reads the version id out of the `wrangler deploy` output and polls `wrangler deployments status` up to twelve times, five seconds apart, until that id is the one serving 100% of traffic; it fails the job if the id never gets there or if the deploy output carried no version id. Without the gate a smoke test can be answered by the previous version and pass while the version just uploaded stays untested.
- A failed post-deploy smoke test automatically runs `wrangler rollback`. The additive D1 schema remains compatible with the restored Worker.
- Automatic rollback is gated on the smoke step itself failing. A version-gate failure skips the smoke step, so nothing rolls back: the job goes red with the newly uploaded version already deployed and never verified. Treat that outcome as an unverified production release and follow "After a failed version gate" below.

## Environment isolation

Production uses `tcn-content` and `tcn-media`. Staging must use separately created `tcn-content-staging` and `tcn-media-staging` resources. Copy `wrangler.staging.jsonc.example` to an ignored local configuration after replacing the D1 ID; never point staging at production bindings.

Apply and deploy staging explicitly:

```bash
npx wrangler d1 migrations apply tcn-content-staging --remote --config wrangler.staging.jsonc
npm run build
npx wrangler deploy --config wrangler.staging.jsonc
```

## Recovery objectives

- D1 target RPO: one minute within the Cloudflare Time Travel retention window.
- R2 target RPO: 24 hours after an external backup bucket is configured.
- Target RTO: two hours for D1 restore plus Worker rollback and media verification.
- Run a restore drill at least quarterly and record the bookmark, duration, and sampled media checks.

## D1 recovery

The deployment summary contains the bookmark captured immediately before migration.

```bash
npx wrangler d1 time-travel info tcn-content
npx wrangler d1 time-travel restore tcn-content --bookmark=<confirmed-bookmark>
```

Time Travel restore overwrites the live database. Record the current bookmark first, obtain incident approval, restore, then verify `/api/ready`, one seminar listing, one seminar detail, `/questions` with one question detail, and admin login. The five `qna_*` tables live in this same database, so a restore moves the Q&A board back in time along with everything else — questions and answers written after the bookmark are gone.

## R2 recovery and cleanup

Cloudflare R2 does not replace an independent recovery copy for this application. Configure a separate backup bucket or external S3-compatible target and synchronize `tcn-media` at least daily. The backup credential must be read-only on production and write-only on the backup target where possible.

Application deletes first enter `media_cleanup_queue`. R2 failures remain queued and public delivery is already blocked by the D1 media record. An authenticated operator can retry up to 50 entries per call:

```bash
curl --fail --request POST \
  --header 'Origin: https://tcn.faithinker12.workers.dev' \
  --cookie 'tcn_session=<operator-session>' \
  https://tcn.faithinker12.workers.dev/api/maintenance/media-cleanup
```

Alert if queued rows remain for more than 24 hours or attempts exceed 10.

## Media delivery load

Public media is served with `Cache-Control: public, max-age=0, must-revalidate`, so every view revalidates: one Worker invocation, one D1 read to confirm the item is still public, and one conditional R2 GET. Bodies are usually answered `304`, so the pressure is on request count rather than bandwidth — a gallery page with ten photographs costs ten requests each time it is opened.

This is deliberate. The content rule is that a photograph must stop being served the moment consent is withdrawn, with no grace window in browsers that already loaded it. R2 keys are unique per upload, so content never changes; caching is withheld only to keep revocation immediate.

Review the policy when either signal appears:

- Worker requests stay above roughly half the free-plan allowance (100k/day).
- D1 rows read approach their limit, with `/media/[...key]` as the dominant reader.

The mitigation is a short `max-age` (around 300s) in `src/pages/media/[...key].ts`, accepting that a deletion takes up to that long to disappear everywhere. If that delay is unacceptable, build a purge path on delete before adding cache time.

## Q&A table growth

`qna_turnstile_tokens` prunes itself. Every accepted siteverify deletes the rows whose `expires_at` has passed in the same `db.batch` that inserts the new digest (`src/lib/qna/security.ts`), so the table stays close to the tokens issued in the last five minutes. Pruning is opportunistic — it only runs when a question is submitted — so expired rows sit there through quiet periods.

`qna_rate_limits` prunes itself the same way. After each allowed submission the handler deletes the rows whose daily and short windows have both lapsed (`src/lib/qna/security.ts`), so a row lives about 24 hours past its last submission. A quiet period leaves lapsed rows in place until the next submission. There is no cron trigger and no maintenance route for this table. The privacy policy states this 24-hour period, so change both together. Check the size if growth looks unusual:

```bash
npx wrangler d1 execute tcn-content --remote \
  --command 'select count(*) from qna_rate_limits'
```

`qna_audit_events` grows without bound too, one row per administrator answer or visibility change. That table is the audit record — do not prune it.

## Personal-information erasure requests

The privacy policy (`src/data/privacy-policy.ko.md`, chapters 5 and 12) promises that an erasure request for a post or question is handled by the operator within 10 days. Account holders erase their own account at `/account`; this section covers text that a person wrote in a forum post or a Q&A question.

1. Confirm the request with the privacy officer and record the date, the post or question URL and the action. Do not copy the erased text into the record.
2. Verify the requester. A forum post belongs to its author's account. A guest Q&A question has no owner, so erase it only when the requester shows that the text concerns them.
3. Blank the content; do not delete the row. `qna_audit_events` and the forum author link reference these rows, so a hard delete fails or loses the audit trail. The statements below keep every foreign key and constraint valid. Run them with `--local` first, then with `--remote` only on the owner's go-ahead.

```sql
-- Q&A question (clears the asker link and hides it). Add the answer statement only
-- when the official answer repeats the personal information.
UPDATE qna_questions
   SET title='[Removed at the author''s request]', body='[Removed at the author''s request]',
       asker_user_id=NULL, visibility='hidden', revision=revision+1,
       updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
 WHERE id='<question id>';
UPDATE qna_answers
   SET body='[Removed at the author''s request]', revision=revision+1,
       updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
 WHERE question_id='<question id>';

-- Forum post (also hides it when it is still visible).
UPDATE forum_posts
   SET title='[Removed at the author''s request]', body='[Removed at the author''s request]',
       revision=revision+1, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),
       deleted_at=COALESCE(deleted_at, strftime('%Y-%m-%dT%H:%M:%fZ','now')),
       deleted_by=COALESCE(deleted_by, author_id)
 WHERE id='<post id>';
```

4. Select the row again and confirm that the title and body show the placeholder.
5. D1 Time Travel keeps the earlier state for 30 days. After any restore to a point before an erasure, run the logged erasures again.

## Account roles and executive authority

Roles are officer/member; statuses are pending/approved/rejected. Approved officers manage seminars, media and official Q&A answers. Approved members with can_access_directors_forum=1 (auditors/advisers) can also use the Directors Forum without these operational permissions. Read all permissions from D1 per request.

Approved executives (officer + is_executive=1) use /admin/users for approvals and final permission changes to other approved non-executive accounts. Their own account and any existing executive account are protected, including from status changes; newly promoted executives become protected immediately. User changes and before/after audit records are one atomic D1 operation with revision checks and request-ID retries.

Routine operator changes require an actor and support --dry-run:

```bash
node scripts/create-user.mjs <username> --role officer --display "Name" --remote
node scripts/set-user-role.mjs <username> --role officer --actor <executive-username> --remote --dry-run
node scripts/set-user-forum-access.mjs <username> --allow --actor <executive-username> --remote --dry-run
```

Role changes specify the full result: omitted --executive clears executive authority, and role commands clear special forum access. Use the separate forum-access command to grant/revoke access for approved members. Ordinary operations increment revision, recheck the actor/target, and atomically insert user_audit_events. Preserve the printed requestId to retry interrupted requests with --request-id. A dry run does not query D1; it prints the preflight and snapshot-based SQL template, not a claim that the target has been checked.

Initial executive setup or protected-executive recovery requires the explicit exceptional path:

```bash
node scripts/set-user-role.mjs <username> --role officer --executive --bootstrap --reason "<change-ticket>" --remote --dry-run
```

Remove --dry-run only after reviewing the actual account and approved change. Bootstrap/recovery cannot use the ordinary audit table (which forbids protected/self changes); it prints an explicit BOOTSTRAP/BREAKGLASS record containing reason, requestId and before/after snapshots. Retain that output in the operator change record. Granting officer authority requires an approved account. create-user reads a hidden password prompt or TCN_USER_PASSWORD, never a password argument.

### Integrated release roster

Keep MEMBER_FEATURES_ENABLED=false while migrations/code and initial permissions are being applied. Gate-off member routes return 503 and their menu links stay hidden. Before opening the gate:

1. Read the operating accounts and match actual usernames to src/data/members.json; never infer a match from a similar name.
2. Assign the president and senior vice president executive authority. The senior vice president is included.
3. Assign the three directors officer/approved without executive authority.
4. Assign the auditor and senior adviser member/approved plus special Directors Forum access. They lose seminar/media/official-answer operations but retain both forums and public Q&A questions.
5. Resolve unrecognized accounts and missing display names before opening private content. Re-query permissions and smoke-test each group.
6. Open MEMBER_FEATURES_ENABLED only after verification; keep SIGNUP_ENABLED=false until public-signup prerequisites and activation approval are satisfied.
7. Before SIGNUP_ENABLED, confirm every item in section A of `docs/privacy-policy.ko.md`. The `/privacy` page ships with the code and states those facts as true.

Migrations 0008–0013 are additive; the deploy workflow applies them before code after recording a Time Travel bookmark. Validate the complete implementation locally before one integrated release. Remote changes and deployment require user authorization.

## Monthly access-log review

The privacy policy (`src/data/privacy-policy.ko.md`, chapters 2, 4, 5 and 9) states that executives' views of `/admin/users` are logged, kept for 13 months and reviewed monthly. The legal basis is article 8 of 「개인정보의 안전성 확보조치 기준」. TCN has no internal management plan (article 4(1) proviso: an association below 10,000 data subjects may omit it), so this section is where the review cycle, method and follow-up are fixed. The monthly cycle is TCN's own choice, not a statutory interval.

What is recorded:

- `admin_access_events`: one row per rendered `/admin/users` page (actor, time, IP as `cf-connecting-ip`, `scope` such as `status=pending;page=1`, `subject_ids` as the JSON list of accounts shown, `subject_count`). Invalid arguments, guard failures and redirects write nothing. A failed write answers `503 access_log_unavailable` and the page is not shown.
- `user_audit_events.ip`: the IP of the executive who approved, rejected or changed permissions. Rows from before migration 0012 have `NULL`.
- `auth_events` (migration 0013): one row per sign-in success, sign-in failure, new lock and sign-out (`event`, `user_id`, `ip` as `cf-connecting-ip`, `staff`, time). `staff` is 1 for an approved officer at the time of the event. A failed attempt on an unknown username has `user_id` NULL, and the typed username and password are never stored. Attempts turned away by an existing lock or by Turnstile write nothing, so an attack cannot fill the table. A failed write logs `{"event":"auth_log_failed","kind":...}` to Workers observability. For an approved officer a failed `login_success` write is tried once more with the same id (a blip that the retry absorbs logs `{"event":"auth_log_retried"}` as a warning instead); if the retry fails too it answers `503 auth_log_unavailable` and issues no session (the password was right, so it is not counted as a failure and the officer can simply try again), so an officer never gets in without a record. For every other account, and for failures, locks and sign-outs, the sign-in goes on; look for the log line before trusting a quiet period.
- Retention of `auth_events`: 395 days for `staff = 1`, 90 days for the rest. Triggers reject any `UPDATE` and any `DELETE` younger than that, and every recorded event deletes the expired rows of both classes.
- Triggers reject any `UPDATE` of an access event and any `DELETE` younger than 395 days. Each recorded view also deletes events older than 395 days and clears `user_audit_events.ip` older than 395 days, so the log stays trimmed while people use the site. A Cron Trigger (`17 18 * * *`, 03:17 KST; `src/worker.ts` and `triggers.crons` in `wrangler.jsonc`) also runs `purgeExpiredLogs` once a day, so expired rows go even when nobody signs in or opens the page. The same run deletes expired `auth_email_challenges` rows, which hold the email address of a signup or password-reset request, so an abandoned request does not keep it past its expiry (at most a day) on a quiet site. Each run writes `{"event":"log_retention_purged","accessEvents":…,"authEvents":…,"auditIps":…,"emailChallenges":…}` to Workers observability, or `log_retention_failed` and a failed invocation if a delete guard rejected the batch.

Not recorded: anything done with `wrangler d1 execute` or the Cloudflare dashboard. A Time Travel restore rolls the log back with the rest of the database; note the gap in the review record.

Reviewer: the privacy officer (수석부회장). The privacy officer's own rows are reviewed by another executive. Run the review with `npx wrangler d1 execute tcn-content --remote` only on the owner's go-ahead. Times below are shifted to KST.

```sql
-- 1. Views per executive per day over the last 31 days.
SELECT u.username, date(e.created_at,'unixepoch','+9 hours') AS day, count(*) AS views, max(e.subject_count) AS most_shown
  FROM admin_access_events e JOIN users u ON u.id=e.actor_id
 WHERE e.created_at > strftime('%s','now') - 31*86400
 GROUP BY u.username, day ORDER BY day DESC, views DESC;

-- 2. Views outside 07:00–23:00 KST.
SELECT u.username, datetime(e.created_at,'unixepoch','+9 hours') AS kst, e.ip, e.scope
  FROM admin_access_events e JOIN users u ON u.id=e.actor_id
 WHERE e.created_at > strftime('%s','now') - 31*86400
   AND CAST(strftime('%H',e.created_at,'unixepoch','+9 hours') AS INTEGER) NOT BETWEEN 7 AND 22
 ORDER BY e.created_at DESC;

-- 3. IPs seen this month that the same executive did not use earlier in the retention window.
SELECT u.username, e.ip, count(*) AS views, min(datetime(e.created_at,'unixepoch','+9 hours')) AS first_seen
  FROM admin_access_events e JOIN users u ON u.id=e.actor_id
 WHERE e.created_at > strftime('%s','now') - 31*86400
   AND NOT EXISTS (SELECT 1 FROM admin_access_events o WHERE o.actor_id=e.actor_id AND o.ip IS e.ip
                    AND o.created_at <= strftime('%s','now') - 31*86400)
 GROUP BY u.username, e.ip;

-- 4. Changes made this month, with the actor's IP, to match against the views above.
SELECT a.action, datetime(a.created_at,'unixepoch','+9 hours') AS kst, x.username AS actor, t.id AS target_id, a.ip
  FROM user_audit_events a JOIN users x ON x.id=a.actor_id JOIN users t ON t.id=a.target_id
 WHERE a.created_at > strftime('%s','now') - 31*86400 ORDER BY a.created_at DESC;

-- 5. Staff sign-ins and sign-outs this month, outside 07:00–23:00 KST or from an IP that account did not use earlier.
SELECT u.username, e.event, datetime(e.created_at,'unixepoch','+9 hours') AS kst, e.ip
  FROM auth_events e JOIN users u ON u.id=e.user_id
 WHERE e.staff=1 AND e.event IN ('login_success','logout') AND e.created_at > strftime('%s','now') - 31*86400
   AND (CAST(strftime('%H',e.created_at,'unixepoch','+9 hours') AS INTEGER) NOT BETWEEN 7 AND 22
        OR NOT EXISTS (SELECT 1 FROM auth_events o WHERE o.user_id=e.user_id AND o.ip IS e.ip AND o.event='login_success'
                        AND o.created_at <= strftime('%s','now') - 31*86400))
 ORDER BY e.created_at DESC;

-- 6. Failures and locks per IP over the last 31 days (an attack shows as one IP with many failures or locks).
SELECT ip, sum(event='login_failure') AS failures, sum(event='login_locked') AS locks,
       count(DISTINCT user_id) AS accounts, sum(user_id IS NULL) AS unknown_accounts
  FROM auth_events WHERE event IN ('login_failure','login_locked') AND created_at > strftime('%s','now') - 31*86400
 GROUP BY ip HAVING failures + locks >= 5 ORDER BY failures + locks DESC;

-- 7. A sign-in that succeeded soon after failures on the same account (possible guessed password).
SELECT u.username, datetime(s.created_at,'unixepoch','+9 hours') AS kst, s.ip, s.staff,
       (SELECT count(*) FROM auth_events f WHERE f.user_id=s.user_id AND f.event IN ('login_failure','login_locked')
          AND f.created_at BETWEEN s.created_at - 3600 AND s.created_at) AS failures_in_last_hour
  FROM auth_events s JOIN users u ON u.id=s.user_id
 WHERE s.event='login_success' AND s.created_at > strftime('%s','now') - 31*86400
   AND failures_in_last_hour >= 3 ORDER BY s.created_at DESC;

-- 8. Controls: triggers present (three on the access log, two on the sign-in log), oldest row, rows without an IP (expected only for local development).
SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name IN ('admin_access_events','auth_events');
SELECT datetime(min(created_at),'unixepoch','+9 hours') AS oldest, count(*) AS total,
       sum(ip IS NULL) AS without_ip FROM admin_access_events;
```

Read the results for: a view or change nobody can explain, a time of day or IP the executive does not normally use, a burst of views, an approval whose actor does not appear in the views, a missing trigger, or an oldest row far past 13 months (the daily purge is not running: check the Cron Trigger in the Cloudflare dashboard and the `log_retention_failed` line).

Follow-up for an unexplained entry: ask the executive in writing, keep the rows, and if the explanation does not hold remove that executive's authority with `set-user-role.mjs` and rotate `SESSION_SECRET` (signs everyone out). Record each review (date, reviewer, period covered, findings, follow-up) in the operator change record, outside D1 and without copying IP lists into chat or tickets.

## Readiness triage

`/api/ready` is fail closed. It answers `503` unless the `DB` and `MEDIA` bindings and all five of `SESSION_SECRET`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `QNA_TURNSTILE_HOSTNAMES`, and `QNA_RATE_LIMIT_SECRET` are present, and only reaches D1 and R2 after that check passes. A missing secret and broken code return the same `{"ok":false}`, and `/api/health` stays `200` through both — it is liveness only and checks nothing external.

So when readiness fails or a deploy rolls back, take the secret inventory before reading code. The command prints names and types, never values:

```bash
npx wrangler secret list
```

This is exactly what the 2026-07-29 incident was. The Q&A Turnstile secrets were missing, the Worker code was fine, and the deploy went green only because the smoke tests were answered by the previous version; the following deploy is the one that rolled back.

Rotating `SESSION_SECRET` signs every administrator out. Sessions are stateless HMAC-SHA256 tokens with no server-side record, so the moment the signing key changes every existing `tcn_session` cookie fails signature verification. The Q&A administrator CSRF token derives from the same secret, so open editing screens fail their next write until re-login.

## Administrator sign-in

Several independent layers stand between the internet and `/api/auth/login`. They are listed outermost first so an incident can be located by which one answered.

| Layer                                      | Where                                                                                                     | Answer when it stops a request                                                                |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| WAF rate limit (`Rate limit admin login`)  | Cloudflare dashboard, Security rules. Free plan: 5 requests per 10 seconds per IP, blocked for 10 seconds | `429` from Cloudflare, the Worker never runs                                                  |
| Turnstile challenge (action `admin_login`) | Worker, before any D1 access                                                                              | `403 turnstile_failed`; `503 security_not_configured` when the secret or host list is missing |
| Escalating lock                            | Worker, `auth_rate_limits`                                                                                | `429` with `Retry-After`: 15 minutes, then 1 hour, 4 hours, 24 hours as the cap               |

Five wrong passwords in 15 minutes lock an approved officer's account (any IP) and, separately, an IP. Any other account, and an unknown username, locks after ten, so the moment of the lock does not reveal who is registered; an IP is judged by the account being tried at that moment. Every further lock for the same identifier is longer; the level is forgotten after a week without activity. A successful sign-in clears the IP and device counters but keeps the account's lock level.

**Trusted browser.** A successful sign-in sets a `tcn_device` cookie (signed, HttpOnly, 90 days, sent only to `/api/auth/login`). A browser that presents it for the account it is signing in to skips the _account_ lock and is limited per device (ten attempts) and per IP instead, so an attacker cannot keep the real administrator out by spending guesses. Rotating `SESSION_SECRET` also invalidates these cookies; each administrator becomes an unknown browser until the next successful sign-in.

**Watching for attacks.** A new lock writes one `login_locked` line (lock length, whether the request came from a trusted browser, and a short prefix of the account hash — never the username or IP). Search for it in Workers observability. The same events, with the IP, are in `auth_events` (see "Monthly access-log review").

**An administrator is locked out and has no trusted browser.** Wait out `Retry-After`, or clear every login counter. The identifiers are hashed, so a single account cannot be picked out:

```bash
npx wrangler d1 execute tcn-content --remote --command 'delete from auth_rate_limits'
```

**Sign-in shows "The security check did not pass", or answers `403`/`503`.** The widget and the Worker must agree on the host. Check that the host being used is in the Turnstile widget's Hostnames (Cloudflare dashboard, Turnstile) **and** in the `QNA_TURNSTILE_HOSTNAMES` Worker secret (`npx wrangler secret list` shows whether it exists). If the widget cannot be fixed quickly, roll back to the previous version (see [Incident rollback](#incident-rollback)); there is deliberately no switch that turns the challenge off in production.

## Incident rollback

```bash
npx wrangler deployments status
npx wrangler rollback --yes --message "Incident rollback: <reason>"
```

After rollback, check `/api/health`, `/api/ready`, the home page, one D1-backed seminar, one R2 image, `/questions` with one question detail, and admin authentication. Do not restore D1 merely because Worker code was rolled back; use the recorded bookmark only when data or schema integrity is affected.

### After a failed version gate

The job stopped before the smoke tests and rolled nothing back, so a version no check ever exercised is deployed. Establish what is serving traffic and verify it by hand:

```bash
npx wrangler deployments status --json
curl --fail --silent --show-error --output /dev/null https://tcn.faithinker12.workers.dev/api/ready
```

Roll back if readiness fails or the live version is not the one intended. `wrangler rollback` with no version id resolves to the version uploaded before the latest — upload order, not the last version that passed a smoke test — so read the target id off the version list and pass it explicitly:

```bash
npx wrangler versions list
npx wrangler rollback <last-verified-version-id> --yes --message "Version gate failed: <reason>"
```

A gate failure reporting no version id in the deploy output means the workflow could not prove what it shipped. The deploy still happened; verify by hand in that case too.
