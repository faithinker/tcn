import type {
  BodyDocument,
  ContentAttachment,
  ContentBlockNode,
  ContentImage,
  ContentInlineNode,
  ContentListItemNode,
  ContentParagraphNode,
  ContentTextMark,
  ContentTextNode,
} from './types';

export class ContentValidationError extends Error {
  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'ContentValidationError';
  }
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ContentValidationError(path, 'expected an object');
  }
  return value as Record<string, unknown>;
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new ContentValidationError(path, 'expected an array');
  return value;
}

function string(value: unknown, path: string, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim())) {
    throw new ContentValidationError(path, allowEmpty ? 'expected a string' : 'expected a non-empty string');
  }
  return value;
}

function optionalString(value: unknown, path: string): string | undefined {
  return value === undefined ? undefined : string(value, path, true);
}

function positiveDimension(value: unknown, path: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new ContentValidationError(path, 'expected a positive integer');
  }
  return value;
}

function safeUrl(value: unknown, path: string): string {
  const href = string(value, path);
  if (href.startsWith('/') || href.startsWith('#') || href.startsWith('mailto:')) return href;
  try {
    const url = new URL(href);
    if (url.protocol === 'http:' || url.protocol === 'https:') return href;
  } catch {
    // Report the same validation error for malformed and disallowed URLs.
  }
  throw new ContentValidationError(path, 'expected an http(s), mailto, root-relative, or fragment URL');
}

function parseMark(value: unknown, path: string): ContentTextMark {
  const input = record(value, path);
  if (input.type === 'bold' || input.type === 'italic') return { type: input.type };
  if (input.type === 'link') {
    const attrs = record(input.attrs, `${path}.attrs`);
    return { type: 'link', attrs: { href: safeUrl(attrs.href, `${path}.attrs.href`) } };
  }
  throw new ContentValidationError(`${path}.type`, 'unsupported text mark');
}

function parseText(value: unknown, path: string): ContentTextNode {
  const input = record(value, path);
  if (input.type !== 'text') throw new ContentValidationError(`${path}.type`, 'expected text');
  const marks = input.marks === undefined
    ? undefined
    : array(input.marks, `${path}.marks`).map((mark, index) => parseMark(mark, `${path}.marks[${index}]`));
  return {
    type: 'text',
    text: string(input.text, `${path}.text`, true),
    ...(marks ? { marks } : {}),
  };
}

function parseInlineContent(value: unknown, path: string): ContentInlineNode[] | undefined {
  if (value === undefined) return undefined;
  return array(value, path).map((node, index) => {
    const input = record(node, `${path}[${index}]`);
    if (input.type === 'hardBreak') return { type: 'hardBreak' };
    return parseText(input, `${path}[${index}]`);
  });
}

function parseParagraph(value: unknown, path: string): ContentParagraphNode {
  const input = record(value, path);
  if (input.type !== 'paragraph') throw new ContentValidationError(`${path}.type`, 'expected paragraph');
  const content = parseInlineContent(input.content, `${path}.content`);
  return { type: 'paragraph', ...(content ? { content } : {}) };
}

function parseImage(value: unknown, path: string): ContentImage {
  const input = record(value, path);
  const layout = input.layout;
  if (layout !== undefined && layout !== 'reading' && layout !== 'wide' && layout !== 'pair') {
    throw new ContentValidationError(`${path}.layout`, 'unsupported image layout');
  }
  const src = input.src === undefined ? undefined : safeUrl(input.src, `${path}.src`);
  return {
    assetId: string(input.assetId ?? input.id, `${path}.assetId`),
    ...(input.path !== undefined ? { path: string(input.path, `${path}.path`) } : {}),
    ...(src ? { src } : {}),
    alt: string(input.alt, `${path}.alt`),
    ...(input.caption !== undefined ? { caption: optionalString(input.caption, `${path}.caption`) } : {}),
    ...(layout ? { layout } : {}),
    ...(input.width !== undefined ? { width: positiveDimension(input.width, `${path}.width`) } : {}),
    ...(input.height !== undefined ? { height: positiveDimension(input.height, `${path}.height`) } : {}),
    ...(input.aspectRatio !== undefined
      ? { aspectRatio: positiveNumber(input.aspectRatio, `${path}.aspectRatio`) }
      : {}),
  };
}

function positiveNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new ContentValidationError(path, 'expected a positive number');
  }
  return value;
}

