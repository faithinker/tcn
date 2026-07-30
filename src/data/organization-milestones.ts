// About 연혁 중 Post가 아닌 기관 고유 기록만 정적으로 유지한다.
// 세미나 기록은 D1 posts에서 공통 SeminarView로 파생한다.
import type { OrganizationMilestoneInput } from '../lib/seminars';

export const organizationMilestones: OrganizationMilestoneInput[] = [
  {
    // 정확한 날짜는 확인되지 않았다. 정렬에는 여름의 시작 월을 사용하고 공개 표기는 한정한다.
    date: '2025-06',
    dateLabel: 'Summer 2025',
    title: 'Preparatory Meeting for the Founding of the Transcultural Network',
    location: '',
    description:
      'Participants met in summer 2025 to prepare for the establishment of the Transcultural Network.',
    media: [
      {
        src: 'prefounding-meeting-01',
        alt: 'Participants standing together in a conference room',
        caption: 'Participants gathered in the meeting room.',
      },
      {
        src: 'prefounding-meeting-02',
        alt: 'Participants seated together in a lounge',
        caption: 'Participants gathered in a lounge during the meeting.',
      },
      {
        src: 'prefounding-meeting-03',
        alt: 'A large group of participants posing together on an indoor staircase',
        caption: 'A group photograph from the founding preparatory meeting.',
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
