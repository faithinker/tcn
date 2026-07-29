# Changelog

All notable changes to this project will be documented in this file. AI agents (Claude, Codex, etc.) must update this file before opening a Pull Request.

## [2026-07-29]
### Feature
- Added a public D1-backed Q&A board with question submission, waiting/answered filters, stable pagination, official administrator answers, visibility controls, and responsive public and admin views. (Branch: `codex/qna-mvp`) - Implemented by Codex
- Reorganized the authenticated admin area as a flat Posts/Questions workspace with active navigation, contextual page actions, live waiting-question counts, and responsive task-focused lists. (Branch: `codex/qna-mvp`) - Implemented by Codex
### Security
- Protected Q&A writes with canonical Cloudflare Turnstile verification, hostname validation, replay prevention, HMAC-derived dual-window rate limits, CSRF checks, optimistic revisions, atomic privacy-minimal audit events, no-store admin responses, and safe plain-text rendering. (Branch: `codex/qna-mvp`) - Implemented by Codex
### Fix
- Removed the duplicate desktop Contact navigation item and prevented administrator answer text from gaining leading whitespace or indentation after editing and publishing. (Branch: `codex/qna-mvp`) - Implemented by Codex
### Refactor
- Consolidated duplicated administrator Q&A mutation plumbing and aligned Sonar coverage scope with the browser-executed scripts already excluded from Vitest coverage. (Branch: `codex/qna-mvp`) - Implemented by Codex
### Test
- Added unit, contract, D1 integration, security, concurrency, pagination, and browser coverage for the Q&A lifecycle and administrator count synchronization. (Branch: `codex/qna-mvp`) - Implemented by Codex

## [2026-07-28]
### Changed
- Removed the duplicated degree details from Dr. SeongHo Jun's profile summary, leaving the existing education highlight intact and focusing the summary on his research areas. (Branch: `content/seongho-summary-dedup`) - Implemented by Codex
- Corrected the board profiles on `/people`: removed the Asia Competition Association attaché title from Dr. Wonjoon Kim's current role, restated Dr. Zhang Wen's research summary around East Asian economic history, modern banking history, and traditional accounting in China and Korea (realigning her expertise tags to match), gave her SUSTech post its term (Sep 2019 – Nov 2021), and added Dr. Le Lan Huong's doctoral thesis title. (Branch: `content/people-profile-updates`) - Implemented by Claude
- Unified the doctorate notation as `Ph.D` across all thirteen mentions, and surfaced the degree line for Dr. Wonjoon Kim and Dr. SeongHo Jun — both doctorates existed only in the unrendered `bio` field, so the site had never shown them. (Branch: `content/people-profile-updates`) - Implemented by Claude
- Recast all seven profile summaries as pronoun-free prose rather than switching to a `Research interests:` label: four of the seven describe roles and career facts a research label cannot hold, and for the two that would fit, the label restates the expertise chips directly beneath it. (Branch: `content/people-profile-updates`) - Implemented by Claude
- Refreshed the README facts (linked deployment URLs, dropped the founding-country count, named the first seminar venue), documented that Codex runs as `codex --profile tcn` against this repository, and scoped `.codex/config.toml` to enable the five Cloudflare MCP servers while switching off the Apple-native ones the global config keeps on for iOS work. (Branch: `content/people-profile-updates`) - Implemented by Claude
- Recorded the outstanding first-seminar content in `CONTENT_ARCHITECTURE.md`: Dr. SeongHo Jun's presentation is still to come, and that copy lives in D1 rather than in this repository. (Branch: `content/people-profile-updates`) - Implemented by Claude
### Refactor
- Removed the orphaned `bio` field from `members.json` and the collection schema. It was rendered by the list variant of `/people`, which `ed2a026` deleted when the profile-card layout became the only layout; nothing had read it since. Three facts that lived nowhere else were promoted into the rendered highlights first, and the `officer-card` entry in `DESIGN.md` — which described a "serif bio" and an avatar on a component that does not exist — was replaced with the anatomy `MemberProfileCard` actually ships. (Branch: `content/people-profile-updates`) - Implemented by Claude