function parseAttachment(value: unknown, path: string): ContentAttachment {
  const input = record(value, path);
  if (typeof input.size !== 'number' || !Number.isInteger(input.size) || input.size < 0) {
    throw new ContentValidationError(`${path}.size`, 'expected a non-negative integer');
  }
  const url = input.url === undefined ? undefined : safeUrl(input.url, `${path}.url`);
  return {
    assetId: string(input.assetId ?? input.id, `${path}.assetId`),
    ...(input.path !== undefined ? { path: string(input.path, `${path}.path`) } : {}),
    name: string(input.name ?? input.fileName, `${path}.name`),
    ...(input.label !== undefined ? { label: string(input.label, `${path}.label`) } : {}),
    mimeType: string(input.mimeType, `${path}.mimeType`),
    size: input.size,
    ...(url ? { url } : {}),
  };
}

function parseListItem(value: unknown, path: string): ContentListItemNode {
  const input = record(value, path);
  if (input.type !== 'listItem') throw new ContentValidationError(`${path}.type`, 'expected listItem');
  return {
    type: 'listItem',
    content: array(input.content, `${path}.content`).map((node, index) =>
      parseParagraph(node, `${path}.content[${index}]`)),
  };
}

function parseBlock(value: unknown, path: string): ContentBlockNode {
  const input = record(value, path);
  switch (input.type) {
    case 'paragraph':
      return parseParagraph(input, path);
    case 'heading': {
      const attrs = record(input.attrs, `${path}.attrs`);
      if (attrs.level !== 2 && attrs.level !== 3) {
        throw new ContentValidationError(`${path}.attrs.level`, 'only heading levels 2 and 3 are supported');
      }
      const content = parseInlineContent(input.content, `${path}.content`);
      return { type: 'heading', attrs: { level: attrs.level }, ...(content ? { content } : {}) };
    }
    case 'blockquote':
      return {
        type: 'blockquote',
        content: array(input.content, `${path}.content`).map((node, index) =>
          parseParagraph(node, `${path}.content[${index}]`)),
      };
    case 'bulletList':
    case 'orderedList':
      return {
        type: input.type,
        content: array(input.content, `${path}.content`).map((node, index) =>
          parseListItem(node, `${path}.content[${index}]`)),
      };
    case 'programme': {
      const attrs = record(input.attrs, `${path}.attrs`);
      return {
        type: 'programme',
        attrs: {
          items: array(attrs.items, `${path}.attrs.items`).map((item, index) => {
            const row = record(item, `${path}.attrs.items[${index}]`);
            return {
              time: string(row.time, `${path}.attrs.items[${index}].time`),
              title: string(row.title, `${path}.attrs.items[${index}].title`),
              ...(row.description !== undefined
                ? { description: optionalString(row.description, `${path}.attrs.items[${index}].description`) }
                : {}),
            };
          }),
        },
      };
    }
    case 'outcomes': {
      const attrs = record(input.attrs, `${path}.attrs`);
      return {
        type: 'outcomes',
        attrs: {
          items: array(attrs.items, `${path}.attrs.items`).map((item, index) => {
            const row = record(item, `${path}.attrs.items[${index}]`);
            return {
              title: string(row.title, `${path}.attrs.items[${index}].title`),
              ...(row.description !== undefined
                ? { description: optionalString(row.description, `${path}.attrs.items[${index}].description`) }
                : {}),
            };
          }),
        },
      };
    }
    case 'image':
      return { type: 'image', attrs: parseImage(input.attrs, `${path}.attrs`) };
    case 'gallery': {
      const attrs = record(input.attrs, `${path}.attrs`);
      const layout = attrs.layout;
      if (layout !== undefined && layout !== 'reading' && layout !== 'wide' && layout !== 'pair') {
        throw new ContentValidationError(`${path}.attrs.layout`, 'unsupported gallery layout');
      }
      return {
        type: 'gallery',
        attrs: {
          images: array(attrs.images, `${path}.attrs.images`).map((image, index) =>
            parseImage(image, `${path}.attrs.images[${index}]`)),
          ...(layout ? { layout } : {}),
        },
      };
    }
    case 'attachments': {
      const attrs = record(input.attrs, `${path}.attrs`);
      return {
        type: 'attachments',
        attrs: {
          files: array(attrs.files ?? attrs.items, `${path}.attrs.files`).map((item, index) =>
            parseAttachment(item, `${path}.attrs.files[${index}]`)),
        },
      };
    }
    case 'horizontalRule':
      return { type: 'horizontalRule' };
    default:
      throw new ContentValidationError(`${path}.type`, 'unsupported content node');
  }
}

export function parseBodyDocument(value: unknown): BodyDocument {
  const input = record(value, 'body');
  if (input.type !== 'doc') throw new ContentValidationError('body.type', 'expected doc');
  return {
    type: 'doc',
    content: array(input.content, 'body.content').map((node, index) => parseBlock(node, `body.content[${index}]`)),
  };
}

export function createEmptyDocument(): BodyDocument {
  return { type: 'doc', content: [{ type: 'paragraph' }] };
}

export interface ContentValidationResult {
  ok: boolean;
  errors: string[];
}

