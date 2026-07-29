import { QNA_LIMITS, QnaPayloadError, readJsonWithLimit } from './payload';
import { QnaNotFoundError, QnaRevisionConflictError } from './repository';
import { qnaJson } from './response';
import { QnaSecurityError, requireAdminMutation } from './security';

interface ParseResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
}

interface AdminMutationOptions<TInput, TResult> {
  request: Request;
  questionId: string | undefined;
  parse: (input: unknown) => ParseResult<TInput>;
  mutate: (input: {
    value: TInput;
    questionId: string;
    actorUserId: string;
    requestId: string;
  }) => Promise<TResult>;
  responseKey: 'answer' | 'question';
}

function mutationErrorResponse(error: unknown): Response {
  if (error instanceof QnaSecurityError) {
    return qnaJson({ ok: false, error: error.code }, { status: error.status });
  }
  if (error instanceof QnaNotFoundError) {
    return qnaJson({ ok: false, error: 'not_found' }, { status: 404 });
  }
  if (error instanceof QnaRevisionConflictError) {
    return qnaJson({ ok: false, error: 'revision_conflict' }, { status: 409 });
  }
  return qnaJson({ ok: false, error: 'internal_error' }, { status: 500 });
}

export async function handleAdminQuestionMutation<TInput, TResult>(
  options: AdminMutationOptions<TInput, TResult>,
): Promise<Response> {
  let actorUserId: string;
  try {
    actorUserId = (await requireAdminMutation(options.request)).uid;
  } catch (error) {
    return mutationErrorResponse(error);
  }

  if (!options.questionId) {
    return qnaJson({ ok: false, error: 'missing_id' }, { status: 400 });
  }

  let input: unknown;
  try {
    input = await readJsonWithLimit(options.request, QNA_LIMITS.requestBytes);
  } catch (error) {
    const code = error instanceof QnaPayloadError ? error.message : 'invalid_json';
    return qnaJson(
      { ok: false, error: code },
      { status: code === 'payload_too_large' ? 413 : 400 },
    );
  }

  const parsed = options.parse(input);
  if (!parsed.ok || parsed.value === undefined) {
    return qnaJson({ ok: false, error: parsed.error ?? 'invalid_payload' }, { status: 400 });
  }

  try {
    const result = await options.mutate({
      value: parsed.value,
      questionId: options.questionId,
      actorUserId,
      requestId: crypto.randomUUID(),
    });
    return qnaJson({ ok: true, [options.responseKey]: result });
  } catch (error) {
    return mutationErrorResponse(error);
  }
}