## [2026-07-27]
### Feature
- Added a responsive founding-assembly event record with seven photographs, a lazy-loaded short film, high-resolution lightbox zoom and pan, captions, and original-image downloads. (Branch: `feat/content`) - Implemented by Codex
- Hardened the admin post and media lifecycle with validated payloads, optimistic revisions, streaming uploads, cleanup reconciliation, transcript-aware video publishing, and resilient editor feedback. (Branch: `fix/routing-audit`) - Implemented by Codex
- Applied the shared full-screen previous/next media carousel to seminar hero and gallery photographs, including keyboard navigation and focus restoration. (Branch: `feat/media-carousel`) - Implemented by Codex
### Changed
- Simplified the founding-assembly media viewer to a full-screen previous/next carousel, removing zoom, pan, original-file controls, and high-resolution zoom derivatives. (Branch: `feat/media-carousel`) - Implemented by Codex
### Fix
- Restored admin editor hydration: the domain-barrel refactor had routed the client bundle through `seminar-service` → `cloudflare:workers`, which browsers cannot load, leaving every editor control dead; the seminars barrel now exports only isomorphic modules and server routes import the service directly. (Branch: `refactor/structure-slices`) - Implemented by Claude
- Matched the related-document links to the About menu order: Founding Ceremony, Founding Declaration, then Bylaws. (Branch: `fix/related-documents-order`) - Implemented by Codex
- Lowered the desktop navigation breakpoint from 1280px to 896px and added a 1152px tier that compresses logo and item spacing, so tablets and small laptops show the horizontal nav instead of the hamburger while keeping 48px touch targets and no horizontal overflow. (Branch: `fix/header-nav-breakpoint`) - Implemented by Codex
- Hardened browser route verification by treating DOM readiness as the navigation gate and making `networkidle` an optional stabilization wait for CI. (Branch: `feat/media-carousel`) - Implemented by Codex
- Prevented canonical middleware from turning prerendered static pages into production redirect documents during Worker builds. (Branch: `fix/prerender-canonical-build`) - Implemented by Codex
- Clarified the Souphanouvong University profile title as “Dean of the Faculty of Economics and Tourism.” (Branch: `fix/souphanouvong-dean-title`) - Implemented by Codex
- Switched Cloudflare image derivatives to build-time generation, added a range-capable mobile preview, and kept the fitted image when high-resolution decoding fails. (Branch: `feat/content`) - Implemented by Codex
- Standardized slashless canonical URLs and one-hop legacy redirects, separated liveness from dependency readiness, prevented static-asset redirect loops, and normalized byte-range delivery for public media. (Branch: `fix/routing-audit`) - Implemented by Codex
- Resolved PR quality-gate findings by removing pseudorandom notification jitter and simplifying routing, payload, upload, editor, and post-update control flow. (Branch: `fix/routing-audit`) - Implemented by Codex
- Fixed Cloudflare static-page self-redirect loops by building slashless routes as `.html` files and delegating trailing-slash normalization to Workers Static Assets and middleware. (Branch: `fix/static-redirect-loop`) - Implemented by Codex
### Refactor
- Collapsed the eight 1:1 page-template wrappers into `src/pages` (a `/ko`·`/en`-era indirection), moved the one real prop-receiving template to `src/components/seminars/CommunityPost.astro`, and kept the prerender set identical. (Branch: `refactor/structure-slices`) - Implemented by Claude
- Normalized `src/lib` into domain folders (`media/`, `seminars/`, `posts/` with barrels matching the `db`/`auth`/`notify` convention) and collected the six route-contract test suites under `lib/routes/`; coverage identical to baseline proves the move-only slice. (Branch: `refactor/structure-slices`) - Implemented by Claude
- Extracted the PostEditor save-error copy into a unit-tested `editor-messages.ts` module and deleted the orphaned 1,613-line `admin.css` that nothing imported. (Branch: `refactor/structure-slices`) - Implemented by Claude
- Moved the three hardcoded seminar-detail labels into `i18n/content.ts` per the content-source rule, and synced `CONTENT_ARCHITECTURE.md` and `README.md` with the measured route/data reality. (Branch: `refactor/structure-slices`) - Implemented by Claude
- Decomposed the 777-line PostEditor into a state-owning container plus four presentational components (PostFields, BodyEditor, MediaManager, ReadinessAside) with pure media-ordering and readiness modules, and removed the unused `renderPostBody` wrapper — behavioral equivalence proven by the identical `verify:admin` gate results before and after. (Branch: `refactor/structure-slices`) - Implemented by Claude
- Separated admin media into an image grid and compact file list, removed captions from non-image uploads, and kept reordering within each media group. (Branch: `feat/seminar-content-contract`) - Implemented by Codex
- Moved carousel entries and safe manifest serialization into a shared media contract used by founding and seminar pages. (Branch: `feat/media-carousel`) - Implemented by Codex
### Security
- Stopped dependency lifecycle scripts from running in the CI Run and production deploy jobs by adding `--ignore-scripts` to their `npm ci`, matching the Browser Gates job that already installed this way; the deploy job holds `CLOUDFLARE_API_TOKEN`, so a malicious `postinstall` in any transitive dependency had access to it. (Branch: `fix/ci-ignore-scripts`) - Implemented by Claude
- Stopped resolving the `wrangler` binary through `PATH` in the seed and create-user scripts by pointing `execFileSync` at the repository's own `node_modules/.bin/wrangler`, resolved from the script location so both still run from any working directory. (Branch: `fix/script-binary-paths`) - Implemented by Claude
- Added account-and-IP login throttling with hashed identifiers, versioned session revocation, dependency audit enforcement, and bounded notification retries with timeouts. (Branch: `fix/routing-audit`) - Implemented by Codex
### Test
- Added a `Sonar (main)` workflow so the main branch keeps being analyzed after SonarCloud Automatic Analysis was disabled — without it the "New Code" baseline that PR analysis compares against would freeze at the last automatic run. (Branch: `ci/sonar-main-analysis`) - Implemented by Claude
- Added a browser gate for the whole admin authoring flow (login, post creation, Tiptap body, image uploads with client-side WebP processing, captions, reordering, readiness, public reflection, soft delete, console cleanliness), wired as `verify:admin` in CI; it proved behavioral equivalence for the PostEditor decomposition and caught the hydration regression on its first run. (Branch: `refactor/structure-slices`) - Implemented by Claude
- Locked vitest coverage thresholds to the measured baseline (84/73/85/88) so refactoring slices cannot silently lower coverage, and added unit tests for the admin editor error-message mapping, media ordering, and readiness computation. (Branch: `refactor/structure-slices`) - Implemented by Claude
- Added route-contract assertions and CI browser gates for canonical redirects, missing seminar pages, responsive rendering, console errors, and accessibility. (Branch: `test/route-contracts-ci`) - Implemented by Codex
- Added data-contract and browser regression checks for master-image integrity, lazy video loading, HTTP range support, zoom and pan, keyboard focus, and mobile layout. (Branch: `feat/content`) - Implemented by Codex
- Stabilized high-resolution lightbox interaction checks against CI image-transcoding delays by serving the verified 4000px master during the browser test. (Branch: `feat/content`) - Implemented by Codex
- Expanded routing, authentication, API, media, concurrency, and Worker contract coverage and moved browser gates to the built Wrangler runtime. (Branch: `fix/routing-audit`) - Implemented by Codex
- Added local-only seminar media fixtures and CI browser checks for hero-first ordering, fallback captions, wraparound navigation, live announcements, and focus restoration. (Branch: `feat/media-carousel`) - Implemented by Codex
### Chore
- Raised the PR review job's turn budget from 6 to 15. At 6 it failed with `error_max_turns` and no findings on two of four pull requests, on a 79-file diff and a 28-line one alike, so the cap rather than the diff size was the cause. (Branch: `chore/ci-review-turns-and-blame-ignore`) - Implemented by Claude
- Added `.git-blame-ignore-revs` listing the repository-wide Prettier reformat, so blame points at the author of the logic rather than at the formatter run. GitHub reads the file automatically; locally it needs `git config blame.ignoreRevsFile .git-blame-ignore-revs`. (Branch: `chore/ci-review-turns-and-blame-ignore`) - Implemented by Claude
- Added additive D1 migrations, deployment readiness smoke checks with automatic rollback, a staging configuration template, and an operations runbook covering D1 Time Travel and R2 recovery. (Branch: `fix/routing-audit`) - Implemented by Codex
- Added Prettier with the Astro plugin, configured from the existing sources (2-space indent, single quotes, semicolons, trailing commas, printWidth 100) so adopting it does not rewrite the house style, and left the 78 already-differing files unformatted for a separate reviewable change. (Branch: `chore/prettier-setup`) - Implemented by Claude
- Removed a dangling `[mcp_servers.gitlab]` override from the project Codex config that declared no transport and aborted config loading with "invalid transport". (Branch: `chore/prettier-setup`) - Implemented by Claude
- Added `IDEA.md` recording the project definition, target users, goals, content and product principles, the priority order for conflicting decisions, scope boundaries, and the definition of done. (Branch: `fix/header-nav-breakpoint`)
- Applied Prettier across the repository (79 files), a mechanical reformat with no behavioural change: every file matches `prettier --write` applied to its previous content exactly. (Branch: `chore/format-repo`) - Implemented by Claude

