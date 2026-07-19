// L6: Astro 5 Content Layer — 데이터 컬렉션(Zod 스키마). ko 기본, en은 L16.
// 데이터는 src/data/*.json (file 로더). 각 항목의 "id"가 엔트리 키(slug).
import { defineCollection, z } from 'astro:content';
import { file } from 'astro/loaders';

const seminars = defineCollection({
  loader: file('src/data/seminars.json'),
  schema: z.object({
    lang: z.enum(['ko', 'en']).default('ko'),
    title: z.string(),
    date: z.string(), // ISO(YYYY-MM-DD) — 문자열 유지(정렬은 사전순으로 충분)
    status: z.enum(['upcoming', 'past']),
    location: z.string(),
    speaker: z.string().optional(),
    affiliation: z.string().optional(),
    abstract: z.string().optional(),
    materialsUrl: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
});

const members = defineCollection({
  loader: file('src/data/members.json'),
  schema: z.object({
    lang: z.enum(['ko', 'en']).default('ko'),
    name: z.string(),
    nameEn: z.string().optional(),
    role: z.string(),
    category: z.enum(['board', 'advisor', 'member']),
    order: z.number().default(0),
    affiliation: z.string().optional(),
    bio: z.array(z.string()).optional(),
    country: z.string().optional(),
    tba: z.boolean().default(false), // 실명 미확보 → "추후 공개" 카드
    photo: z.string().optional(),
    email: z.string().optional(),
    website: z.string().optional(),
  }),
});

const history = defineCollection({
  loader: file('src/data/history.json'),
  schema: z.object({
    lang: z.enum(['ko', 'en']).default('ko'),
    year: z.string().optional(),
    date: z.string(),
    title: z.string(),
    description: z.string(),
  }),
});

const invitations = defineCollection({
  loader: file('src/data/invitations.json'),
  schema: z.object({
    lang: z.enum(['ko', 'en']).default('ko'),
    year: z.number(),
    slug: z.string(),
    title: z.string(),
    shortTitle: z.string(),
    date: z.string(),
    status: z.enum(['upcoming', 'past']),
    location: z.string(),
    venue: z.string(),
    mapUrl: z.string().url().optional(),
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

export const collections = { seminars, members, history, invitations };
