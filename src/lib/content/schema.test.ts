import { describe, expect, it } from 'vitest';

import { createEmptyDocument, parseBodyDocument, validateContentDocument } from './schema';

describe('parseBodyDocument', () => {
  it('provides the authoring validation API from the shared contract', () => {
    expect(createEmptyDocument()).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph' }],
    });
    expect(validateContentDocument({ type: 'doc', content: [{ type: 'html' }] })).toMatchObject({
      ok: false,
      errors: [expect.stringMatching(/not allowed/i)],
    });
  });

  it('accepts the constrained editor document and preserves custom blocks', () => {
    const document = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Shared questions' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Read the ' },
            {
              type: 'text',
              text: 'report',
              marks: [{ type: 'link', attrs: { href: 'https://example.com/report.pdf' } }],
            },
          ],
        },
        {
          type: 'programme',
          attrs: {
            items: [{ time: '10:00', title: 'Opening', description: 'Welcome remarks' }],
          },
        },
        {
          type: 'gallery',
          attrs: {
            images: [
              {
                assetId: 'f3d8a49a-7b7e-43f6-a24f-87e2fc48d8bb',
                alt: 'Participants around a table',
                caption: 'Opening session',
                layout: 'pair',
              },
            ],
          },
        },
      ],
    };

    expect(parseBodyDocument(document)).toEqual(document);
  });

  it('accepts the authoring app gallery, hard break, and attachment contract', () => {
    const document = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Line one' },
            { type: 'hardBreak' },
            { type: 'text', text: 'Line two' },
          ],
        },
        {
          type: 'gallery',
          attrs: {
            layout: 'pair',
            images: [
              {
                assetId: 'asset-1',
                alt: 'Participants',
                caption: 'Roundtable',
                width: 1600,
                height: 1067,
                aspectRatio: 1.5,
              },
            ],
          },
        },
        {
          type: 'attachments',
          attrs: {
            files: [
              {
                assetId: 'file-1',
                name: 'report.pdf',
                mimeType: 'application/pdf',
                size: 1024,
              },
            ],
          },
        },
      ],
    };

    expect(parseBodyDocument(document)).toEqual(document);
  });

  it('normalizes uploaded asset ids and retains their storage paths', () => {
    const document = {
      type: 'doc',
      content: [
        {
          type: 'gallery',
          attrs: {
            layout: 'pair',
            images: [
              {
                id: 'asset-1',
                path: 'author-id/photo.webp',
                name: 'photo.webp',
                alt: 'Participants',
                width: 1600,
                height: 1067,
                aspectRatio: 1.5,
              },
            ],
          },
        },
        {
          type: 'attachments',
          attrs: {
            files: [
              {
                id: 'file-1',
                path: 'author-id/report.pdf',
                name: 'report.pdf',
                mimeType: 'application/pdf',
                size: 1024,
              },
            ],
          },
        },
      ],
    };

    expect(parseBodyDocument(document)).toMatchObject({
      content: [
        { attrs: { images: [{ assetId: 'asset-1', path: 'author-id/photo.webp' }] } },
        { attrs: { files: [{ assetId: 'file-1', path: 'author-id/report.pdf' }] } },
      ],
    });
  });

  it.each([
    {
      name: 'unknown HTML-like nodes',
      document: { type: 'doc', content: [{ type: 'script', content: [] }] },
    },
    {
      name: 'unsupported heading levels',
      document: { type: 'doc', content: [{ type: 'heading', attrs: { level: 1 }, content: [] }] },
    },
    {
      name: 'unsafe links',
      document: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'bad',
                marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
              },
            ],
          },
        ],
      },
    },
    {
      name: 'images without alternative text',
      document: {
        type: 'doc',
        content: [
          {
            type: 'gallery',
            attrs: { images: [{ assetId: 'asset-1', alt: '', layout: 'pair' }] },
          },
        ],
      },
    },
  ])('rejects $name', ({ document }) => {
    expect(() => parseBodyDocument(document)).toThrow();
  });
});
