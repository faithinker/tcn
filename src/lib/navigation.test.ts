import { describe, expect, it } from 'vitest';
import { navItems } from './navigation';

describe('primary navigation', () => {
  it('keeps About children as standalone page destinations', () => {
    const about = navItems.find((item) => item.key === 'nav.about');

    expect(about?.children).toEqual([
      { key: 'nav.aboutOverview', href: '/about' },
      { key: 'nav.founding', href: '/about/founding' },
      { key: 'nav.declaration', href: '/about/declaration' },
      { key: 'nav.bylaws', href: '/about/bylaws' },
    ]);
    expect(about?.children?.every((child) => !child.href.includes('#'))).toBe(true);
  });
});
