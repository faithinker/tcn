import { describe, expect, it } from 'vitest';
import {
  parseAnswerPayload,
  parsePage,
  parsePublicStatus,
  parseQuestionPayload,
  parseVisibilityPayload,
  QNA_LIMITS,
  readJsonWithLimit,
} from './payload';

describe('Q&A query and payload contracts', () => {
  it.each([
    [null, 1],
    ['1', 1],
    ['2', 2],
    ['0', 1],
    ['-1', 1],
    ['1.5', 1],
    ['9007199254740992', 1],
  ])('parses page %j safely', (input, expected) => {
    expect(parsePage(input)).toBe(expected);
  });

  it.each([
    [null, 'all'],
    ['all', 'all'],
    ['waiting', 'waiting'],
    ['answered', 'answered'],
    ['hidden', 'all'],
  ] as const)('allowlists public status %j', (input, expected) => {
    expect(parsePublicStatus(input)).toBe(expected);
  });

  it('normalizes a valid anonymous question and technical anti-abuse fields', () => {
    expect(
      parseQuestionPayload({
        title: '  Title  ',
        body: '  Body\nline  ',
        turnstileToken: 'token',
        website: '',
      }),
    ).toEqual({
      ok: true,
      value: { title: 'Title', body: 'Body\nline', turnstileToken: 'token', website: '' },
    });
  });

  it.each([
    [{ title: 'Title', body: 'Body', turnstileToken: 'token', author: 'forged' }, 'unknown_field'],
    [
      { title: 'Title', body: 'Body', turnstileToken: 'token', visibility: 'hidden' },
      'unknown_field',
    ],
    [{ title: [], body: 'Body', turnstileToken: 'token' }, 'invalid_title'],
    [{ title: ' ', body: 'Body', turnstileToken: 'token' }, 'title_required'],
    [{ title: 'Title', body: {}, turnstileToken: 'token' }, 'invalid_body'],
    [{ title: 'Title', body: ' \n ', turnstileToken: 'token' }, 'body_required'],
    [{ title: 'Title\u0000', body: 'Body', turnstileToken: 'token' }, 'invalid_title'],
    [{ title: 'Title', body: 'Body', turnstileToken: [] }, 'invalid_turnstile'],
  ])('rejects malformed or mass-assigned question input %#', (input, error) => {
    expect(parseQuestionPayload(input)).toEqual({ ok: false, error });
  });

  it('enforces exact title/body boundaries', () => {
    expect(
      parseQuestionPayload({
        title: 't'.repeat(QNA_LIMITS.title),
        body: 'b'.repeat(QNA_LIMITS.body),
        turnstileToken: 'token',
      }).ok,
    ).toBe(true);
    expect(
      parseQuestionPayload({
        title: 't'.repeat(QNA_LIMITS.title + 1),
        body: 'Body',
        turnstileToken: 'token',
      }),
    ).toEqual({ ok: false, error: 'title_too_long' });
    expect(
      parseQuestionPayload({
        title: 'Title',
        body: 'b'.repeat(QNA_LIMITS.body + 1),
        turnstileToken: 'token',
      }),
    ).toEqual({ ok: false, error: 'body_too_long' });
  });

  it('separates answer and visibility mutation allowlists', () => {
    expect(parseAnswerPayload({ body: ' Answer ', expectedRevision: 0 })).toEqual({
      ok: true,
      value: { body: 'Answer', expectedRevision: 0 },
    });
    expect(
      parseAnswerPayload({ body: 'Answer', expectedRevision: 1, answeredBy: 'forged' }),
    ).toEqual({
      ok: false,
      error: 'unknown_field',
    });
    expect(parseAnswerPayload({ body: 'Answer', expectedRevision: -1 })).toEqual({
      ok: false,
      error: 'invalid_revision',
    });
    expect(parseVisibilityPayload({ visibility: 'hidden', expectedRevision: 2 })).toEqual({
      ok: true,
      value: { visibility: 'hidden', expectedRevision: 2 },
    });
    expect(parseVisibilityPayload({ visibility: 'deleted', expectedRevision: 2 })).toEqual({
      ok: false,
      error: 'invalid_visibility',
    });
  });
});

describe('bounded JSON reader', () => {
  it('reads a body without trusting Content-Length', async () => {
    const request = new Request('https://tcn.example/api/questions', {
      method: 'POST',
      body: JSON.stringify({ title: 'Title' }),
    });
    await expect(readJsonWithLimit(request, 100)).resolves.toEqual({ title: 'Title' });
  });

  it('throws payload_too_large after the actual streamed bytes exceed the limit', async () => {
    const request = new Request('https://tcn.example/api/questions', {
      method: 'POST',
      headers: { 'content-length': '1' },
      body: JSON.stringify({ body: 'x'.repeat(100) }),
    });
    await expect(readJsonWithLimit(request, 20)).rejects.toThrow('payload_too_large');
  });

  it('rejects invalid JSON distinctly', async () => {
    const request = new Request('https://tcn.example/api/questions', {
      method: 'POST',
      body: '{',
    });
    await expect(readJsonWithLimit(request, 20)).rejects.toThrow('invalid_json');
  });
});
