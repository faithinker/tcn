// JSON 데이터 컬렉션은 파일의 "id"를 엔트리 키로 사용한다.
import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';
import { z } from 'astro/zod';

// 세미나·게시글은 컬렉션이 아니라 D1(src/lib/db/posts.ts)이 소유한다. 여기 정의하면 이중 스키마가 된다.
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
