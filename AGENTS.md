# AI Development Workflow

Use the lightest workflow that fits the task. Do not run overlapping methodologies for the same phase unless the user explicitly asks for a comparison.

## Project essentials

Astro 7 + TypeScript on one Cloudflare Worker (D1 `DB`, R2 `MEDIA`); only the admin editor is React + Tiptap. Commands, gates, and architecture live in `README.md`, `docs/development.md`, and `CONTENT_ARCHITECTURE.md`; do not duplicate them here.

- Feature rules (route guards, `requireMutation`, permissions matrix, migrations, feature flags, deploy) are in the README section "기능을 추가할 때 지킬 규칙".
- `npm run check` and `npm run test` need no server. Browser gates (`verify*`, `a11y`) need a running local server, and `test:*:d1` gates need the local D1; see `docs/development.md`.
- `.dev.vars` holds the owner's local secrets: never print or overwrite it, and never copy its values to production. Production secrets and `--remote` D1 changes are the user's call.
- Migrations: add a new numbered file under `migrations/` and never edit an applied one. Apply locally with `npx wrangler d1 migrations apply tcn-content --local`.
- Branches: work on `feat/*` or `fix/*` and never commit to `main`. For parallel agents and worktrees see `.agents/parallel-work-rules.md`; main syncs by merge there, while long-lived branches such as the roles branch use `git rebase origin/main` and `--force-with-lease`.
- Commits: Conventional Commits with an English subject (see `git log`).
- Code comments: match the surrounding density, one line or 2-3 lines when the reason is not obvious. Change history goes in the commit message.

## Product discovery

- Use `$office-hours` for early product shaping, open-ended brainstorming, and deciding whether an idea is worth building.
- Use the PM Skills product-discovery or product-strategy skills when the request is specifically about assumptions, customer problems, opportunity mapping, prioritization, positioning, business models, pricing, market analysis, or product strategy.
- Do not invoke gstack office hours and PM Skills for the same discovery pass unless the user explicitly asks for both perspectives.

## Specifications and planning

- Use `$plan-ceo-review`, `$plan-eng-review`, `$plan-design-review`, or `$plan-devex-review` for lightweight plan critique from the relevant perspective.
- Use Spec Kit only for substantial features that need persistent requirements, acceptance criteria, and task decomposition. Good signals include multi-page or cross-domain work, new data models, multi-session implementation, or work expected to take multiple days.
- Do not initialize Spec Kit or add `.specify` artifacts without explicit user approval. Trivial fixes, content edits, translations, visual polish, and contained refactors do not use Spec Kit.
- Do not run gstack planning, Superpowers planning, and Spec Kit planning on the same task.

## Implementation discipline

- Use `$test-driven-development` for behavior changes, business logic, APIs, state transitions, and reproducible bug fixes.
- TDD is optional for copy, translation, documentation, configuration-only changes, generated files, throwaway prototypes, and purely visual CSS adjustments with no behavior change.
- Use `$verification-before-completion` before claiming that work is complete, fixed, passing, or ready to ship. Run fresh, relevant verification and report the evidence.

## Debugging, review, and QA

- Use `$investigate` for debugging and root-cause analysis. Do not also invoke Superpowers systematic debugging.
- Use `$review` for final diff or pre-landing review.
- Prefer `$qa-only` for report-only browser QA and `$browse` for focused browser verification.
- Use Impeccable for UI critique, design-system consistency, accessibility-aware visual polish, and deliberate frontend redesign work. Do not combine Impeccable and gstack design review in the same pass unless the user requests both.

## Tool scope (web vs iOS)

This repository is web-only (Astro + Cloudflare). iOS tooling stays installed globally for iOS projects but must stay off here. The reverse also holds: web/infra tools (Cloudflare, Astro docs, Playwright, TypeScript LSP and the Cloudflare/Workers skills) are opt-in and enabled only in this repository; they are off globally so iOS projects do not load them. Chrome DevTools and Context7 stay global. Never enable or call the out-of-scope tools below; if one shows up in a session, report it and fix the config instead of using it. A new web/infra tool must be registered opt-in here, not globally.

