# Changelog

All notable changes to this project will be documented in this file. AI agents (Claude, Codex, etc.) must update this file before opening a Pull Request.

## [2026-07-30]

### Feature
- Added a Summer 2025 founding-preparatory milestone with three consented photographs, factual captions, responsive HTML figures, and the shared full-screen previous/next media viewer; approximate dating remains visibly limited to the season rather than inventing a specific day. (Branch: `feat/founding-preparatory-gallery`) - Implemented by Codex

### Changed
- Restored the Secretariat telephone number (`031-709-8111`) beside the published email address, rendered both contact values as more prominent lead text, and removed the email quick links from the Contact page and footer so the address is displayed as plain text. (Branch: `content/restore-secretariat-telephone`) - Implemented by Codex
- Opened a working contact channel: Secretariat Enquiries no longer shows an empty Telephone row beside an empty Email row, and the Email row now links to `mingoo@aks.ac.kr`. The section copy states that enquiries reach the Secretariat by email rather than promising channels still to be finalised, and the footer's "Contact details to be announced" line is replaced by the same address so the two no longer contradict each other on the same page. (Branch: `content/contact-secretariat-email`) - Implemented by Claude
- Made the shipped typography explicitly English-first by removing the unreachable Noto Serif KR dependency and Korean-only fallbacks, keeping Georgia for scholarly narrative and Pretendard for interface structure; also corrected stale implementation comments and aligned Sonar exclusions with browser-only coverage. (Branch: `test/critical-coverage-gaps`) - Implemented by Codex

### Documentation
- Reconciled the stale root documents with the shipped English-only, D1-backed implementation. `MEMBERSHIP_FLOW.md` was rewritten around the implemented `PUBLIC_MEMBERSHIP_FORM_URL` activation gate: the dead `/ko`·`/en` contact routes are gone, the already-published Secretariat email and telephone no longer block activation, the unbuilt application-field list is labeled a proposal, and the Q&A board is explicitly disclaimed as not the application channel. `IDEA.md` gained an `Updated:` header and one sentence reconciling the shipped Q&A board with the no-community-features boundary. (Branch: `docs/remote-docs-cleanup`) - Implemented by Claude
- Synced `README.md` and `CONTENT_ARCHITECTURE.md` with reality: the public Q&A surface (routes, data location, admin console, API guards, no-notification design) is now documented, the D1 schema is described as its actual ten tables across six migrations, the removed Noto Serif KR/`@fontsource` claims were replaced with the shipped Georgia + Pretendard stack, the nonexistent `npx astro dev stop` instruction was corrected, the deploy section now explains the version-propagation gate, GitGuardian was dropped from the gate list (no repo config exists), `src/lib/posts-view.ts` was fixed to `src/lib/posts/view.ts`, the undocumented browser/D1 verification scripts and `wrangler secret bulk` flow were added, and README's route table and design summary were reduced to pointers at `CONTENT_ARCHITECTURE.md` §2 and `DESIGN.md` instead of drifting copies. (Branch: `docs/remote-docs-cleanup`) - Implemented by Claude
- Documented the deploy version gate in `docs/operations-runbook.md`: the polling that stands between deploy and smoke, the branch where a gate failure leaves an unverified version live with no automatic rollback (with a manual rollback procedure that pins an explicit version id), `/api/ready`'s fail-closed secret inventory with a triage note pointing at `wrangler secret list` first, Q&A table growth (`qna_turnstile_tokens` self-prunes, `qna_rate_limits` grows unbounded, `qna_audit_events` is the audit record), restore verification for the Q&A tables, and the sign-everyone-out consequence of rotating `SESSION_SECRET`. (Branch: `docs/remote-docs-cleanup`) - Implemented by Claude
- Corrected `DESIGN.md` against the shipped CSS: the reading-measure range is 60–76ch with 68ch as the default (not 68–74ch), the 576px and 768px component-local thresholds joined the breakpoint list, the fictional `--spacing-*` frontmatter block was replaced with the real `containers`/`shadows` tokens, component paddings gained their responsive compact values, the unreachable below-640px Display Hero compaction is marked latent, and the profile card's off-scale sizes and weights are recorded as contained exceptions; `.impeccable/design.json` was synced. (Branch: `docs/remote-docs-cleanup`) - Implemented by Claude
- Rebuilt `DESIGN.md` from an eight-area implementation audit, removing fictional or retired tokens and components while documenting the real responsive thresholds, public-only dark theme, typography exceptions, accessibility behavior, motion, and authoring states; added the machine-readable Impeccable design sidecar. (Branch: `test/critical-coverage-gaps`) - Implemented by Codex

