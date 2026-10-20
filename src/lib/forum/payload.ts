import type { ForumBoard } from '../auth/permissions';

export class ForumInputError extends Error {
  constructor() {
    super('invalid_input');
  }
}

export function parseBoard(value: unknown): ForumBoard {
  if (value !== 'assembly' && value !== 'directors') throw new ForumInputError();
  return value;
}

export function parsePage(value: string | null): number {
  if (value === null) return 1;
  if (
    !/^[1-9]\d*$/.test(value) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) > Math.floor(Number.MAX_SAFE_INTEGER / 20)
  )
    throw new ForumInputError();
  return Number(value);
}

function object(value: unknown, allowed: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ForumInputError();
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !allowed.includes(key))) throw new ForumInputError();
  return record;
}

function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || value.includes('\0') || value.length > max || !value.trim())
    throw new ForumInputError();
  return value.trim();
}

export function parseRevisionPayload(value: unknown): { expectedRevision: number } {
  const record = object(value, ['expectedRevision']);
  const revision = record.expectedRevision;
  if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 1)
    throw new ForumInputError();
  return { expectedRevision: revision };
}

export function parsePostPayload(
  value: unknown,
  editing: true,
): { title: string; body: string; expectedRevision: number };
export function parsePostPayload(value: unknown, editing?: false): { title: string; body: string };
export function parsePostPayload(value: unknown, editing = false) {
  const record = object(value, editing ? ['title', 'body', 'expectedRevision'] : ['title', 'body']);
  const fields = { title: text(record.title, 120), body: text(record.body, 10000) };
  return editing
    ? { ...fields, ...parseRevisionPayload({ expectedRevision: record.expectedRevision }) }
    : fields;
}
