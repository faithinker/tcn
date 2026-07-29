import type { APIRoute } from 'astro';
import { getDB } from '../../../../lib/db';
import {
  parseAnswerPayload,
  QNA_LIMITS,
  QnaPayloadError,
  readJsonWithLimit,
} from '../../../../lib/qna/payload';
import {
  QnaNotFoundError,
  QnaRevisionConflictError,
  upsertOfficialAnswer,
} from '../../../../lib/qna/repository';
import { qnaJson } from '../../../../lib/qna/response';
import { QnaSecurityError, requireAdminMutation } from '../../../../lib/qna/security';

export const prerender = false;

function routeError(error: unknown): Response | null {
  if (error instanceof QnaSecurityError) {
    return qnaJson({ ok: false, error: error.code }, { status: error.status });
  }
  if (error instanceof QnaNotFoundError) {
    return qnaJson({ ok: false, error: 'not_found' }, { status: 404 });
  }
  if (error instanceof QnaRevisionConflictError) {
    return qnaJson({ ok: false, error: 'revision_conflict' }, { status: 409 });
  }
  return null;
}

export const PUT: APIRoute = async ({ request, params }) => {
  let admin: { uid: string };
  try {
    admin = await requireAdminMutation(request);
  } catch (error) {
    return routeError(error) ?? qnaJson({ ok: false, error: 'forbidden' }, { status: 403 });
  }
  const questionId = params.id;
  if (!questionId) return qnaJson({ ok: false, error: 'missing_id' }, { status: 400 });

  let input: unknown;
  try {
    input = await readJsonWithLimit(request, QNA_LIMITS.requestBytes);
  } catch (error) {
    const code = error instanceof QnaPayloadError ? error.message : 'invalid_json';
    return qnaJson(
      { ok: false, error: code },
      { status: code === 'payload_too_large' ? 413 : 400 },
    );
  }
  const parsed = parseAnswerPayload(input);
  if (!parsed.ok) return qnaJson({ ok: false, error: parsed.error }, { status: 400 });

  try {
    const answer = await upsertOfficialAnswer(getDB(), {
      questionId,
      body: parsed.value.body,
      actorUserId: admin.uid,
      expectedRevision: parsed.value.expectedRevision,
      requestId: crypto.randomUUID(),
    });
    return qnaJson({ ok: true, answer });
  } catch (error) {
    return routeError(error) ?? qnaJson({ ok: false, error: 'internal_error' }, { status: 500 });
  }
};
