// About 연혁 중 Post가 아닌 기관 고유 기록만 정적으로 유지한다.
// 세미나 기록은 D1 posts에서 공통 SeminarView로 파생한다.

export interface OrganizationMilestone {
  date: string; // YYYY-MM-DD
  title: string;
  location: string;
  description: string;
}

export const organizationMilestones: OrganizationMilestone[] = [
  {
    date: '2025-12-12',
    title: 'Founding of the Transcultural Network',
    location: 'Sungkyunkwan University, Seoul, Republic of Korea',
    description: 'The founding assembly reviewed the bylaws and formally declared the Network’s establishment.',
  },
];
