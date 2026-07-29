import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db/client', () => ({
  newId: vi.fn().mockReturnValueOnce('question-id').mockReturnValue('audit-id'),
}));

import {
  createQuestion,
  listAdminQuestions,
  listPublicQuestions,
  QnaNotFoundError,
  QnaRevisionConflictError,
  setQuestionVisibility,
  upsertOfficialAnswer,
} from './repository';

function result(results: unknown[] = [], changes = 0) {
  return { results, success: true, meta: { changes } };
}

function questionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'q-1',
    title: 'Title',
    body: 'Body',
    askerUserId: null,
    visibility: 'visible',
    questionRevision: 1,
    createdAt: '2026-07-29T00:00:00.000Z',
    updatedAt: '2026-07-29T00:00:00.000Z',
    answerBody: null,
    answeredBy: null,
    answerRevision: null,
    answerCreatedAt: null,
    answerUpdatedAt: null,
    ...overrides,
  };
}

describe('Q&A repository pagination', () => {
  it('paginates visible questions by a stable created_at/id order', async () => {
    const first = vi.fn().mockResolvedValue({ total: 21 });
    const all = vi.fn().mockResolvedValue({ results: [{ id: 'q-21' }] });
    const prepare = vi
      .fn()
      .mockReturnValueOnce({ bind: vi.fn(() => ({ first })) })
      .mockReturnValueOnce({ bind: vi.fn((...args) => ({ all, args })) });
    const db = { prepare } as unknown as D1Database;

    const page = await listPublicQuestions(db, { status: 'answered', page: 2 });

    expect(page).toMatchObject({ page: 2, pageSize: 20, total: 21, totalPages: 2 });
    expect(prepare.mock.calls[0][0]).toContain("q.visibility = 'visible'");
    expect(prepare.mock.calls[0][0]).toContain('a.question_id is not null');
    expect(prepare.mock.calls[1][0]).toContain('order by q.created_at desc, q.id desc');
    expect(prepare.mock.results[1].value.bind).toHaveBeenCalledWith(20, 20);
  });

  it('sorts the administrator waiting queue oldest first', async () => {
    const first = vi.fn().mockResolvedValue({ total: 2 });
    const all = vi.fn().mockResolvedValue({ results: [] });
    const prepare = vi
      .fn()
      .mockReturnValueOnce({ first })
      .mockReturnValueOnce({ bind: vi.fn(() => ({ all })) });
    const db = { prepare } as unknown as D1Database;

    await listAdminQuestions(db, { status: 'waiting', page: 1 });

    expect(prepare.mock.calls[0][0]).toContain('a.question_id is null');
    expect(prepare.mock.calls[1][0]).toContain('order by q.created_at asc, q.id asc');
  });
});

