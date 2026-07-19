// L3: i18n 문자열 사전 — 한국어 기본, 영어 옵션.
// 키 추가 시 ko를 먼저 채우고 en은 옵션(누락 시 ko로 폴백 — utils.useTranslations).

export const languages = {
  ko: '한국어',
  en: 'English',
} as const;

export const defaultLang = 'ko';
export const showDefaultLang = false; // ko 경로에 prefix 미부여

export const ui = {
  ko: {
    // 브랜드
    'site.name': '초문화네트워크',
    'site.nameEn': 'Transcultural Network',
    'site.abbr': 'TCN',
    'site.tagline': '국가·민족·언어·문화의 경계를 넘어 새로운 제3의 문화를 창조하는 국제 학술 네트워크',
    // 내비게이션 (5페이지 IA)
    'nav.home': '홈',
    'nav.about': '소개',
    'nav.aboutOverview': '학회 소개',
    'nav.history': '주요 연혁',
    'nav.founding': '창립총회',
    'nav.declaration': '창립 선언문',
    'nav.people': '구성원',
    'nav.events': '행사',
    'nav.eventAll': '전체 행사',
    'nav.seminars': '세미나',
    'nav.contact': '연락처',
    'nav.cta': '가입·문의',
    // 공통 라벨
    'common.skipToContent': '본문 바로가기',
    'common.menu': '메뉴',
    'common.close': '닫기',
    'common.readMore': '자세히 보기',
    'common.back': '뒤로',
    'common.language': '언어',
    'common.upcoming': '예정',
    'common.past': '지난',
    'common.tba': '추후 공개',
    // 푸터
    'footer.office': '사무국',
    'footer.officeValue': '대한민국 서울',
    'footer.copyright': '초문화네트워크(Transcultural Network)',
    'footer.contactNote': '연락처 추후 안내',
  },
  en: {
    'site.name': 'Transcultural Network',
    'site.nameEn': 'Transcultural Network',
    'site.abbr': 'TCN',
    'site.tagline': 'An international scholarly network creating a new third culture beyond the boundaries of nation, ethnicity, language, and culture',
    'nav.home': 'Home',
    'nav.about': 'About',
    'nav.aboutOverview': 'About TCN',
    'nav.history': 'Milestones',
    'nav.founding': 'Founding Ceremony',
    'nav.declaration': 'Founding Declaration',
    'nav.people': 'People',
    'nav.events': 'Events',
    'nav.eventAll': 'All events',
    'nav.seminars': 'Seminars',
    'nav.contact': 'Contact',
    'nav.cta': 'Join / Contact',
    'common.skipToContent': 'Skip to content',
    'common.menu': 'Menu',
    'common.close': 'Close',
    'common.readMore': 'Read more',
    'common.back': 'Back',
    'common.language': 'Language',
    'common.upcoming': 'Upcoming',
    'common.past': 'Past',
    'common.tba': 'To be announced',
    'footer.office': 'Secretariat',
    'footer.officeValue': 'Seoul, Republic of Korea',
    'footer.copyright': 'Transcultural Network',
    'footer.contactNote': 'Contact details to be announced',
  },
} as const;

export type UiLang = keyof typeof ui;
export type UiKey = keyof (typeof ui)[typeof defaultLang];
