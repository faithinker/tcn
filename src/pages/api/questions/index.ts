import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { getSessionUid } from '../../../lib/auth';
import { getDB } from '../../../lib/db';
import {
  parseQuestionPayload,
  QNA_LIMITS,
  QnaPayloadError,
  readJsonWithLimit,
} from '../../../lib/qna/payload';
import { createQuestion } from '../../../lib/qna/repository';
import { qnaJson } from '../../../lib/qna/response';
import {
  consumeQuestionRateLimit,
  getQnaRateLimitKey,
  QnaSecurityError,
  requireSameOrigin,
  verifyTurnstile,
} from '../../../lib/qna/security';

export const prerender = false;

interface QnaBindings {
  TURNSTILE_SECRET_KEY?: string;
  QNA_TURNSTILE_HOSTNAMES?: string;
  QNA_RATE_LIMIT_SECRET?: string;
}

function bindings(): QnaBindings {
  return env as unknown as QnaBindings;
}

function securityError(error: unknown): Response | null {
  if (error instanceof QnaSecurityError) {
    return qnaJson({ ok: false, error: error.code }, { status: error.status });
  }
  return null;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    requireSameOrigin(request);
  } catch (error) {
    return securityError(error) ?? qnaJson({ ok: false, error: 'forbidden' }, { status: 403 });
  }

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
  const parsed = parseQuestionPayload(input);
  if (!parsed.ok) return qnaJson({ ok: false, error: parsed.error }, { status: 400 });
  if (parsed.value.website) {
    return qnaJson({ ok: false, error: 'invalid_submission' }, { status: 400 });
  }

  const config = bindings();
  const db = getDB();
  try {
    await verifyTurnstile(
      db,
      parsed.value.turnstileToken,
      request.headers.get('cf-connecting-ip'),
      {
        secret: config.TURNSTILE_SECRET_KEY ?? '',
        hostnames: new Set(
          (config.QNA_TURNSTILE_HOSTNAMES ?? '')
            .split(',')
            .map((hostname) => hostname.trim())
            .filter(Boolean),
        ),
        action: 'qna_question',
      },
    );
    const rateKey = await getQnaRateLimitKey(request, config.QNA_RATE_LIMIT_SECRET ?? '');
    const rate = await consumeQuestionRateLimit(db, rateKey);
    if (!rate.allowed) {
      return qnaJson(
        { ok: false, error: 'rate_limited' },
        { status: 429, headers: { 'retry-after': String(rate.retryAfter) } },
      );
    }
  } catch (error) {
    return (
      securityError(error) ?? qnaJson({ ok: false, error: 'security_failed' }, { status: 503 })
    );
  }

  const askerUserId = await getSessionUid(request);
  const question = await createQuestion(db, {
    title: parsed.value.title,
    body: parsed.value.body,
    askerUserId,
  });
  return qnaJson(
    {
      ok: true,
      question: {
        id: question.id,
        title: question.title,
        body: question.body,
        visibility: question.visibility,
        revision: question.revision,
        createdAt: question.createdAt,
      },
    },
    { status: 201 },
  );
};
