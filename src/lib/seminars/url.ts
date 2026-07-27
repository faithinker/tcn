const EVENT_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isSeminarEventDate(value: string | null | undefined): value is string {
  if (!value) return false;
  const match = EVENT_DATE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function seminarHref(eventDate: string | null | undefined): `/seminars/${string}` | null {
  if (!isSeminarEventDate(eventDate)) return null;
  return `/seminars/${eventDate}`;
}
