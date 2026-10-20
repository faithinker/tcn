import { describe, expect, it } from 'vitest';
import { navItems } from './navigation';

describe('primary board navigation', () => {
  it('replaces the standalone Q&A item with the three boards in the requested order', () => {
    const boards = navItems.find((item) => String(item.key) === 'nav.boards');
    expect(boards?.children?.map((child) => child.href)).toEqual([
      '/forum/directors',
      '/forum/assembly',
      '/questions',
    ]);
    expect(navItems.some((item) => item.key === 'nav.questions')).toBe(false);
  });
  it('omits Home while keeping seminars as a separate public destination', () => {
    expect(navItems.some((item) => item.href === '/')).toBe(false);
    expect(navItems.some((item) => item.href === '/seminars' && !item.children)).toBe(true);
  });
  it('places Contact last under About instead of in primary navigation', () => {
    expect(navItems.map((item) => item.key)).toEqual([
      'nav.about',
      'nav.people',
      'nav.seminars',
      'nav.boards',
    ]);
    expect(navItems.find((item) => item.key === 'nav.about')?.children?.at(-1)).toEqual({
      key: 'nav.contact',
      href: '/contact',
    });
  });
});
