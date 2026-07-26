# Changelog

All notable changes to this project will be documented in this file. AI agents (Claude, Codex, etc.) must update this file before opening a Pull Request.

## [2026-07-26]
### Changed (BREAKING)
- English-single site: removed `/ko`·`/en` route trees; root tree serves English copy, legacy URLs 301 via `public/_redirects`. (Branch: `feat/cloudflare-migration`) - Implemented by Claude
- Public pages now read Cloudflare D1 directly (home hero, seminars list, post detail, sitemap) — publishing a post is live immediately, no rebuild. - Implemented by Claude
### Added
- Discord/Telegram notifications on post create/update via `waitUntil` (best-effort, per-channel retry). - Implemented by Claude
- Seed script `scripts/seed-seminar-posts.mjs` migrating the two seminars into D1 posts (idempotent). - Implemented by Claude
- Workers deploy workflow `deploy-workers.yml` (check+test+build+`wrangler deploy`); retired `deploy-pages.yml`. - Implemented by Claude
### Removed
- Legacy content stack (`src/lib/content`, `seminars.json`, `history.json`, Pages `functions/`, `_routes.json`) and Supabase dependencies/env. - Implemented by Claude

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
