// About 연혁 중 Post가 아닌 기관 고유 기록만 정적으로 유지한다.
// 세미나 기록은 D1 posts에서 공통 SeminarView로 파생한다.
import type { OrganizationMilestoneInput } from '../lib/seminars';

export const organizationMilestones: OrganizationMilestoneInput[] = [
  {
    date: '2024-11-30',
    dateLabel: 'Nov 2024–Jun 2025',
    title: 'Preparations for the Founding of the Transcultural Network',
    location: '',
    description:
      'Two meetings moved the Network from a shared founding decision to practical preparations for its establishment.',
    stages: [
      {
        date: '2024-11-30',
        title: 'The decision to found TCN',
        description:
          'Following the seminar, participants resolved to establish the Transcultural Network.',
        media: [
          {
            src: 'prefounding-meeting-01',
            alt: 'Seminar participants standing together in a conference room',
            caption: 'The seminar participants who resolved to establish TCN.',
          },
          {
            src: 'prefounding-meeting-02',
            alt: 'Seminar participants seated together in a lounge',
            caption: 'Founding participants gathered after the seminar.',
          },
          {
            src: 'prefounding-meeting-04',
            alt: 'Participants posing outside the Academy of Korean Studies after the seminar',
            caption: 'Commemorating the decision at the Academy of Korean Studies.',
          },
        ],
      },
      {
        date: '2025-06-17',
        title: 'Practical preparations begin',
        description:
          'After the seminar at the National Assembly, participants discussed the practical work needed to establish the Network.',
        media: [
          {
            src: 'prefounding-meeting-03',
            alt: 'Participants posing on a staircase at the National Assembly',
            caption: 'The National Assembly seminar that led into TCN’s practical preparations.',
          },
        ],
      },
    ],
  },
  {
    date: '2025-12-12',
    title: 'Founding of the Transcultural Network',
    location: 'Sungkyunkwan University, Seoul, Republic of Korea',
    description:
      'The founding assembly reviewed the bylaws and formally declared the Network’s establishment.',
  },
];
