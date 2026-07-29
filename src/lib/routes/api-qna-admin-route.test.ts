import { beforeEach, describe, expect, it, vi } from 'vitest';

const { env, getDB, requireAdminMutation, setQuestionVisibility, upsertOfficialAnswer } =
  vi.hoisted(() => ({
    env: { SESSION_SECRET: 'session-secret' },
    getDB: vi.fn(() => ({})),
    requireAdminMutation: vi.fn(),
    setQuestionVisibility: vi.fn(),
    upsertOfficialAnswer: vi.fn(),
  }));

vi.mock('cloudflare:workers', () => ({ env }));
vi.mock('../db', () => ({ getDB }));
vi.mock('../qna/security', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../qna/security')>()),
  requireAdminMutation,
}));
vi.mock('../qna/repository', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../qna/repository')>()),
  setQuestionVisibility,
  upsertOfficialAnswer,
}));

import { PUT } from '../../pages/api/questions/[id]/answer';
import { PATCH } from '../../pages/api/questions/[id]/visibility';
import { QnaNotFoundError, QnaRevisionConflictError } from '../qna/repository';
import { QnaSecurityError } from '../qna/security';

function context(method: string, body: unknown) {
  return {
    request: new Request('https://tcn.example/api/questions/q-1/action', {
      method,
      headers: {
        'content-type': 'application/json',
        origin: 'https://tcn.example',
        'sec-fetch-site': 'same-origin',
        cookie: 'tcn_session=session',
        'x-csrf-token': 'csrf',
      },
      body: JSON.stringify(body),
    }),
    params: { id: 'q-1' },
  } as never;
}

describe('administrator Q&A mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminMutation.mockResolvedValue({ uid: 'admin-1' });
    upsertOfficialAnswer.mockResolvedValue({ questionId: 'q-1', revision: 1, body: 'Answer' });
    setQuestionVisibility.mockResolvedValue({ id: 'q-1', visibility: 'hidden', revision: 2 });
  });

  it('publishes an official answer with the session actor and request ID', async () => {
    const response = await PUT!(context('PUT', { body: 'Answer', expectedRevision: 0 }));
    expect(response.status).toBe(200);
    expect(upsertOfficialAnswer).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        questionId: 'q-1',
        actorUserId: 'admin-1',
        expectedRevision: 0,
        requestId: expect.any(String),
      }),
    );
  });

  it('runs the common guard before opening the DB boundary', async () => {
    requireAdminMutation.mockRejectedValue(new QnaSecurityError('unauthorized', 401));
    const response = await PUT!(context('PUT', { body: 'Answer', expectedRevision: 0 }));
    expect(response.status).toBe(401);
    expect(getDB).not.toHaveBeenCalled();
  });

  it.each([
    [new QnaNotFoundError(), 404, 'not_found'],
    [new QnaRevisionConflictError(), 409, 'revision_conflict'],
  ])('maps answer repository errors to the API contract', async (error, status, code) => {
    upsertOfficialAnswer.mockRejectedValue(error);
    const response = await PUT!(context('PUT', { body: 'Answer', expectedRevision: 0 }));
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: code });
  });

  it('rejects mass-assigned answered_by before writing', async () => {
    const response = await PUT!(
      context('PUT', { body: 'Answer', expectedRevision: 0, answeredBy: 'forged' }),
    );
    expect(response.status).toBe(400);
    expect(upsertOfficialAnswer).not.toHaveBeenCalled();
  });

  it('hides and restores with visibility CAS', async () => {
    const response = await PATCH!(context('PATCH', { visibility: 'hidden', expectedRevision: 1 }));
    expect(response.status).toBe(200);
    expect(setQuestionVisibility).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        visibility: 'hidden',
        actorUserId: 'admin-1',
        expectedRevision: 1,
      }),
    );
  });

  it('guards visibility mutations before opening the DB boundary', async () => {
    requireAdminMutation.mockRejectedValue(new QnaSecurityError('invalid_csrf', 403));

    const response = await PATCH!(context('PATCH', { visibility: 'hidden', expectedRevision: 1 }));

    expect(response.status).toBe(403);
    expect(getDB).not.toHaveBeenCalled();
  });

  it.each([
    [new QnaNotFoundError(), 404, 'not_found'],
    [new QnaRevisionConflictError(), 409, 'revision_conflict'],
  ])('maps visibility repository errors to the API contract', async (error, status, code) => {
    setQuestionVisibility.mockRejectedValue(error);

    const response = await PATCH!(context('PATCH', { visibility: 'hidden', expectedRevision: 1 }));

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: code });
  });

  it('rejects visibility mass assignment before writing', async () => {
    const response = await PATCH!(
      context('PATCH', {
        visibility: 'hidden',
        expectedRevision: 1,
        actorUserId: 'forged',
      }),
    );

    expect(response.status).toBe(400);
    expect(setQuestionVisibility).not.toHaveBeenCalled();
  });
});