- In scope: MCP `context7`, `astro-docs`, `chrome-devtools`, `playwright`, `cloudflare` (plugin) / `cloudflare-*` (Codex), `markitdown`; the web skills in `.claude/skills` and `.agents/skills` (Impeccable, accessibility, core-web-vitals, web-design-guidelines, Tiptap).
- Out of scope: MCP `apple-docs`, `XcodeBuildMCP`, `mobile-mcp`, `figma`, `figma-console`, `figma-remote-mcp`, `mcp-atlassian`, `postman`, `rea` (reverse engineering, with its `reverse-engineer-anything` skill); the Figma plugin; Swift plugins; iOS and App Store Connect skills (`ios-*`, `asc-*`, `swiftui-skills`, `migrating-to-swift-concurrency`).
- Enforcement is per tool and must stay in sync with this list. Claude Code: `~/.claude/settings.json` keeps the web/infra plugin and skills off globally, and the tracked `.claude/settings.json` (`deniedMcpServers`, `enabledPlugins`, `extraKnownMarketplaces`, `skillOverrides`, `permissions`, `hooks`) turns them on here, blocks the out-of-scope tools, and re-enables the gstack workflow skills this file routes to (`review`, `investigate`, `qa-only`, `browse`, `plan-*-review`; the mutating ones listed below stay off). Machine-local entries (MCP approvals, personal one-off `permissions.allow` rules) belong in the gitignored `.claude/settings.local.json`, which Claude Code creates on demand. Codex: MCP in `.codex/config.toml` (tracked; per-server `enabled`), skills and the Cloudflare plugin in the machine-local profile `~/.codex/web.config.toml` (iOS projects use its counterpart `~/.codex/ios.config.toml`) (`skills.config`, `plugins`; a project config ignores skill settings), with the web/infra defaults off in `~/.codex/config.toml`, so launch Codex as `codex --profile web`. On a fresh clone the profile is absent, so this section is the source of truth.

## Claude Code project hooks

Scripts live in `.claude/hooks/` and are registered in the tracked `.claude/settings.json`, so a fresh clone gets them once the folder is trusted.

- `PreToolUse` on `Bash` runs `guard-bash.sh`. It denies `wrangler deploy` without `TCN_CONTENT_SOURCE=remote` and plain `git push --force`, and asks before the remote deploy, `wrangler secret|delete|rollback`, remote D1 commands, and R2 deletes.
- `PostToolUse` on `Edit|Write|MultiEdit` runs `format-edited.sh` (prettier on files inside the repo) and the Impeccable design hook.
- `Stop` runs `stop-verify.sh`, which calls `.agent-hooks/verify.sh` (`astro check` + `vitest`) once per change set and blocks the turn end on failure. Bypass with `AGENT_VERIFY_OFF=1`. Codex is not wired to it.
- `permissions.ask` also covers `git push`, `gh pr create|merge`, `gh secret|workflow run|release`, and the production `npx wrangler` commands, so an unattended loop pauses there by design.

## Mutating and external workflows

- Never invoke `$qa`, `$design-review`, `$ship`, `$land-and-deploy`, or `$canary` unless the user explicitly requests the corresponding code mutation, commits, push, pull request, merge, deployment, or production verification.
- Prefer report-only review first when the requested action is ambiguous.
- **CRITICAL**: Before every commit, you MUST automatically apply the `pr-changelog` skill. Record the change in `CHANGELOG.md` by date and stage it in the same commit; only a commit that edits nothing but `CHANGELOG.md` skips this. When you create the pull request, copy those entries into the PR description.

## Build and manual production deploy

- `npm run build` (and `dev`/`start`) first runs `scripts/export-public-content.mjs`, which snapshots the public seminar list from D1 and bakes it into the static pages `/`, `/about`, `/seminars`. With no flag it reads the **local** D1 whenever `.wrangler/state` exists.
- **CRITICAL**: A manual production deploy MUST be `TCN_CONTENT_SOURCE=remote npm run build && npx wrangler deploy`. Never run `npx wrangler deploy` after a plain `npm run build` — that publishes local test seminars on the production home page.
- CI deploys already set `TCN_REQUIRE_CONTENT=1`, which allows only production D1 and fails the build when it cannot be read. Do not remove it from the `Build` step of `deploy-workers.yml`.
- Details and the 10-minute auto-refresh: `docs/deployment.md#정적-공개-페이지와-자동-갱신`.
