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

`qna_rate_limits` is never pruned. One row is one HMAC-derived client key, and both windows reset in place inside a single UPSERT, so the row outlives its lapsed counters and nothing deletes it. There is no cron trigger and no maintenance route for this table. It grows with the number of distinct submitting clients and never shrinks; watching its size is the operator's job.

```bash
npx wrangler d1 execute tcn-content --remote \
  --command 'select count(*) from qna_rate_limits'
```

`qna_audit_events` grows without bound too, one row per administrator answer or visibility change. That table is the audit record — do not prune it.

## Readiness triage

`/api/ready` is fail closed. It answers `503` unless the `DB` and `MEDIA` bindings and all five of `SESSION_SECRET`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `QNA_TURNSTILE_HOSTNAMES`, and `QNA_RATE_LIMIT_SECRET` are present, and only reaches D1 and R2 after that check passes. A missing secret and broken code return the same `{"ok":false}`, and `/api/health` stays `200` through both — it is liveness only and checks nothing external.

So when readiness fails or a deploy rolls back, take the secret inventory before reading code. The command prints names and types, never values:

```bash
npx wrangler secret list
```

This is exactly what the 2026-07-29 incident was. The Q&A Turnstile secrets were missing, the Worker code was fine, and the deploy went green only because the smoke tests were answered by the previous version; the following deploy is the one that rolled back.

Rotating `SESSION_SECRET` signs every administrator out. Sessions are stateless HMAC-SHA256 tokens with no server-side record, so the moment the signing key changes every existing `tcn_session` cookie fails signature verification. The Q&A administrator CSRF token derives from the same secret, so open editing screens fail their next write until re-login.

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
