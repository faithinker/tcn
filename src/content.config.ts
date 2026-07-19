// Astro 5 Content Layer — ko/en JSON 데이터 컬렉션과 Zod 스키마.
// 데이터는 src/data/*.json (file 로더). 각 항목의 "id"가 엔트리 키(slug).
import { defineCollection, z } from 'astro:content';
import { file } from 'astro/loaders';

const seminars = defineCollection({
  loader: file('src/data/seminars.json'),
  schema: z.object({
    lang: z.enum(['ko', 'en']).default('ko'),
    slug: z.string(), // 언어 무관 상세 라우트 키(ko/en 공통) → /seminars/[slug]
    title: z.string(),
    date: z.string(), // ISO(YYYY-MM-DD) — 문자열 유지(정렬은 사전순으로 충분)
    status: z.enum(['upcoming', 'past']),
    location: z.string(),
    speaker: z.string().optional(),
    affiliation: z.string().optional(),
    theme: z.string().optional(),
    summary: z.string().optional(),
    abstract: z.string().optional(),
    program: z.array(z.string()).optional(),
    speakers: z.array(z.string()).optional(),
    materials: z.array(z.object({ label: z.string(), url: z.string() })).optional(),
    materialsUrl: z.string().optional(),
    outcomes: z.array(z.string()).optional(),
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
    date: z.string(),
    kind: z.enum(['founding', 'seminar']),
    status: z.enum(['past', 'upcoming']),
    title: z.string(),
    location: z.string(),
    participants: z.array(z.string()).default([]),
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
