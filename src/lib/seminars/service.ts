import { listSeminarPosts } from '../db/posts';
import {
  deriveSeminarCollection,
  siteToday,
  type SeminarCollection,
  type SeminarView,
} from './model';

export async function getSeminarCollection(
  db: D1Database,
  today = siteToday(),
): Promise<SeminarCollection> {
  return deriveSeminarCollection(await listSeminarPosts(db), today);
}

export async function getSeminarByEventDate(
  db: D1Database,
  eventDate: string,
  today = siteToday(),
): Promise<SeminarView | null> {
  const collection = await getSeminarCollection(db, today);
  return collection.chronological.find((seminar) => seminar.eventDate === eventDate) ?? null;
}
