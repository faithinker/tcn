import type { UiKey } from '../i18n/ui';

export interface NavItem {
  key: UiKey;
  href: string;
  children?: Array<{ key: UiKey; href: string }>;
}

export const navItems: NavItem[] = [
  { key: 'nav.home', href: '/' },
  {
    key: 'nav.about',
    href: '/about',
    children: [
      { key: 'nav.aboutOverview', href: '/about' },
      { key: 'nav.founding', href: '/about/founding' },
      { key: 'nav.declaration', href: '/about/declaration' },
      { key: 'nav.bylaws', href: '/about/bylaws' },
    ],
  },
  { key: 'nav.people', href: '/people' },
  { key: 'nav.seminars', href: '/seminars' },
  { key: 'nav.contact', href: '/contact' },
];
