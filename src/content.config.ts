// Astro 7 Content Layer — 영어 단일 JSON 데이터 컬렉션과 Zod 스키마.
// 데이터는 src/data/*.json (file 로더). 각 항목의 "id"가 엔트리 키(slug).
import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';
import { z } from 'astro/zod';

// 세미나·게시글은 컬렉션이 아니라 D1(src/lib/db/posts.ts)이 소유한다. 여기 정의하면 이중 스키마가 된다.
// (구 src/lib/content 어댑터와 Supabase 스냅샷 폴백은 제거됨 — CHANGELOG 참조.)
const members = defineCollection({
  loader: file('src/data/members.json'),
  schema: z.object({
    name: z.string(),
    role: z.string(),
    category: z.enum(['board', 'advisor', 'member']),
    group: z.enum(['leadership', 'directors', 'support']).optional(),
    order: z.number().default(0),
    affiliation: z.string().optional(),
    position: z.string().optional(),
    summary: z.string().optional(),
    bio: z.array(z.string()).optional(),
    highlights: z.array(z.string()).optional(),
    expertise: z.array(z.string()).optional(),
    country: z.string().optional(),
    tba: z.boolean().default(false), // 실명 미확보 → "추후 공개" 카드
    photo: z.string().optional(),
    email: z.string().optional(),
    website: z.string().optional(),
  }),
});

const invitations = defineCollection({
  loader: file('src/data/invitations.json'),
  schema: z.object({
    year: z.number(),
    slug: z.string(),
    title: z.string(),
    shortTitle: z.string(),
    date: z.string(),
    status: z.enum(['upcoming', 'past']),
    location: z.string(),
    venue: z.string(),
    mapUrl: z.url().optional(),
    time: z.string(),
    summary: z.string(),
    paragraphs: z.array(z.string()),
    program: z.array(z.string()),
    closing: z.array(z.string()),
    issuedAt: z.string(),
    sender: z.string(),
    source: z.string().optional(),
  }),
});

export const collections = { members, invitations };
