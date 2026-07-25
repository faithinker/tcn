import type { ContentLocale, PublicContentSnapshot, PublicSeminar } from './types';

export interface HomeSeminarSelection {
  next?: PublicSeminar;
  featured?: PublicSeminar;
}

export function selectHomeSeminars(
  snapshot: PublicContentSnapshot,
  locale: ContentLocale,
): HomeSeminarSelection {
  const seminars = snapshot.seminars.filter((seminar) => seminar.locale === locale);
  const upcoming = seminars
    .filter((seminar) => seminar.temporalStatus === 'upcoming')
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = seminars
    .filter((seminar) => seminar.temporalStatus === 'past')
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const next = upcoming[0];
  const featured = past[0] ?? upcoming.find((seminar) => seminar !== next);
  return { next, featured };
}
