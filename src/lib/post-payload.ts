export const POST_LIMITS = {
  title: 200,
  summary: 2_000,
  address: 1_000,
  body: 200_000,
  heroMediaId: 128,
} as const;

export interface ValidPostPayload {
  title: string;
  summary: string | null;
  eventDate: string | null;
  address: string | null;
  body: string;
  heroMediaId: string | null;
  revision: number | null;
}

type ParseResult = { ok: true; value: ValidPostPayload } | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fieldErrorName(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function optionalString(
  record: Record<string, unknown>,
  key: string,
  limit: number,
): { ok: true; value: string | null } | { ok: false; error: string } {
  const value = record[key];
  if (value === undefined || value === null || value === '') return { ok: true, value: null };
  const errorName = fieldErrorName(key);
  if (typeof value !== 'string') return { ok: false, error: `invalid_${errorName}` };

  const normalized = value.trim();
  if (!normalized) return { ok: true, value: null };
  if (normalized.length > limit) {
    return {
      ok: false,
      error: `${errorName}_too_long`,
    };
  }
  return { ok: true, value: normalized };
}

export function parsePostPayload(input: unknown): ParseResult {
  if (!isRecord(input)) return { ok: false, error: 'invalid_payload' };

  if (typeof input.title !== 'string') return { ok: false, error: 'invalid_title' };
  const title = input.title.trim();
  if (!title) return { ok: false, error: 'title_required' };
  if (title.length > POST_LIMITS.title) return { ok: false, error: 'title_too_long' };

  const summary = optionalString(input, 'summary', POST_LIMITS.summary);
  if (!summary.ok) return summary;
  const address = optionalString(input, 'address', POST_LIMITS.address);
  if (!address.ok) return address;
  const eventDate = optionalString(input, 'eventDate', 10);
  if (!eventDate.ok) return eventDate;

  const bodyValue = input.body ?? '';
  if (typeof bodyValue !== 'string') return { ok: false, error: 'invalid_body' };
  if (bodyValue.length > POST_LIMITS.body) return { ok: false, error: 'body_too_long' };

  const heroMediaId = optionalString(input, 'heroMediaId', POST_LIMITS.heroMediaId);
  if (!heroMediaId.ok) return heroMediaId;
  const revisionValue = input.revision;
  if (
    revisionValue !== undefined &&
    revisionValue !== null &&
    (!Number.isSafeInteger(revisionValue) || Number(revisionValue) < 1)
  ) {
    return { ok: false, error: 'invalid_revision' };
  }

  return {
    ok: true,
    value: {
      title,
      summary: summary.value,
      eventDate: eventDate.value,
      address: address.value,
      body: bodyValue,
      heroMediaId: heroMediaId.value,
      revision:
        revisionValue === undefined || revisionValue === null ? null : Number(revisionValue),
    },
  };
}
