# TCN Operations Runbook

## Release invariants

- Production deploys run only from `main` through the protected `production` GitHub Environment.
- D1 migrations must be additive and compatible with the currently deployed Worker.
- The workflow records a D1 Time Travel bookmark, applies migrations, deploys, then checks `/`, `/api/health`, and `/api/ready`.
- A failed post-deploy smoke test automatically runs `wrangler rollback`. The additive D1 schema remains compatible with the restored Worker.

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

Time Travel restore overwrites the live database. Record the current bookmark first, obtain incident approval, restore, then verify `/api/ready`, one seminar listing, one seminar detail, and admin login.

## R2 recovery and cleanup

Cloudflare R2 does not replace an independent recovery copy for this application. Configure a separate backup bucket or external S3-compatible target and synchronize `tcn-media` at least daily. The backup credential must be read-only on production and write-only on the backup target where possible.

Application deletes first enter `media_cleanup_queue`. R2 failures remain queued and public delivery is already blocked by the D1 media record. An authenticated operator can retry up to 50 entries per call:

```bash
curl --fail --request POST \
  --cookie 'tcn_session=<operator-session>' \
  https://tcn.faithinker12.workers.dev/api/maintenance/media-cleanup
```

Alert if queued rows remain for more than 24 hours or attempts exceed 10.

## Incident rollback

```bash
npx wrangler deployments status
npx wrangler rollback --yes --message "Incident rollback: <reason>"
```

After rollback, check `/api/health`, `/api/ready`, the home page, one D1-backed seminar, one R2 image, and admin authentication. Do not restore D1 merely because Worker code was rolled back; use the recorded bookmark only when data or schema integrity is affected.
