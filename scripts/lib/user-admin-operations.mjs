// Operator CLI shared by role and forum access commands. No passwords or sessions are read.
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const wrangler = fileURLToPath(new URL('../../node_modules/.bin/wrangler', import.meta.url));
const columns = 'id, username, status, role, is_executive, can_access_directors_forum, revision';
const literal = (value) => {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value);
  if (typeof value !== 'string' || value.includes('\0')) throw new Error('Invalid SQL value');
  return `'${value.replace(/'/g, "''")}'`;
};

function parse(kind, argv) {
  const values = new Set([
    '--actor',
    '--request-id',
    '--persist-to',
    '--reason',
    ...(kind === 'role' ? ['--role'] : []),
  ]);
  const flags = new Set([
    '--remote',
    '--dry-run',
    ...(kind === 'role' ? ['--executive', '--bootstrap'] : ['--allow', '--revoke']),
  ]);
  const options = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    if (!values.has(arg) && !flags.has(arg)) throw new Error(`Unknown flag: ${arg}`);
    if (arg in options) throw new Error(`Duplicate flag: ${arg}`);
    if (values.has(arg)) {
      const value = argv[++i];
      if (!value || value.startsWith('--') || value.includes('\0'))
        throw new Error(`${arg} requires a value`);
      options[arg] = value;
    } else options[arg] = true;
  }
  if (positional.length !== 1 || !positional[0].trim() || positional[0].includes('\0'))
    throw new Error('Exactly one username is required');
  if (kind === 'role') {
    if (!['member', 'officer'].includes(options['--role']))
      throw new Error('--role officer|member is required');
    if (options['--executive'] && options['--role'] !== 'officer')
      throw new Error('--executive requires --role officer');
  } else if (Boolean(options['--allow']) === Boolean(options['--revoke']))
    throw new Error('Exactly one of --allow / --revoke is required');
  if (Boolean(options['--actor']) === Boolean(options['--bootstrap']))
    throw new Error('Specify exactly one of --actor username or --bootstrap --reason text');
  if (options['--bootstrap'] && !options['--reason']?.trim())
    throw new Error('--bootstrap requires --reason text');
  if (options['--reason'] && !options['--bootstrap'])
    throw new Error('--reason requires --bootstrap');
  if (options['--remote'] && options['--persist-to'])
    throw new Error('--persist-to is local only; cannot combine with --remote');
  const requestId = options['--request-id'] ?? randomUUID();
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(requestId))
    throw new Error(
      '--request-id must contain 8–128 ASCII letters, digits, underscores or hyphens',
    );
  return { ...options, kind, username: positional[0], requestId };
}

function assertActor(actor) {
  if (!actor || actor.status !== 'approved' || actor.role !== 'officer' || actor.is_executive !== 1)
    throw new Error('actor must be an approved executive officer');
}

function buildSql(o, before, actor) {
  // Named parameters in --dry-run are snapshots supplied by the preflight SELECT at execution.
  const b = (key) => (before ? literal(before[key]) : `:before_${key}`);
  const actorId = actor ? literal(actor.id) : ':actor_id';
  const role = o.kind === 'role' ? literal(o['--role']) : "'member'";
  const executive = o.kind === 'role' && o['--executive'] ? 1 : 0;
  // Role commands write the entire final permission state; forum access is separate and opt-in.
  const access = o.kind === 'forum' && o['--allow'] ? 1 : 0;
  const guards = [
    `username = ${literal(o.username)}`,
    `id = ${b('id')}`,
    `revision = ${b('revision')}`,
    `status = ${b('status')}`,
    `role = ${b('role')}`,
    `is_executive = ${b('is_executive')}`,
    `can_access_directors_forum = ${b('can_access_directors_forum')}`,
  ];
  // Exceptional recovery may clear roles on a non-approved protected account. It never grants
  // officer authority unless approved. Ordinary operations follow the same rules as the API.
  if (!o['--bootstrap'] || o['--role'] === 'officer') guards.push("status = 'approved'");
  if (!o['--bootstrap'])
    guards.push(
      `is_executive = 0`,
      `id <> ${actorId}`,
      `exists (select 1 from users actor where actor.id = ${actorId} and actor.username = ${literal(o['--actor'])} and actor.status = 'approved' and actor.role = 'officer' and actor.is_executive = 1)`,
    );
  if (o.kind === 'forum') guards.push("role = 'member'");
  const update = `update users set role = ${role}, is_executive = ${executive}, can_access_directors_forum = ${access}, revision = revision + 1\nwhere ${guards.join(' and ')};`;
  const verify = `select ${columns}, changes() as changed from users where username = ${literal(o.username)};`;
  if (o['--bootstrap']) return `${update}\n${verify}`;
  const fingerprint = createHash('sha256')
    .update(
      JSON.stringify(['operator-v1', o.kind, o.username, o['--role'] ?? null, executive, access]),
    )
    .digest('hex');
  const afterRevision = before ? String(before.revision + 1) : ':before_revision + 1';
  const audit = `insert into user_audit_events (id, target_id, actor_id, action, before_status, after_status, before_role, after_role, before_is_executive, after_is_executive, before_can_access_directors_forum, after_can_access_directors_forum, before_revision, after_revision, request_id, request_fingerprint, created_at)\nvalues (${literal(randomUUID())}, ${b('id')}, ${actorId}, 'permissions_changed', ${b('status')}, ${b('status')}, ${b('role')}, ${role}, ${b('is_executive')}, ${executive}, ${b('can_access_directors_forum')}, ${access}, ${b('revision')}, ${afterRevision}, ${literal(o.requestId)}, ${literal(fingerprint)}, ${Math.floor(Date.now() / 1000)});`;
  return `${update}\n${audit}\n${verify}`;
}

