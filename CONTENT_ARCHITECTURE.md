# TCN Content Architecture

Updated: 2026-07-20

Runtime: Astro 7 static build

Localized routes: Korean (`/ko/`) and English (`/en/`)

Root routing: `/` redirects by saved `tcn_locale` preference, then by country (`KR` → `/ko/`, all others → `/en/`)

## 1. Source and publication policy

Public content must be backed by the founding declaration, bylaws, invitation, or confirmed questionnaire responses. Do not invent officer names, affiliations, seminar programmes, contact channels, fees, or registration links.

Missing information uses an explicit public fallback such as `추후 공개` or `To be announced`. Internal markers such as `[필요]` must never render. Officer photographs remain unpublished until both the image and consent are confirmed.

## 2. Current information architecture

The five top-level navigation items are Home, About, People, Seminars, and Contact. Korean and English use the same page components and route shape.

| Korean route | English route | Source |
| --- | --- | --- |
| `/ko/` | `/en/` | `content.ts`, seminar summary |
| `/ko/about` | `/en/about` | `content.ts`, `history.json` |
| `/ko/about/founding` | `/en/about/founding` | `content.ts`, `invitations.json` |
| `/ko/about/declaration` | `/en/about/declaration` | `content.ts` |
| `/ko/about/bylaws` | `/en/about/bylaws` | `content.ts`, `2512TCN정관.docx` |
| `/ko/people` | `/en/people` | `content.ts`, `members.json` |
| `/ko/seminars` | `/en/seminars` | `content.ts`, `seminars.json` |
| `/ko/seminars/[slug]` | `/en/seminars/[slug]` | `seminars.json` |
| `/ko/contact` | `/en/contact` | `content.ts`, optional `PUBLIC_MEMBERSHIP_FORM_URL` |

`functions/index.js` handles only `/`; `public/_routes.json` keeps every localized page and asset on the static path. The retired `/events` tree and prefixless Korean routes permanently redirect to `/ko/` equivalents through `public/_redirects`.

## 3. Content ownership

```text
src/
├── content.config.ts       # file-loader collections and Zod schemas
├── data/
│   ├── members.json        # leadership and board cards
│   ├── seminars.json       # seminar list/detail records
│   ├── history.json        # About timeline
│   └── invitations.json    # founding ceremony invitation
└── i18n/
    ├── content.ts          # page-level Korean and English copy
    ├── ui.ts               # shared navigation, labels, footer copy
    └── utils.ts            # language detection, paths, dates
```

`content.ts` owns editorial page copy. `ui.ts` owns short reusable interface strings. Repeatable factual records belong in JSON and are loaded through Astro Content Layer.

## 4. Collection schemas

All collections use `file()` from `astro/loaders` and are validated during `npm run check` and `npm run build`.

### `seminars`

Required fields:

- `id`: unique record key; English uses the Korean key plus `-en`
- `slug`: language-independent URL key shared by the ko/en pair
- `lang`: `ko` or `en`
- `title`, `date`, `status`, `location`

Optional confirmed detail fields include `theme`, `summary`, `abstract`, `program`, `speakers`, `materials`, `outcomes`, and `tags`. A missing detail body renders the localized “details to be announced” fallback.

List ordering is upcoming ascending and past descending. Detail routes are generated from every localized record.

### `members`

Required fields are `id`, `lang`, `name`, `role`, `category`, and `order`. Optional fields include `nameEn`, `affiliation`, `bio`, `country`, `photo`, `email`, and `website`.

Use `tba: true` only for a confirmed seat whose person is not yet public. Korean and English records use the same order and category.

### `history`

Required fields are `id`, `lang`, `date`, `kind`, `status`, `title`, `location`, `participants`, and `description`. Timeline records stay concise; longer seminar material belongs in `seminars.json`.

### `invitations`

This collection currently holds the bilingual founding ceremony invitation rendered at `/ko/about/founding` and `/en/about/founding`. Required fields include the shared `slug`, date/status/location/venue/time, invitation paragraphs, programme, closing, issued date, and sender.

The collection no longer generates `/events/[year]/[slug]` routes.

## 5. Korean/English pairing rules

Every repeatable record must have one Korean and one English entry.

- English `id` = Korean `id` + `-en`
- `slug`, `date`, `status`, ordering, categories, URLs, and time notation remain identical
- parallel arrays retain the same number and order of items
- translations may adapt wording but must not add unsupported facts
- English source strings must not contain Hangul
- every Korean wrapper under `src/pages/ko/` has an English wrapper under `src/pages/en/`

Run `npm run i18n` after any content or route change. It checks route pairs, content/UI object shapes, JSON record invariants, parallel array lengths, and Hangul leakage into English sources.

## 6. Editing workflows

### Add a seminar

1. Append Korean and English entries to `src/data/seminars.json`.
2. Reuse the same URL-safe `slug`; suffix only the English `id` with `-en`.
3. Add only confirmed optional details.
4. Run `npm run i18n`, `npm run check`, and `npm run build`.

The list and both localized detail routes are generated automatically.

### Update an officer

1. Update the matching ko/en records in `members.json`.
2. Keep `order`, `category`, country, and placeholder state aligned.
3. Do not add a photo without confirmed consent.
4. Run the i18n and build checks.

### Update the founding invitation

Edit both language entries in `invitations.json`. Keep factual fields and paragraph/programme structure aligned. The result appears on the localized `/ko/about/founding` and `/en/about/founding` pages.

### Update the bylaws

Edit the parallel `bylaws` entries in `content.ts`, preserving the chapter, article, clause, and addenda structure. The Korean text is authoritative; the English page is a reference translation and must not introduce unsupported meaning. Verify any amendment against the approved source document before publishing, then run the full bilingual and build checks.

### Change navigation or routes

Update the shared page/component first, add equivalent wrappers under both `src/pages/ko/` and `src/pages/en/`, then update `public/_redirects`, `src/pages/sitemap.xml.ts`, README, and this document. Finish with the full verification sequence.

## 7. Verification

```bash
npm run i18n   # ko/en source parity
npm run locale # country routing and saved-language precedence
npm run check  # Astro and schema diagnostics
npm run build  # all static routes
npm run motion # reveal, reduced-motion, fail-open behavior
npm run verify # viewport, overflow, console, screenshots
npm run a11y   # Lighthouse accessibility on representative routes
```

Content work is complete only when these checks pass and the Korean and English pages communicate the same confirmed facts.
