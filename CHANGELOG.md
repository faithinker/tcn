# Changelog

All notable changes to this project will be documented in this file. AI agents (Claude, Codex, etc.) must update this file before opening a Pull Request.

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
