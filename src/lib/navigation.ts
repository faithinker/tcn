import type { UiKey } from '../i18n/ui';

export interface NavItem {
  key: UiKey;
  href: string;
  children?: Array<{ key: UiKey; href: string }>;
}

export const navItems: NavItem[] = [
  {
    key: 'nav.about',
    href: '/about',
    children: [
      { key: 'nav.aboutOverview', href: '/about' },
      { key: 'nav.founding', href: '/about/founding' },
      { key: 'nav.declaration', href: '/about/declaration' },
      { key: 'nav.bylaws', href: '/about/bylaws' },
      { key: 'nav.contact', href: '/contact' },
    ],
  },
  { key: 'nav.people', href: '/people' },
  { key: 'nav.seminars', href: '/seminars' },
  {
    key: 'nav.boards',
    href: '/forum',
    children: [
      { key: 'nav.directorsBoard', href: '/forum/directors' },
      { key: 'nav.assemblyBoard', href: '/forum/assembly' },
      { key: 'nav.qnaBoard', href: '/questions' },
    ],
  },
];
