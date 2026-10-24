import assert from 'node:assert/strict';
import { openMemberD1Harness } from './lib/member-d1-harness.mjs';

const harness = await openMemberD1Harness();
const { db } = harness;
try {
  await db
    .prepare("insert into users (id,username,password_hash) values ('author','author','hash')")
    .run();
  assert.equal(
    (
      await db
        .prepare("select can_access_directors_forum as value from users where id='author'")
        .first()
    ).value,
    0,
  );
  await db
    .prepare(
      "insert into forum_posts (id,board,title,body,author_id) values ('post','assembly','Title','Body','author')",
    )
    .run();
  for (const sql of [
    "update users set can_access_directors_forum=2 where id='author'",
    "update forum_posts set board='officer' where id='post'",
    "update forum_posts set title=' ' where id='post'",
    "update forum_posts set title=char(0) where id='post'",
    "update forum_posts set body='' where id='post'",
    "update forum_posts set author_id='missing' where id='post'",
    "update forum_posts set revision=0 where id='post'",
    "update forum_posts set deleted_at='now' where id='post'",
  ])
    await assert.rejects(() => db.prepare(sql).run());
  await assert.rejects(() =>
    db.batch([
      db.prepare("update forum_posts set title='Must roll back' where id='post'"),
      db.prepare("update forum_posts set revision=0 where id='post'"),
    ]),
  );
  assert.equal(
    (await db.prepare("select title from forum_posts where id='post'").first()).title,
    'Title',
  );
  await db
    .prepare(
      "update forum_posts set deleted_at='now',deleted_by='author',revision=revision+1 where id='post'",
    )
    .run();
  assert.equal(
    (await db.prepare("select revision from forum_posts where id='post'").first()).revision,
    2,
  );
  console.log(
    'PASS: workerd D1 forum defaults, constraints, hidden-post integrity and atomic rollback',
  );
} finally {
  await harness.dispose();
}