const allowedAuthoringNodes = new Set([
  'doc',
  'paragraph',
  'heading',
  'text',
  'blockquote',
  'bulletList',
  'orderedList',
  'listItem',
  'hardBreak',
  'horizontalRule',
  'programme',
  'gallery',
  'outcomes',
  'attachments',
  'image',
]);

const allowedAuthoringMarks = new Set(['bold', 'italic', 'link']);

function isAuthoringRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isSafeAuthoringLink(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  if (value.startsWith('/') || value.startsWith('#')) return true;
  try {
    return ['http:', 'https:', 'mailto:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function isPositiveAuthoringNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function collectAuthoringErrors(value: unknown, path: string, errors: string[]): void {
  if (!isAuthoringRecord(value) || typeof value.type !== 'string') {
    errors.push(`Invalid content node at ${path}`);
    return;
  }

  if (!allowedAuthoringNodes.has(value.type)) {
    errors.push(`Node type "${value.type}" is not allowed at ${path}`);
  }
  if (value.type === 'heading' && ![2, 3].includes(value.attrs?.level)) {
    errors.push(`Only heading levels 2 and 3 are allowed at ${path}`);
  }
  if (value.type === 'gallery') {
    const images = value.attrs?.images;
    if (!Array.isArray(images)) {
      errors.push(`Gallery images are required at ${path}`);
    } else {
      images.forEach((image: unknown, index: number) => {
        const imagePath = `${path}.images.${index}`;
        if (!isAuthoringRecord(image) || typeof image.alt !== 'string' || !image.alt.trim()) {
          errors.push(`Gallery image alt text is required at ${imagePath}`);
        }
        if (!isAuthoringRecord(image)
          || !isPositiveAuthoringNumber(image.width)
          || !isPositiveAuthoringNumber(image.height)
          || !isPositiveAuthoringNumber(image.aspectRatio)) {
          errors.push(`Gallery image dimensions are invalid at ${imagePath}`);
        }
      });
    }
    if (!['reading', 'wide', 'pair'].includes(value.attrs?.layout)) {
      errors.push(`Gallery layout is invalid at ${path}`);
    }
  }
  if (value.type === 'image') {
    const attrs = value.attrs;
    if (!isAuthoringRecord(attrs) || typeof attrs.assetId !== 'string' || !attrs.assetId) {
      errors.push(`Image asset is required at ${path}`);
    }
    if (!isAuthoringRecord(attrs) || typeof attrs.alt !== 'string' || !attrs.alt.trim()) {
      errors.push(`Image alt text is required at ${path}`);
    }
    if (!isAuthoringRecord(attrs)
      || !isPositiveAuthoringNumber(attrs.width)
      || !isPositiveAuthoringNumber(attrs.height)
      || !isPositiveAuthoringNumber(attrs.aspectRatio)) {
      errors.push(`Image dimensions are invalid at ${path}`);
    }
    if (!isAuthoringRecord(attrs) || !['reading', 'wide', 'pair'].includes(attrs.layout)) {
      errors.push(`Image layout is invalid at ${path}`);
    }
  }
  if ((value.type === 'programme' || value.type === 'outcomes')
    && (!Array.isArray(value.attrs?.items) || value.attrs.items.length === 0)) {
    errors.push(`${value.type} requires at least one item at ${path}`);
  }
  if (value.type === 'attachments' && !Array.isArray(value.attrs?.files)) {
    errors.push(`Attachments require a files array at ${path}`);
  }

  if (Array.isArray(value.marks)) {
    value.marks.forEach((mark: unknown) => {
      if (!isAuthoringRecord(mark) || typeof mark.type !== 'string' || !allowedAuthoringMarks.has(mark.type)) {
        errors.push(`Text mark is not allowed at ${path}`);
      } else if (mark.type === 'link' && !isSafeAuthoringLink(mark.attrs?.href)) {
        errors.push(`Link protocol is not allowed at ${path}`);
      }
    });
  }

  if (value.content !== undefined && !Array.isArray(value.content)) {
    errors.push(`Node content must be an array at ${path}`);
  } else if (Array.isArray(value.content)) {
    value.content.forEach((child: unknown, index: number) =>
      collectAuthoringErrors(child, `${path}.${index}`, errors));
  }
}

export function validateContentDocument(value: unknown): ContentValidationResult {
  const errors: string[] = [];
  if (!isAuthoringRecord(value) || value.type !== 'doc') {
    errors.push('Document root must be a doc node');
  } else {
    collectAuthoringErrors(value, 'doc', errors);
  }
  if (errors.length > 0) return { ok: false, errors };

  try {
    parseBodyDocument(value);
    return { ok: true, errors: [] };
  } catch (error) {
    return {
      ok: false,
      errors: [error instanceof Error ? error.message : 'Content document is invalid'],
    };
  }
}