## [2026-07-26]
### Changed (BREAKING)
- English-single site: removed `/ko`·`/en` route trees; root tree serves English copy, legacy URLs 301 via `public/_redirects`. (Branch: `feat/cloudflare-migration`) - Implemented by Claude
- Public pages now read Cloudflare D1 directly (home hero, seminars list, post detail, sitemap) - publishing a post is live immediately, no rebuild. - Implemented by Claude
### Added
- Discord/Telegram notifications on post create/update via `waitUntil` (best-effort, per-channel retry). - Implemented by Claude
- Seed script `scripts/seed-seminar-posts.mjs` migrating the two seminars into D1 posts (idempotent). - Implemented by Claude
- Workers deploy workflow `deploy-workers.yml` (check+test+build+`wrangler deploy`); retired `deploy-pages.yml`. - Implemented by Claude
- Added a shared date-derived seminar collection that powers Home, Seminars, and About milestones, with canonical `/seminars/YYYY-MM-DD` routes, sitemap entries, and legacy UUID redirects. (Branch: `feat/people-unified-board`) - Implemented by Codex
- Added a data-driven C-layout seminar detail page with sticky event metadata, automatic heading navigation, optional image captions, and gallery ordering from the admin editor. (Branch: `feat/seminar-content-contract`) - Implemented by Codex
### Changed
- Made seminar dates unique, append-only, and immutable after publication, with automatic sequence and URL previews in the admin editor; also removed the remaining About copy-width constraints. (Branch: `feat/people-unified-board`) - Implemented by Codex
- Removed the remaining English-only locale shim and dead bilingual branches, unified the People board with public post data, and limited Noto webfonts to the Latin subsets used by the site. (Branch: `feat/people-unified-board`) - Implemented by Codex
### Removed
- Legacy content stack (`src/lib/content`, `seminars.json`, `history.json`, Pages `functions/`, `_routes.json`) and Supabase dependencies/env. - Implemented by Claude
### Fix
- Unblock production deploys by raising `esbuild` to `^0.28.1`; the pinned `0.27.7` devDependency was hoisted into the production tree via `@astrojs/cloudflare`'s vite and failed the `npm audit --omit=dev --audit-level=low` gate (GHSA-g7r4-m6w7-qqqr), so every deploy since PR #25 aborted before `wrangler deploy` and production still served a pre-cleanup build. (Branch: `fix/esbuild-audit-unblock-deploy`) - Implemented by Claude
### Security
- Pinned all third-party GitHub Actions to commit SHAs. `appleboy/telegram-action` tracked `@master`, so each run pulled whatever that branch held while holding `TELEGRAM_TOKEN`; `cloudflare/wrangler-action` holds the deploy credentials (`CLOUDFLARE_API_TOKEN`) and sat on a mutable tag. Pins target the version already in use, so this is not a version bump. (Branch: `chore/pin-action-shas`) - Implemented by Claude
- Dropped `github.event.head_commit.message` from the Telegram notification. `ci.yml` only triggers on `pull_request`, where that field does not exist, so it always rendered empty and would have become attacker-controlled text if a push trigger were added; replaced with `github.event.pull_request.number`. (Branch: `chore/pin-action-shas`) - Implemented by Claude
### Chore
- Raised `CLAUDE_CODE_EFFORT_LEVEL` to `medium` for the PR review workflow. (Branch: `chore/pin-action-shas`) - Implemented by Claude
### Fix
- Restored admin login, which returned `invalid_credentials` for every account in production. PBKDF2 ran 210,000 iterations (~16-25 ms CPU) while the Workers Free plan allows 10 ms per request, so `deriveBits` was cut short; `verifyPassword` caught the failure and returned `false`, making a runtime limit look like a wrong password. Lowered the work factor to 50,000 (~4 ms, leaving room for the D1 lookup and session HMAC) in both `password.ts` and `create-user.mjs`, and stopped swallowing non-parse errors so a real failure surfaces instead of masquerading as a bad credential. Existing accounts must be recreated because their stored hashes still carry the 210,000 factor. (Branch: `fix/pbkdf2-cpu-limit`) - Implemented by Claude

## [2026-07-25]
### Added
- Public D1 post connection: `/seminars/p/[id]` detail (markdown render, media, map link) and list section; drag-and-drop upload restored in the admin editor. - Implemented by Claude
### Removed
- Concept preview pages (`1-preview`, `first-seminar-codex`) and mock 시안 A dummy content. - Implemented by Claude
### Security
- Markdown link/image protocol allowlist in `renderPostBody` (blocks `javascript:`/`data:`). - Implemented by Claude

## [2026-07-22]
### Chore
- Initialize CHANGELOG.md and PR Changelog management skill for AI agents. (Branch: `main`) - Implemented by Antigravity
