import type { QnaAdminStatus, QnaPublicStatus, QnaVisibility } from '../db/types';

export const QNA_LIMITS = {
  title: 120,
  body: 10_000,
  turnstileToken: 2_048,
  // 10,000 UTF-8 characters can require 40,000 bytes before JSON overhead.
  requestBytes: 65_536,
} as const;

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

export class QnaPayloadError extends Error {
  constructor(code: 'payload_too_large' | 'invalid_json') {
    super(code);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnly(record: Record<string, unknown>, allowed: readonly string[]): boolean {
  const keys = new Set(allowed);
  return Object.keys(record).every((key) => keys.has(key));
}

function requiredText(
  record: Record<string, unknown>,
  key: string,
  limit: number,
): ParseResult<string> {
  const value = record[key];
  if (typeof value !== 'string') return { ok: false, error: `invalid_${key}` };
  if (value.includes('\u0000')) return { ok: false, error: `invalid_${key}` };
  const normalized = value.trim();
  if (!normalized) return { ok: false, error: `${key}_required` };
  if (normalized.length > limit) return { ok: false, error: `${key}_too_long` };
  return { ok: true, value: normalized };
}

function expectedRevision(value: unknown): ParseResult<number> {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    return { ok: false, error: 'invalid_revision' };
  }
  return { ok: true, value: Number(value) };
}

export function parsePage(value: string | null): number {
  if (!value || !/^[1-9]\d*$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : 1;
}

export function parsePublicStatus(value: string | null): QnaPublicStatus {
  return value === 'waiting' || value === 'answered' ? value : 'all';
}

export function parseAdminStatus(value: string | null): QnaAdminStatus {
  return value === 'answered' || value === 'hidden' ? value : 'waiting';
}

export function parseQuestionPayload(
  input: unknown,
): ParseResult<{ title: string; body: string; turnstileToken: string; website: string }> {
  if (!isRecord(input)) return { ok: false, error: 'invalid_payload' };
  if (!hasOnly(input, ['title', 'body', 'turnstileToken', 'website'])) {
    return { ok: false, error: 'unknown_field' };
  }
  const title = requiredText(input, 'title', QNA_LIMITS.title);
  if (!title.ok) return title;
  const body = requiredText(input, 'body', QNA_LIMITS.body);
  if (!body.ok) return body;
  if (
    typeof input.turnstileToken !== 'string' ||
    input.turnstileToken.length < 1 ||
    input.turnstileToken.length > QNA_LIMITS.turnstileToken
  ) {
    return { ok: false, error: 'invalid_turnstile' };
  }
  if (input.website !== undefined && typeof input.website !== 'string') {
    return { ok: false, error: 'invalid_honeypot' };
  }
  return {
    ok: true,
    value: {
      title: title.value,
      body: body.value,
      turnstileToken: input.turnstileToken,
      website: input.website ?? '',
    },
  };
}

export function parseAnswerPayload(
  input: unknown,
): ParseResult<{ body: string; expectedRevision: number }> {
  if (!isRecord(input)) return { ok: false, error: 'invalid_payload' };
  if (!hasOnly(input, ['body', 'expectedRevision'])) return { ok: false, error: 'unknown_field' };
  const body = requiredText(input, 'body', QNA_LIMITS.body);
  if (!body.ok) return body;
  const revision = expectedRevision(input.expectedRevision);
  if (!revision.ok) return revision;
  return { ok: true, value: { body: body.value, expectedRevision: revision.value } };
}

export function parseVisibilityPayload(
  input: unknown,
): ParseResult<{ visibility: QnaVisibility; expectedRevision: number }> {
  if (!isRecord(input)) return { ok: false, error: 'invalid_payload' };
  if (!hasOnly(input, ['visibility', 'expectedRevision'])) {
    return { ok: false, error: 'unknown_field' };
  }
  if (input.visibility !== 'visible' && input.visibility !== 'hidden') {
    return { ok: false, error: 'invalid_visibility' };
  }
  const revision = expectedRevision(input.expectedRevision);
  if (!revision.ok) return revision;
  return {
    ok: true,
    value: { visibility: input.visibility, expectedRevision: revision.value },
  };
}

export async function readJsonWithLimit(request: Request, maxBytes: number): Promise<unknown> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new QnaPayloadError('payload_too_large');
  }
  if (!request.body) throw new QnaPayloadError('invalid_json');

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maxBytes) {
      await reader.cancel();
      throw new QnaPayloadError('payload_too_large');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new QnaPayloadError('invalid_json');
  }
}