describe('Q&A repository writes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a visible question with only server-controlled identity fields', async () => {
    const run = vi.fn().mockResolvedValue(result([], 1));
    const first = vi.fn().mockResolvedValue(questionRow({ id: 'question-id' }));
    const prepare = vi
      .fn()
      .mockReturnValueOnce({ bind: vi.fn(() => ({ run })) })
      .mockReturnValueOnce({ bind: vi.fn(() => ({ first })) });
    const db = { prepare } as unknown as D1Database;

    await expect(
      createQuestion(db, { title: 'Title', body: 'Body', askerUserId: 'admin-1' }),
    ).resolves.toMatchObject({
      id: 'question-id',
      visibility: 'visible',
      revision: 1,
      answer: null,
    });

    expect(prepare.mock.calls[0][0]).toContain(
      'insert into qna_questions (id, title, body, asker_user_id)',
    );
  });

  it('creates the first answer and audit event in one batch', async () => {
    const first = vi
      .fn()
      .mockResolvedValueOnce(questionRow())
      .mockResolvedValueOnce(
        questionRow({
          answerBody: 'Answer',
          answeredBy: 'admin-1',
          answerRevision: 1,
          answerCreatedAt: '2026-07-29T00:00:01.000Z',
          answerUpdatedAt: '2026-07-29T00:00:01.000Z',
        }),
      );
    const bind = vi.fn((...args: unknown[]) => ({ args }));
    const prepare = vi
      .fn()
      .mockReturnValueOnce({ bind: vi.fn(() => ({ first })) })
      .mockReturnValueOnce({ bind })
      .mockReturnValueOnce({ bind })
      .mockReturnValueOnce({ bind: vi.fn(() => ({ first })) });
    const batch = vi.fn().mockResolvedValue([result([], 1), result([{ question_id: 'q-1' }], 1)]);
    const db = { prepare, batch } as unknown as D1Database;

    const answer = await upsertOfficialAnswer(db, {
      questionId: 'q-1',
      body: 'Answer',
      actorUserId: 'admin-1',
      expectedRevision: 0,
      requestId: 'request-1',
    });

    expect(answer.revision).toBe(1);
    expect(batch).toHaveBeenCalledTimes(1);
    expect(prepare.mock.calls[1][0]).toContain('insert into qna_audit_events');
    expect(prepare.mock.calls[2][0]).toContain('insert into qna_answers');
  });

  it('rejects a stale answer revision before writing', async () => {
    const first = vi.fn().mockResolvedValue(
      questionRow({
        answerBody: 'Current',
        answeredBy: 'admin-1',
        answerRevision: 2,
        answerCreatedAt: '2026-07-29T00:00:01.000Z',
        answerUpdatedAt: '2026-07-29T00:00:01.000Z',
      }),
    );
    const prepare = vi.fn(() => ({ bind: vi.fn(() => ({ first })) }));
    const batch = vi.fn();
    const db = { prepare, batch } as unknown as D1Database;

    await expect(
      upsertOfficialAnswer(db, {
        questionId: 'q-1',
        body: 'Stale',
        actorUserId: 'admin-1',
        expectedRevision: 1,
        requestId: 'request-2',
      }),
    ).rejects.toBeInstanceOf(QnaRevisionConflictError);
    expect(batch).not.toHaveBeenCalled();
  });

  it('returns not found without an audit write when the question is absent', async () => {
    const first = vi.fn().mockResolvedValue(null);
    const prepare = vi.fn(() => ({ bind: vi.fn(() => ({ first })) }));
    const batch = vi.fn();
    const db = { prepare, batch } as unknown as D1Database;

    await expect(
      setQuestionVisibility(db, {
        questionId: 'missing',
        visibility: 'hidden',
        actorUserId: 'admin-1',
        expectedRevision: 1,
        requestId: 'request-3',
      }),
    ).rejects.toBeInstanceOf(QnaNotFoundError);
    expect(batch).not.toHaveBeenCalled();
  });

  it('changes visibility with CAS and an atomic privacy-minimal audit event', async () => {
    const first = vi
      .fn()
      .mockResolvedValueOnce(questionRow({ questionRevision: 3 }))
      .mockResolvedValueOnce(questionRow({ visibility: 'hidden', questionRevision: 4 }));
    const bind = vi.fn((...args: unknown[]) => ({ args }));
    const prepare = vi
      .fn()
      .mockReturnValueOnce({ bind: vi.fn(() => ({ first })) })
      .mockReturnValueOnce({ bind })
      .mockReturnValueOnce({ bind })
      .mockReturnValueOnce({ bind: vi.fn(() => ({ first })) });
    const batch = vi.fn().mockResolvedValue([result([], 1), result([{ id: 'q-1' }], 1)]);
    const db = { prepare, batch } as unknown as D1Database;

    const question = await setQuestionVisibility(db, {
      questionId: 'q-1',
      visibility: 'hidden',
      actorUserId: 'admin-1',
      expectedRevision: 3,
      requestId: 'request-4',
    });

    expect(question.revision).toBe(4);
    expect(prepare.mock.calls[1][0]).not.toContain('body');
    expect(prepare.mock.calls[2][0]).toContain('revision = ?3');
  });
});
