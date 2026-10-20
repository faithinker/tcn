import { expect, it } from 'vitest';
import { openTestD1 } from './d1';
it('rolls an entire D1 batch back when a later statement fails', async () => {
  const test = await openTestD1();
  try {
    await expect(
      test.db.batch([
        test.db.prepare(
          "insert into users (id,username,password_hash) values ('batch-user','batch-user','hash')",
        ),
        test.db.prepare('insert into missing_table values (1)'),
      ]),
    ).rejects.toThrow();
    const row = await test.db
      .prepare("select count(*) as count from users where id = 'batch-user'")
      .first<{ count: number }>();
    expect(row?.count).toBe(0);
  } finally {
    await test.dispose();
  }
});