### Chore
- Normalized CHANGELOG formatting (merged the duplicated 2026-07-26 Fix sections, unified `Added` headings under `Feature`, uniform section spacing, one missing attribution) and made the CRITICAL `pr-changelog` rule loadable by Claude Code via a `.claude/skills/pr-changelog` pointer at the canonical `.agents` skill, following the existing `academic-translation` pointer pattern. (Branch: `docs/remote-docs-cleanup`) - Implemented by Claude
- Dropped the six dead `SUPABASE_*` names and `GITHUB_ACTIONS_TOKEN` from the generated `worker-configuration.d.ts` — they came from a since-deleted local `.env` file at generation time, not from the Worker, whose secret list holds only the five session/Turnstile/Q&A secrets — and removed the stale `supabase/functions` entry from the tsconfig exclude list. (Branch: `fix/a11y-tokens`) - Implemented by Claude

### Test
- Added critical runtime coverage for authentication cookies and session routes, post APIs, canonical middleware behavior, and Q&A D1 constraints, with Vitest thresholds split by coverage category and the D1 constraint gate wired into CI. (Branch: `test/critical-coverage-gaps`) - Implemented by Codex

### Fix
- Made the footer focus ring visible in dark mode: `footer :focus-visible` drew its outline in `--color-canvas`, which the dark theme turns near-black (~1.1:1 against the dark footer), so keyboard focus vanished exactly where the surface is darkest. The ring now uses `--color-on-footer`, white in both public themes, matching the intent DESIGN.md already documented; the light theme is visually unchanged. (Branch: `fix/a11y-tokens`) - Implemented by Claude
- Raised the mobile theme toggle from 44px to the 48px control floor, matching the hamburger beside it and the DESIGN.md rule for top-level controls. (Branch: `fix/a11y-tokens`) - Implemented by Claude
- Defined the `--color-surface` token that `MilestoneGallery` referenced but no stylesheet declared, so gallery image placeholders had no background at all: it is now an alias of `--color-canvas-soft` that tracks Soft Paper in both themes, registered in `DESIGN.md` and the Impeccable sidecar as the media placeholder surface. (Branch: `fix/a11y-tokens`) - Implemented by Claude
- Made the deploy workflow prove which version it smoke tests. It curled `/`, `/api/health`, and `/api/ready` immediately after `wrangler deploy`, so the checks could still be answered by the previous version: on 2026-07-29 a deploy went green without ever exercising the version it had just uploaded, and the missing Q&A Turnstile secrets only surfaced on the following deploy, which then rolled back. The workflow now waits until the version id reported by `wrangler deploy` is the one serving 100% of traffic, and fails loudly if it never gets there or if the deploy output carries no version id. (Branch: `ci/deploy-version-gate`) - Implemented by Claude
- Closed a secrets leak path in `.gitignore`: `.dev.vars` was ignored but `.dev.vars.production` — the file that feeds the Worker's production Turnstile and rate-limit secrets into `wrangler secret bulk` — was not, so `git add -A` would have committed it. No such file was ever tracked. (Branch: `ci/deploy-version-gate`) - Implemented by Claude

## [2026-07-29]

### Feature
- Made the post editor attach media before the first save: selected photos, documents, and video stay staged in the editor with previews, captions, ordering, and cover choice, and one Save/Create runs post save → uploads → media metadata. New posts are created in place, so a file that fails to upload stays staged and Save retries it instead of disappearing with a redirect. (Branch: `feat/admin-authoring-ux`) - Implemented by Claude
- Replaced the single-line save status with a sticky publish bar that answers whether the screen matches the public page: seven named states with a plain-language second line, a file-by-file upload counter, the live URL with copy, and a confirmation banner naming what went live, what is attached, and what is still incomplete. Failures state the reason and that nothing was lost, and unsaved changes now warn before the tab closes. (Branch: `feat/admin-authoring-ux`) - Implemented by Claude
- Added a production-site quick link to the admin header, and gave Logout pointer and hover feedback. (Branch: `feat/admin-authoring-ux`) - Implemented by Claude
- Added a public D1-backed Q&A board with question submission, waiting/answered filters, stable pagination, official administrator answers, visibility controls, and responsive public and admin views. (Branch: `codex/qna-mvp`) - Implemented by Codex
- Reorganized the authenticated admin area as a flat Posts/Questions workspace with active navigation, contextual page actions, live waiting-question counts, and responsive task-focused lists. (Branch: `codex/qna-mvp`) - Implemented by Codex

