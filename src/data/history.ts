// About 연혁 — 확정된 기관 기록(정관·창립·세미나 일정)만 수록하는 정적 데이터.
// 세미나 상세 서사는 D1 글이 담당하고, 여기는 타임라인 사실만 유지한다.

export interface HistoryEntry {
  date: string; // YYYY-MM-DD
  kind: 'founding' | 'seminar';
  status: 'past' | 'upcoming';
  title: string;
  location: string;
  participants: string[];
  description: string;
}

export const history: HistoryEntry[] = [
  {
    date: '2025-12-12',
    kind: 'founding',
    status: 'past',
    title: 'Founding of the Transcultural Network',
    location: 'Sungkyunkwan University, Seoul, Republic of Korea',
    participants: ['Experts from 15 countries'],
    description: 'The founding assembly reviewed the bylaws and formally declared the Network’s establishment.',
  },
  {
    date: '2025-12-26',
    kind: 'seminar',
    status: 'past',
    title: 'First International Seminar',
    location: 'Luang Prabang, Laos',
    participants: ['Korea', 'Vietnam', 'Laos'],
    description: 'Experts from the three countries convened for the first international seminar.',
  },
  {
    date: '2026-10-30',
    kind: 'seminar',
    status: 'upcoming',
    title: 'Second International Seminar',
    location: 'TCN Headquarters, Incheon, Republic of Korea',
    participants: [],
    description: 'The second international seminar is scheduled to take place.',
  },
];