function defaultExecutor(o) {
  return async (sql) =>
    JSON.parse(
      execFileSync(
        wrangler,
        [
          'd1',
          'execute',
          'tcn-content',
          o['--remote'] ? '--remote' : '--local',
          ...(o['--persist-to'] ? ['--persist-to', o['--persist-to']] : []),
          '--command',
          sql,
          '--json',
        ],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, CI: '1' } },
      ),
    );
}

export async function runAdminOperation(kind, argv, dependencies = {}) {
  const o = parse(kind, argv);
  const log = dependencies.log ?? console.log;
  const execute = dependencies.execute ?? defaultExecutor(o);
  const preflight = `select ${columns} from users where username = ${literal(o.username)};`;
  const actorQuery = o['--actor']
    ? `select ${columns} from users where username = ${literal(o['--actor'])};`
    : '';
  const note = {
    mode: 'BOOTSTRAP/BREAKGLASS',
    reason: o['--reason'],
    requestId: o.requestId,
    target: o.username,
    environment: o['--remote'] ? 'remote' : 'local',
    note: 'Exceptional operator change; no user_audit_events row (0010 forbids self/protected changes). Retain this stdout record with the operator change ticket.',
  };
  if (o['--dry-run']) {
    if (o['--bootstrap']) log(`-- ${JSON.stringify(note)}`);
    log('-- DRY RUN: no SQL executed. Preflight snapshots become named parameters below.');
    log(`${preflight}\n${actorQuery}`);
    log('-- Execute UPDATE and audit INSERT together in one atomic D1 batch; never separately.');
    log(buildSql(o));
    return;
  }
  log(`requestId=${o.requestId}`);
  const before = (await execute(preflight))[0]?.results?.[0];
  if (!before) throw new Error('target user not found');
  let actor;
  if (!o['--bootstrap']) {
    actor = (await execute(actorQuery))[0]?.results?.[0];
    assertActor(actor);
    // Check successful retry before target protection: promotion itself makes the target protected.
    const existing = (
      await execute(`select * from user_audit_events where request_id = ${literal(o.requestId)};`)
    )[0]?.results?.[0];
    if (existing) {
      const fingerprint = createHash('sha256')
        .update(
          JSON.stringify([
            'operator-v1',
            o.kind,
            o.username,
            o['--role'] ?? null,
            o.kind === 'role' && o['--executive'] ? 1 : 0,
            o.kind === 'forum' && o['--allow'] ? 1 : 0,
          ]),
        )
        .digest('hex');
      if (
        existing.actor_id !== actor.id ||
        existing.target_id !== before.id ||
        existing.request_fingerprint !== fingerprint
      )
        throw new Error('request_id conflict');
      log(
        JSON.stringify({
          requestId: o.requestId,
          replayed: true,
          revision: existing.after_revision,
        }),
      );
      return existing;
    }
    if (actor.id === before.id) throw new Error('self change forbidden');
    if (before.is_executive === 1)
      throw new Error(
        'protected executive: use explicit --bootstrap --reason for operator recovery',
      );
  }
  if ((!o['--bootstrap'] || o['--role'] === 'officer') && before.status !== 'approved')
    throw new Error('target must be approved');
  if (o.kind === 'forum' && before.role !== 'member')
    throw new Error('forum access requires an approved member');
  const sql = buildSql(o, before, actor);
  // Wrangler local uses db.batch; its remote /query submits this complete command atomically.
  const results = await execute(sql);
  const after = results.at(-1)?.results?.[0];
  if (!after || after.revision !== before.revision + 1 || (o['--bootstrap'] && after.changed !== 1))
    throw new Error('revision conflict: update not applied');
  if (o['--bootstrap']) log(JSON.stringify({ ...note, before, after }));
  else log(JSON.stringify({ requestId: o.requestId, actor: actor.username, before, after }));
  return after;
}

export async function runAdminCli(kind) {
  try {
    await runAdminOperation(kind, process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(
      'If execution was interrupted, inspect the audit requestId and current user before retrying.',
    );
    process.exitCode = 1;
  }
}
