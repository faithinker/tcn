#!/usr/bin/env node
// <username> (--allow|--revoke) --actor <approved-executive-username>
// [--request-id <8-128 ASCII letters/digits/_/->] [--dry-run] [--remote]
// [--persist-to <local-state-dir>] (local only).
// Only approved members may be targeted, including when revoking access. Self and
// existing executive changes are forbidden. Writes increment revision and record
// actor/requestId/before/after atomically in user_audit_events. No bootstrap bypass.
// Dry run prints preflight and parameterized batch SQL without querying D1.
import { runAdminCli } from './lib/user-admin-operations.mjs';
await runAdminCli('forum');
