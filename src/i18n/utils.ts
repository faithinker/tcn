const EN_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** ISO 날짜의 날짜 부분을 영어 표기로. Date 객체 미사용(빌드 결정성). */
export function formatDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(iso);
  if (!match) return iso;
  const [, year, month, day] = match;
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return iso;
  return `${EN_MONTHS[m - 1]} ${d}, ${y}`;
}
