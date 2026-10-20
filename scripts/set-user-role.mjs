#!/usr/bin/env node
// Final state: --role officer|member, --executive only for officer; omitted executive
// clears it. Both roles explicitly clear special forum access. Every update bumps revision.
// Ordinary: <username> --role officer|member [--executive] --actor <executive-username>
// Initial two executives / protected-account recovery only:
//   <username> --role officer|member [--executive] --bootstrap --reason <change-ticket>
// Bootstrap is an explicit out-of-UI exception, prints before/after + reason to stdout,
// and cannot write user_audit_events because 0010 forbids self/protected audit entries.
// Retain stdout in the operator change ticket; do not use bootstrap for ordinary changes.
// Shared: [--request-id <8-128 ASCII letters/digits/_/->] [--dry-run] [--remote]
//         [--persist-to <local-state-dir>] (--persist-to cannot be combined with --remote).
// Dry run makes NO D1 calls: prints preflight SQL and named snapshot parameters. Ordinary
// execution fills these from preflight and sends UPDATE + audit INSERT as one atomic batch.
import { runAdminCli } from './lib/user-admin-operations.mjs';
await runAdminCli('role');
