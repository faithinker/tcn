// i18n 문자열 사전 — 영어 단일. (ko 사전은 미사용이라 제거)
// 헬퍼 시그니처 호환을 위해 사전 구조(ui[lang])는 유지한다.

// 영어 단일 사이트 — 기본(유일) 언어는 en.
export const defaultLang = 'en';

export const ui = {
  en: {
    // 브랜드
    'site.name': 'Transcultural Network',
    'site.abbr': 'TCN',
    'site.tagline': 'An international scholarly network creating a new third culture beyond the boundaries of nation, ethnicity, language, and culture',
    'nav.home': 'Home',
    'nav.about': 'About',
    'nav.aboutOverview': 'About TCN',
    'nav.founding': 'Founding Ceremony',
    'nav.declaration': 'Founding Declaration',
    'nav.bylaws': 'Bylaws',
    'nav.people': 'People',
    'nav.seminars': 'Seminars',
    'nav.contact': 'Contact',
    'nav.cta': 'Join / Contact',
    'common.skipToContent': 'Skip to content',
    'common.menu': 'Menu',
    'common.relatedDocuments': 'Related documents',
    'common.close': 'Close',
    'common.readMore': 'Read more',
    'common.back': 'Back',
    'common.backToAbout': 'Back to About',
    'common.language': 'Language',
    'common.themeToggle': 'Eye Protection Mode',
    'common.backToTop': 'Back to top',
    'common.upcoming': 'Upcoming',
    'common.past': 'Past',
    'common.tba': 'To be announced',
    'footer.office': 'Secretariat',
    'footer.officeValue': '286, Gukhwa-ri, Ganghwa-eup, Ganghwa-gun, Incheon, Republic of Korea',
    'footer.copyright': 'Transcultural Network',
    'footer.contactNote': 'Contact details to be announced',
  },
} as const;

export type UiLang = keyof typeof ui;
export type UiKey = keyof (typeof ui)[typeof defaultLang];