### Changed
- Rebuilt the media dropzone: the whole dashed area opens the file picker (the native input chrome, which rendered in the browser's own language, is gone), all copy is English, accepted formats and size ceilings are printed inside it, staged files show their size, and deleting media asks for confirmation. (Branch: `feat/admin-authoring-ux`) - Implemented by Claude
- Added one admin-only token pair (`danger` / `danger-soft`, warm oxblood) so destructive and failed states stop borrowing the link blue, and documented the admin state vocabulary, publish bar, and dropzone in `DESIGN.md`. Success deliberately adds no new colour. (Branch: `feat/admin-authoring-ux`) - Implemented by Claude

### Security
- Protected Q&A writes with canonical Cloudflare Turnstile verification, hostname validation, replay prevention, HMAC-derived dual-window rate limits, CSRF checks, optimistic revisions, atomic privacy-minimal audit events, no-store admin responses, and safe plain-text rendering. (Branch: `codex/qna-mvp`) - Implemented by Codex

### Fix
- Rejected unsupported and oversized uploads in the browser before the request, inferring the type from the extension when the browser reports no MIME, so `.mov` and `.doc` files no longer reach the Worker only to fail with 415. (Branch: `feat/admin-authoring-ux`) - Implemented by Claude
- Removed the duplicate desktop Contact navigation item and prevented administrator answer text from gaining leading whitespace or indentation after editing and publishing. (Branch: `codex/qna-mvp`) - Implemented by Codex

### Refactor
- Consolidated duplicated administrator Q&A mutation plumbing and aligned Sonar coverage scope with the browser-executed scripts already excluded from Vitest coverage. (Branch: `codex/qna-mvp`) - Implemented by Codex

### Test
- Extended the `verify:admin` browser gate to 36 checks — that selecting files creates nothing on the server until Save, that one Create publishes a post with a photo, a PDF, and an MP4, and that the publish states appear — and added unit tests for the new upload-accept, staged-media, and publish-state modules. (Branch: `feat/admin-authoring-ux`) - Implemented by Claude
- Added unit, contract, D1 integration, security, concurrency, pagination, and browser coverage for the Q&A lifecycle and administrator count synchronization. (Branch: `codex/qna-mvp`) - Implemented by Codex
- Removed 46 low-value or redundant tests, retained 255 behavior-focused tests, and recalibrated Vitest thresholds to the measured coverage floor of the remaining suite. (Branch: `test/trim-qna-tests`) - Implemented by Codex

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
- Added `IDEA.md` recording the project definition, target users, goals, content and product principles, the priority order for conflicting decisions, scope boundaries, and the definition of done. (Branch: `fix/header-nav-breakpoint`) - Implemented by Codex
- Applied Prettier across the repository (79 files), a mechanical reformat with no behavioural change: every file matches `prettier --write` applied to its previous content exactly. (Branch: `chore/format-repo`) - Implemented by Claude

## [2026-07-26]

### Changed (BREAKING)
- English-single site: removed `/ko`·`/en` route trees; root tree serves English copy, legacy URLs 301 via `public/_redirects`. (Branch: `feat/cloudflare-migration`) - Implemented by Claude
- Public pages now read Cloudflare D1 directly (home hero, seminars list, post detail, sitemap) - publishing a post is live immediately, no rebuild. - Implemented by Claude

### Feature
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
- Restored admin login, which returned `invalid_credentials` for every account in production. PBKDF2 ran 210,000 iterations (~16-25 ms CPU) while the Workers Free plan allows 10 ms per request, so `deriveBits` was cut short; `verifyPassword` caught the failure and returned `false`, making a runtime limit look like a wrong password. Lowered the work factor to 50,000 (~4 ms, leaving room for the D1 lookup and session HMAC) in both `password.ts` and `create-user.mjs`, and stopped swallowing non-parse errors so a real failure surfaces instead of masquerading as a bad credential. Existing accounts must be recreated because their stored hashes still carry the 210,000 factor. (Branch: `fix/pbkdf2-cpu-limit`) - Implemented by Claude

### Security
- Pinned all third-party GitHub Actions to commit SHAs. `appleboy/telegram-action` tracked `@master`, so each run pulled whatever that branch held while holding `TELEGRAM_TOKEN`; `cloudflare/wrangler-action` holds the deploy credentials (`CLOUDFLARE_API_TOKEN`) and sat on a mutable tag. Pins target the version already in use, so this is not a version bump. (Branch: `chore/pin-action-shas`) - Implemented by Claude
- Dropped `github.event.head_commit.message` from the Telegram notification. `ci.yml` only triggers on `pull_request`, where that field does not exist, so it always rendered empty and would have become attacker-controlled text if a push trigger were added; replaced with `github.event.pull_request.number`. (Branch: `chore/pin-action-shas`) - Implemented by Claude

### Chore
- Raised `CLAUDE_CODE_EFFORT_LEVEL` to `medium` for the PR review workflow. (Branch: `chore/pin-action-shas`) - Implemented by Claude

## [2026-07-25]

### Feature
- Public D1 post connection: `/seminars/p/[id]` detail (markdown render, media, map link) and list section; drag-and-drop upload restored in the admin editor. - Implemented by Claude

### Removed
- Concept preview pages (`1-preview`, `first-seminar-codex`) and the concept-A mock dummy content. - Implemented by Claude

### Security
- Markdown link/image protocol allowlist in `renderPostBody` (blocks `javascript:`/`data:`). - Implemented by Claude

## [2026-07-22]

### Chore
- Initialize CHANGELOG.md and PR Changelog management skill for AI agents. (Branch: `main`) - Implemented by Antigravity
