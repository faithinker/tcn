# TCN Content Architecture

Created: 2026-07-19
Source vault: `/Users/jhkim/Desktop/Obsidian/tcn`
Target app: `/Users/jhkim/Desktop/work/tcn`

## 1. Obsidian Content Structure

The Obsidian vault is compact and already separates planning from source content.

```text
/Users/jhkim/Desktop/Obsidian/tcn
├── TCN 사이트맵.html
├── TCN 웹사이트 콘텐츠 구조.md
├── contents
│   ├── TCN 콘텐츠.md
│   ├── TCN 웹사이트 - 고객 질문지.md
│   ├── 1212TCN초청장.docx
│   ├── 2512TCN정관.docx
│   └── Transcultural Network 창립 선언문.docx
└── dev
    ├── TCN 사이트 — 메뉴 구조 & 루프 실행 계획.md
    └── TCN 학회 소개 사이트 — 개발 계획.md
```

### Source Roles

| Source | Role | Implementation Use |
| --- | --- | --- |
| `TCN 웹사이트 콘텐츠 구조.md` | Canonical sitemap and content mapping | Page/section IA, status tracking, source provenance |
| `contents/TCN 웹사이트 - 고객 질문지.md` | Requirements tracker | Required/optional field policy, fallback policy |
| `contents/TCN 콘텐츠.md` | Compact factual memo | Initial seed data for officers and seminars |
| `contents/1212TCN초청장.docx` | Founding invitation | Founding event, founding rationale |
| `contents/2512TCN정관.docx` | Bylaws | Membership, organization, business areas |
| `contents/Transcultural Network 창립 선언문.docx` | Founding declaration | About declaration, mission, research areas |
| `dev/TCN 사이트 — 메뉴 구조 & 루프 실행 계획.md` | Build plan | Current 5-page IA and implementation milestones |
| `TCN 사이트맵.html` | Visual IA artifact | Human reference only, not a runtime source |

### Confirmed Facts

These can be seeded without asking again:

| Item | Value |
| --- | --- |
| Korean name | 초문화네트워크 |
| English name | Transcultural Network |
| Abbreviation | TCN |
| Definition | 디지털·AI 시대의 초문화 현상을 연구하는 국제 학술단체 |
| Secretariat | 대한민국 서울 |
| Founding | 2025-12-12, 성균관대 명륜캠퍼스 퇴계인문관 31511호 |
| Founding countries | 15 |
| Chair | Dr. Wonjoon Kim / 김원준 |
| Senior vice chair | 전성호 교수 |
| First seminar | 2025-12-26, 라오스 루앙프라방 |
| Upcoming seminar | 2026-10-30, 한국 |
| Default language | Korean at `/` |
| Optional language | English at `/en/` later |

### Missing or Deferred Content

Missing content should not block the first build. Do not render `[필요]` or internal status markers on the public site.

| Area | Missing | Build Behavior |
| --- | --- | --- |
| Slogan | Official short slogan | Use declaration-based hero line |
| Directors | China/Vietnam/Laos/Uzbekistan names and affiliations | Render `To be announced` country cards if needed |
| Auditor | John Lee affiliation | Render name with affiliation fallback |
| Officer photos | Photos and consent | Text-only cards with monograms |
| Second seminar | Venue, topic, program, registration, fee | Show date/country and `Details to be announced` |
| First seminar | Topic, speakers, materials | Show date/location/countries only |
| Contact | Email, address, phone | Show `Contact details coming soon` |
| News/resources | Operational cadence and assets | Keep routes deferred |

## 2. Astro Content Collection Design

Use Astro content collections through `src/content.config.ts` and `src/content/`.

Astro 5 supports defining collections with:

- `defineCollection` from `astro:content`
- `glob` from `astro/loaders`
- `z` from `astro/zod`
- `getCollection()` in pages/components

### Collection Overview

```text
src/content.config.ts
src/content/
├── site/
│   └── ko.md
├── declarations/
│   └── founding.ko.md
├── members/
│   ├── wonjoon-kim.md
│   ├── sung-ho-jeon.md
│   ├── director-china.md
│   ├── director-vietnam.md
│   ├── director-laos.md
│   ├── director-uzbekistan.md
│   └── john-lee.md
├── seminars/
│   ├── founding-assembly-2025.md
│   ├── luang-prabang-2025.md
│   └── korea-2026.md
└── history/
    ├── founding-assembly-2025.md
    ├── first-seminar-2025.md
    └── second-seminar-2026.md
```

Recommended route mapping:

| Route | Collections Used |
| --- | --- |
| `/` | `site`, `seminars`, `history` summary |
| `/about` | `site`, `history` |
| `/about/declaration` | `declarations` |
| `/people` | `members` |
| `/events` | `invitations`, `seminars` |
| `/events/[year]` | `invitations`, `seminars` filtered by year |
| `/events/[year]/[slug]` | `invitations` |
| `/contact` | `site` |

### `site` Collection

Purpose: stable organization-level data and copy that is not a repeatable article.

```ts
const site = defineCollection({
  loader: glob({ base: './src/content/site', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    lang: z.enum(['ko', 'en']).default('ko'),
    nameKo: z.string(),
    nameEn: z.string(),
    abbreviation: z.string(),
    tagline: z.string(),
    description: z.string(),
    office: z.string(),
    contactEmail: z.string().email().optional(),
    contactNote: z.string().optional(),
    foundedAt: z.coerce.date(),
    foundingLocation: z.string(),
    foundingCountryCount: z.number().int().positive().optional(),
    mission: z.array(z.string()),
    vision: z.string(),
    activities: z.array(z.string()),
    researchAreas: z.array(z.string()),
  }),
});
```

