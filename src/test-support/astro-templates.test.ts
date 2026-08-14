// Astro 템플릿의 소스 형태를 지키는 가드다. 동작 테스트가 아니다.
//
// 이전에는 lib/qna/admin-ui.test.ts 가 관리자 Q&A 페이지 한 곳을 정규식으로 grep 해서
// `set:text={question.answer?.body ?? ''}` 라는 문자열이 있는지 확인했다. 그 문자열이
// 조금만 바뀌어도 깨지면서, 정작 같은 버그가 다른 페이지에서 나면 못 잡았다.
// 여기서는 문자열 대신 버그 클래스를 막는다.
//
// 막으려는 것: <textarea>{value}</textarea>
// Astro 는 자식 노드의 들여쓰기·줄바꿈을 그대로 textarea 의 값으로 직렬화한다.
// 사용자가 저장하지 않은 공백이 값에 섞여 들어가므로 항상 set:text= 를 써야 한다.
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('..', import.meta.url));

function astroFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return astroFiles(full);
    return entry.name.endsWith('.astro') ? [full] : [];
  });
}

/** 여는 태그의 끝 '>' 위치를 찾는다. 속성 안의 표현식·문자열에 든 '>' 는 건너뛴다. */
function findOpenTagEnd(source: string, from: number): number {
  let depth = 0;
  let quote: string | null = null;

  for (let i = from; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') quote = ch;
    else if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
    else if (ch === '>' && depth === 0) return i;
  }
  return -1;
}

interface Textarea {
  file: string;
  selfClosing: boolean;
  openTag: string;
  children: string;
}

function textareas(file: string): Textarea[] {
  const source = readFileSync(file, 'utf8');
  const found: Textarea[] = [];
  let cursor = 0;

  for (;;) {
    const start = source.indexOf('<textarea', cursor);
    if (start === -1) break;

    const tagEnd = findOpenTagEnd(source, start);
    expect(tagEnd, `unterminated <textarea> in ${file}`).toBeGreaterThan(-1);

    const openTag = source.slice(start, tagEnd + 1);
    const selfClosing = source[tagEnd - 1] === '/';
    let children = '';

    if (!selfClosing) {
      const close = source.indexOf('</textarea>', tagEnd);
      expect(close, `unclosed <textarea> in ${file}`).toBeGreaterThan(-1);
      children = source.slice(tagEnd + 1, close);
      cursor = close + '</textarea>'.length;
    } else {
      cursor = tagEnd + 1;
    }

    found.push({ file, selfClosing, openTag, children });
  }

  return found;
}

const all = astroFiles(SRC).flatMap(textareas);

describe('Astro template guards', () => {
  it('finds the textareas it is meant to guard', () => {
    // 가드가 조용히 0건을 검사하다 통과하는 상황을 막는다.
    expect(all.length).toBeGreaterThanOrEqual(2);
  });

  it.each(all.map((t) => [relative(SRC, t.file), t] as const))(
    'does not interpolate a value into the body of a <textarea> in %s',
    (_name, textarea) => {
      // 자식이 비어 있으면(새 글 폼) 문제없다. 값이 들어가는 경우만 검사한다.
      if (!textarea.children.trim()) return;

      expect(
        textarea.children,
        `<textarea> in ${textarea.file} interpolates its value as a child node. ` +
          'Astro serializes the surrounding indentation into the field, so use set:text= instead.',
      ).not.toMatch(/\{/);
    },
  );

  it('binds a value with set:text when the textarea is self-closing', () => {
    // set:text= 를 쓰는 textarea 는 자식을 가질 수 없으므로 반드시 self-closing 이어야 한다.
    for (const textarea of all) {
      if (textarea.openTag.includes('set:text')) {
        expect(
          textarea.selfClosing,
          `${textarea.file}: set:text= requires a self-closing tag`,
        ).toBe(true);
      }
    }
  });
});
