import { describe, expect, it } from 'vitest';
import { parseBoard, parsePage, parsePostPayload, parseRevisionPayload } from './payload';

describe('forum input boundaries', () => {
  it('accepts only named boards and positive safe pages', () => {
    expect(parseBoard('assembly')).toBe('assembly');
    expect(parseBoard('directors')).toBe('directors');
    expect(() => parseBoard('other')).toThrow();
    expect(parsePage(null)).toBe(1);
    for (const value of ['0', '-1', '1.5', '1e2', '999999999999999999'])
      expect(() => parsePage(value)).toThrow();
  });
  it('trims text while preserving plain text and line breaks', () => {
    expect(parsePostPayload({ title: ' Title ', body: ' <script>\ntext ' })).toEqual({
      title: 'Title',
      body: '<script>\ntext',
    });
  });
  it.each([
    { title: ' ', body: 'ok' },
    { title: 'ok', body: '\n\t' },
    { title: 'x'.repeat(121), body: 'ok' },
    { title: 'ok', body: 'x'.repeat(10001) },
    { title: 'a\0b', body: 'ok' },
    { title: 'ok', body: 'a\0b' },
    { title: 'ok', body: 'ok', authorId: 'forged' },
    null,
    [],
  ])('rejects invalid text and injected fields: %j', (value) =>
    expect(() => parsePostPayload(value)).toThrow(),
  );
  it('requires integer revisions and rejects extra fields', () => {
    expect(parseRevisionPayload({ expectedRevision: 1 })).toEqual({ expectedRevision: 1 });
    expect(parsePostPayload({ title: 'T', body: 'B', expectedRevision: 2 }, true)).toEqual({
      title: 'T',
      body: 'B',
      expectedRevision: 2,
    });
    for (const value of [0, -1, 1.5, '1', null, Number.MAX_SAFE_INTEGER + 1])
      expect(() => parseRevisionPayload({ expectedRevision: value })).toThrow();
    expect(() => parseRevisionPayload({ expectedRevision: 1, board: 'assembly' })).toThrow();
  });
});
