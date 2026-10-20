import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('audits real D1 permission operations, rejects protected targets, and rolls back audit failure', () => {
  const result = spawnSync(
    process.execPath,
    [
      '-e',
      `
    import assert from 'node:assert/strict';
    import { openMemberD1Harness } from './scripts/lib/member-d1-harness.mjs';
    const { runAdminOperation } = await import('./scripts/lib/user-admin-operations.mjs');
    const harness = await openMemberD1Harness();
    const {db} = harness;
    const logs=[];
    const execute=async sql => { const { unstable_splitSqlQuery }=await import('wrangler'); return db.batch(unstable_splitSqlQuery(sql).map(s=>db.prepare(s))); };
    const run=async (kind,flags) => runAdminOperation(kind,flags,{execute,log:s=>logs.push(s)});
    const get=()=>db.prepare("select * from users where id='member'").first();
    const args=['member','--actor','president','--request-id','operation-123'];
    try {
      await db.prepare("insert into users(id,username,password_hash,status,role,is_executive) values ('president','president','hash','approved','officer',1),('member','member','hash','approved','member',0),('pending','pending','hash','pending','member',0),('vice','vice','hash','approved','officer',1)").run();
      await run('forum',[...args,'--allow']);
      assert.equal((await get()).can_access_directors_forum,1);
      assert.equal((await get()).revision,2);
      const audit=await db.prepare('select * from user_audit_events').first();
      assert.equal(audit.actor_id,'president'); assert.equal(audit.request_id,'operation-123');
      assert.equal(audit.before_revision,1); assert.equal(audit.after_revision,2);
      assert.equal(audit.before_can_access_directors_forum,0); assert.equal(audit.after_can_access_directors_forum,1);
      await run('forum',[...args,'--allow']);
      assert.equal((await get()).revision,2,'same request is idempotent');
      await assert.rejects(run('forum',[...args,'--revoke']),/request.*conflict/);
      for(const target of ['president','vice','pending']) {
        await assert.rejects(run('role',[target,'--role','member','--actor','president']),/protected|approved|self/);
      }
      await run('role',['member','--role','officer','--actor','president','--request-id','operation-456']);
      assert.equal((await get()).can_access_directors_forum,0); assert.equal((await get()).is_executive,0);
      await assert.rejects(run('forum',['member','--allow','--actor','president']),/member/);
      await db.prepare("CREATE TRIGGER fail_script_audit BEFORE INSERT ON user_audit_events BEGIN SELECT RAISE(ABORT,'forced audit failure'); END").run();
      const before=await get();
      await assert.rejects(run('role',['member','--role','member','--actor','president']),/forced audit failure/);
      assert.deepEqual(await get(),before,'audit failure rolls back the user UPDATE');
      await db.prepare('drop trigger fail_script_audit').run();
      // Interleave changes after preflight but before the atomic mutation batch.
      for (const race of ["update users set revision=revision+1 where id='member'", "update users set is_executive=1 where id='member'", "update users set is_executive=0 where id='president'"]) {
        const countBefore=(await db.prepare('select count(*) n from user_audit_events').first()).n;
        let interleaved=false;
        const racingExecute=async sql=>{
          if(sql.startsWith('update users set') && !interleaved) {interleaved=true;await db.prepare(race).run();}
          return execute(sql);
        };
        await assert.rejects(runAdminOperation('role',['member','--role','member','--actor','president'],{execute:racingExecute,log:()=>{}}),/user_change_conflict|user_actor_forbidden/);
        assert.equal((await db.prepare('select count(*) n from user_audit_events').first()).n,countBefore);
        assert.equal((await get()).role,'officer','rejected mutation did not change target role');
        await db.prepare("update users set is_executive=0 where id='member'").run();
        await db.prepare("update users set is_executive=1 where id='president'").run();
      }
      await db.prepare("update users set is_executive=0 where id='president'").run();
      await assert.rejects(run('forum',[...args,'--allow']),/actor/);
      await run('role',['president','--role','officer','--executive','--bootstrap','--reason','Initial president']);
      assert.equal((await db.prepare("select revision from users where id='president'").first()).revision,2);
      assert.ok(logs.some(s=>s.includes('BOOTSTRAP/BREAKGLASS')));
      const count=await db.prepare('select count(*) n from user_audit_events').first(); assert.equal(count.n,2);
    } finally { await harness.dispose(); }
  `,
    ],
    { cwd: fileURLToPath(new URL('../../../', import.meta.url)), encoding: 'utf8', timeout: 60000 },
  );
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
}, 65000);

it('runs the actual role and forum CLI against an isolated --persist-to D1', async () => {
  const { mkdtempSync, readFileSync, readdirSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const state = mkdtempSync(join(tmpdir(), 'tcn-user-cli-'));
  const execute = (sql: string) => {
    const result = spawnSync(
      join(root, 'node_modules/.bin/wrangler'),
      [
        'd1',
        'execute',
        'tcn-content',
        '--local',
        '--persist-to',
        state,
        '--command',
        `select 1;\n${sql}`,
        '--json',
      ],
      { cwd: root, encoding: 'utf8', env: { ...process.env, CI: '1' } },
    );
    expect(result.status, result.stderr).toBe(0);
    return JSON.parse(result.stdout).slice(1);
  };
  const cli = (script: string, args: string[]) => {
    const result = spawnSync(
      process.execPath,
      [join(root, 'scripts', script), ...args, '--persist-to', state],
      { cwd: root, encoding: 'utf8' },
    );
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    return result.stdout;
  };
  try {
    const migrations = readdirSync(join(root, 'migrations'))
      .filter((f) => f.endsWith('.sql'))
      .sort();
    execute(migrations.map((f) => readFileSync(join(root, 'migrations', f), 'utf8')).join('\n'));
    execute(
      "insert into users(id,username,password_hash,status,role) values ('exec','president','hash','approved','member'),('member','member','hash','approved','member');",
    );
    expect(
      cli('set-user-role.mjs', [
        'president',
        '--role',
        'officer',
        '--executive',
        '--bootstrap',
        '--reason',
        'Isolated initial executive',
      ]),
    ).toContain('BOOTSTRAP/BREAKGLASS');
    cli('set-user-forum-access.mjs', [
      'member',
      '--allow',
      '--actor',
      'president',
      '--request-id',
      'cli-allow-123',
    ]);
    const [audit] = execute(
      'select actor_id,request_id,before_revision,after_revision,after_can_access_directors_forum from user_audit_events;',
    )[0].results;
    expect(audit).toMatchObject({
      actor_id: 'exec',
      request_id: 'cli-allow-123',
      before_revision: 1,
      after_revision: 2,
      after_can_access_directors_forum: 1,
    });
    cli('set-user-forum-access.mjs', [
      'member',
      '--revoke',
      '--actor',
      'president',
      '--request-id',
      'cli-revoke-123',
    ]);
    expect(
      execute("select revision,can_access_directors_forum from users where id='member'")[0]
        .results[0],
    ).toEqual({ revision: 3, can_access_directors_forum: 0 });
  } finally {
    rmSync(state, { recursive: true, force: true });
  }
}, 65000);