Use this for:

- hero copy
- mission/vision
- business/research areas
- office/contact fallback
- home stats

### `declarations` Collection

Purpose: long-form founding declaration, bylaws summary, and future official statements.

```ts
const declarations = defineCollection({
  loader: glob({ base: './src/content/declarations', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    lang: z.enum(['ko', 'en']).default('ko'),
    type: z.enum(['founding-declaration', 'bylaws-summary', 'statement']),
    date: z.coerce.date().optional(),
    source: z.string().optional(),
    order: z.number().int().default(0),
  }),
});
```

Use this for:

- `/about/declaration`
- future public statements
- bylaws summary if public download is approved

### `invitations` Collection

Purpose: annual event invitations and their public archive. The current implementation uses the file loader with `src/data/invitations.json`.

Each invitation must have a unique `id`, numeric `year`, URL-safe `slug`, ISO `date`, `status`, event location/time, invitation paragraphs, program, closing, and sender. Routes are generated automatically as `/events/{year}/{slug}` and the available years are derived from the data for the header and archive pages.

To add the 2026 invitation, append one object to `src/data/invitations.json`; do not add a year manually to the menu.

### `members` Collection

Purpose: officers, advisors, members, and future committees.

```ts
const members = defineCollection({
  loader: glob({ base: './src/content/members', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    name: z.string(),
    nameEn: z.string().optional(),
    role: z.enum([
      'chair',
      'senior-vice-chair',
      'vice-chair',
      'director',
      'auditor',
      'advisor',
      'member',
      'secretariat',
    ]),
    category: z.enum(['board', 'advisor', 'member', 'secretariat']),
    country: z.string().optional(),
    affiliation: z.string().optional(),
    title: z.string().optional(),
    expertise: z.array(z.string()).default([]),
    bio: z.string().optional(),
    website: z.string().url().optional(),
    photo: z.string().optional(),
    consentConfirmed: z.boolean().default(false),
    isPlaceholder: z.boolean().default(false),
    order: z.number().int().default(100),
  }),
});
```

Display policy:

- Sort by `order`.
- Group by `category`, then `role`.
- Hide empty `advisor`, `member`, and `secretariat` groups.
- Render monogram when `photo` is missing.
- Do not show photos unless `consentConfirmed` is `true`.
- Placeholder cards are acceptable only for known board seats and countries.

### `seminars` Collection

Purpose: event listings, upcoming seminars, archive, and detail pages.

```ts
const seminars = defineCollection({
  loader: glob({ base: './src/content/seminars', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    titleEn: z.string().optional(),
    date: z.coerce.date(),
    endDate: z.coerce.date().optional(),
    status: z.enum(['upcoming', 'past', 'draft']).default('draft'),
    kind: z.enum(['founding-assembly', 'seminar', 'symposium', 'conference']),
    location: z.string(),
    city: z.string().optional(),
    country: z.string().optional(),
    countries: z.array(z.string()).default([]),
    summary: z.string().optional(),
    theme: z.string().optional(),
    program: z.array(z.object({
      time: z.string().optional(),
      title: z.string(),
      speaker: z.string().optional(),
      affiliation: z.string().optional(),
    })).default([]),
    speakers: z.array(z.string()).default([]),
    materials: z.array(z.object({
      label: z.string(),
      url: z.string(),
      type: z.enum(['pdf', 'ppt', 'link', 'image', 'video']).default('link'),
    })).default([]),
    registrationUrl: z.string().url().optional(),
    isRegistrationOpen: z.boolean().default(false),
    order: z.number().int().default(100),
  }),
});
```

Display policy:

- `/seminars`: split by `status`, then sort upcoming ascending and past descending.
- Detail page fallback text: `Details to be announced`.
- Do not invent speakers, topics, fees, or registration links.
- Use future date logic only for UI grouping if `status` is missing, but prefer explicit `status`.

### `history` Collection

Purpose: About timeline, independent from seminars because not every history item is a seminar.

```ts
const history = defineCollection({
  loader: glob({ base: './src/content/history', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    year: z.number().int(),
    summary: z.string(),
    location: z.string().optional(),
    relatedSeminar: z.string().optional(),
    source: z.string().optional(),
    order: z.number().int().default(100),
  }),
});
```

Display policy:

- `/about#history`: chronological timeline.
- Link to `relatedSeminar` when present.
- Keep history factual and short; put long materials in seminars/resources.

## Seed Data Boundaries

Initial seed should include only source-backed data:

- Site identity and mission from declaration, bylaws, and customer-confirmed questionnaire.
- Members: chair, senior vice chair, directors by country placeholder, auditor John Lee.
- Seminars: founding assembly, first Luang Prabang seminar, upcoming Korea seminar.
- History: same three events, written as timeline entries.
- Declaration: Korean founding declaration body.

Do not seed:

- unconfirmed email
- unconfirmed legal status
- invented officer affiliations
- invented seminar programs
- images copied from external profiles without permission
- English translations as final copy unless approved

## Implementation Order

1. Add `src/content.config.ts`.
2. Add seed files under `src/content/`.
3. Run `npm run check`.
4. Replace home hard-coded highlights with `getCollection()`.
5. Build `/about`, `/people`, `/seminars`, `/seminars/[slug]`, `/contact`.
6. Run `npm run build` and visual checks.
