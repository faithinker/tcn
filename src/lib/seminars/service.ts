import { getPostByEventDate, getSeminarSequence, listSeminarPosts } from '../db/posts';
import {
  deriveSeminarCollection,
  siteToday,
  toSeminarView,
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
  const post = await getPostByEventDate(db, eventDate);
  if (!post?.eventDate) return null;
  const sequence = Math.max(1, await getSeminarSequence(db, eventDate));
  return toSeminarView({ ...post, eventDate: post.eventDate }, sequence, today);
}
