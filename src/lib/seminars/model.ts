import type { Post } from '../db/types';
import { seminarHref } from './url';

export type SeminarStatus = 'upcoming' | 'today' | 'held';

export type SeminarView = Omit<Post, 'eventDate'> & {
  eventDate: string;
  sequence: number;
  status: SeminarStatus;
  ordinalLabel: string;
  href: `/seminars/${string}`;
};

export interface SeminarCollection {
  chronological: SeminarView[];
  upcoming: SeminarView[];
  past: SeminarView[];
  next: SeminarView | null;
  latestPast: SeminarView | null;
}

export interface OrganizationMilestoneInput {
  date: string;
  title: string;
  location: string;
  description: string;
}

export interface MilestoneView extends OrganizationMilestoneInput {
  kind: 'organization' | 'seminar';
  status: SeminarStatus;
  href: string | null;
}

const ORDINAL_WORDS = [
  'First',
  'Second',
  'Third',
  'Fourth',
  'Fifth',
  'Sixth',
  'Seventh',
  'Eighth',
  'Ninth',
  'Tenth',
] as const;

export function siteToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function formatSeminarOrdinalLabel(sequence: number): string {
  const word = ORDINAL_WORDS[sequence - 1];
  if (word) return `${word} International Seminar`;
  const mod100 = sequence % 100;
  const mod10 = sequence % 10;
  let suffix = 'th';
  if (mod100 < 11 || mod100 > 13) {
    if (mod10 === 1) suffix = 'st';
    if (mod10 === 2) suffix = 'nd';
    if (mod10 === 3) suffix = 'rd';
  }
  return `${sequence}${suffix} International Seminar`;
}

export function seminarStatus(eventDate: string, today: string): SeminarStatus {
  if (eventDate < today) return 'held';
  if (eventDate === today) return 'today';
  return 'upcoming';
}

export function deriveSeminarCollection(posts: Post[], today: string): SeminarCollection {
  const dated = posts
    .filter((post): post is Post & { eventDate: string } => Boolean(post.eventDate))
    .toSorted((a, b) => a.eventDate.localeCompare(b.eventDate));
  const duplicate = dated.find((post, index) => post.eventDate === dated[index - 1]?.eventDate);
  if (duplicate) throw new Error(`Duplicate seminar event date: ${duplicate.eventDate}`);

  const chronological = dated.map((post, index) => {
    const sequence = index + 1;
    const href = seminarHref(post.eventDate);
    if (!href) throw new Error(`Invalid seminar event date: ${post.eventDate}`);
    return {
      ...post,
      sequence,
      status: seminarStatus(post.eventDate, today),
      ordinalLabel: formatSeminarOrdinalLabel(sequence),
      href,
    } satisfies SeminarView;
  });
  const upcoming = chronological.filter((seminar) => seminar.status !== 'held');
  const past = chronological.filter((seminar) => seminar.status === 'held').toReversed();

  return {
    chronological,
    upcoming,
    past,
    next: upcoming[0] ?? null,
    latestPast: past[0] ?? null,
  };
}

export function mergeMilestones(
  organization: OrganizationMilestoneInput[],
  seminars: SeminarView[],
  today: string,
): MilestoneView[] {
  const organizationViews: MilestoneView[] = organization.map((milestone) => ({
    ...milestone,
    kind: 'organization',
    status: seminarStatus(milestone.date, today),
    href: null,
  }));
  const seminarViews: MilestoneView[] = seminars.map((seminar) => ({
    date: seminar.eventDate,
    kind: 'seminar',
    status: seminar.status,
    title: seminar.ordinalLabel,
    location: seminar.address ?? '',
    description: seminar.summary ?? '',
    href: seminar.href,
  }));
  return [...organizationViews, ...seminarViews].toSorted((a, b) => a.date.localeCompare(b.date));
}
