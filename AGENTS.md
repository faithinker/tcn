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

## Workflow routing

- **Discovery:** `$office-hours` for early product shaping. PM Skills only for assumptions, prioritization, positioning, pricing, or market analysis. Never both in one pass unless asked.
- **Planning:** `$plan-ceo-review`, `$plan-eng-review`, `$plan-design-review`, `$plan-devex-review` for plan critique. Spec Kit only for substantial multi-session features (new data models, cross-domain work), and only with explicit user approval; never initialize `.specify` on your own. Do not run gstack, Superpowers, and Spec Kit planning on the same task.
- **Implementation:** `$test-driven-development` for behavior changes, business logic, APIs, state transitions, and bug fixes; optional for copy, translation, docs, config, generated files, prototypes, and purely visual CSS. Run `$verification-before-completion` before claiming work is complete, fixed, or passing, and report the evidence.
- **Debug, review, QA:** `$investigate` for root cause (not Superpowers debugging), `$review` for the final diff, `$qa-only` for report-only browser QA, `$browse` for focused checks. Impeccable for UI critique and polish; do not combine it with gstack design review unless asked.
- **Mutating workflows:** never invoke `$qa`, `$design-review`, `$ship`, `$land-and-deploy`, or `$canary` unless the user explicitly requests the matching code change, commit, push, PR, merge, deploy, or production check. When the action is ambiguous, review report-only first.
- **CRITICAL:** before pushing a branch and opening a PR, you MUST apply the `pr-changelog` skill: record the changes in `CHANGELOG.md` by date, commit it, and put the summary in the PR description.

## Tool scope (web vs iOS)

This repository is web-only (Astro + Cloudflare). iOS tools stay off here, and web/infra tools are opt-in here only (off globally, so iOS projects do not load them). Never enable or call an out-of-scope tool; if one appears in a session, report it and fix the config. Register any new web/infra tool opt-in here, not globally.

- In scope: MCP `context7`, `astro-docs`, `chrome-devtools`, `playwright`, `cloudflare` (plugin) / `cloudflare-*` (Codex); TypeScript LSP; the web skills in `.claude/skills` and `.agents/skills`; the Trail of Bits security plugins `insecure-defaults`, `sharp-edges`, `differential-review`, `agentic-actions-auditor` (marketplace `trailofbits/skills`, enabled here only: `claude plugin marketplace add trailofbits/skills --scope local`, then `claude plugin install <name>@trailofbits --scope local`).
- Out of scope: MCP `apple-docs`, `XcodeBuildMCP`, `mobile-mcp`, `figma`, `figma-console`, `figma-remote-mcp`, `mcp-atlassian`, `postman`, `rea` (reverse engineering, with its `reverse-engineer-anything` skill), `tuist`, `markitdown`; the Figma plugin; Swift plugins; iOS and App Store Connect skills (`ios-*`, `asc-*`, `swiftui-skills`, `migrating-to-swift-concurrency`).
- Enforcement is per tool and must stay in sync with this list. Claude Code: `~/.claude/settings.json` keeps the web/infra plugin and skills off globally, and the tracked `.claude/settings.json` (`deniedMcpServers`, `enabledPlugins`, `extraKnownMarketplaces`, `skillOverrides`, `permissions`, `hooks`) turns them on here, blocks the out-of-scope tools, and re-enables the gstack workflow skills this file routes to (`review`, `investigate`, `qa-only`, `browse`, `plan-*-review`; the mutating ones listed above stay off). Machine-local entries (MCP approvals, personal one-off `permissions.allow` rules) belong in the gitignored `.claude/settings.local.json`, which Claude Code creates on demand. Codex: MCP in `.codex/config.toml` (tracked; per-server `enabled`), skills and the Cloudflare plugin in the machine-local profile `~/.codex/web.config.toml` (iOS projects use its counterpart `~/.codex/ios.config.toml`) (`skills.config`, `plugins`; a project config ignores skill settings), with the web/infra defaults off in `~/.codex/config.toml`, so launch Codex as `codex --profile web`. On a fresh clone the profile is absent, so this section is the source of truth.

## Claude Code project hooks

Scripts live in `.claude/hooks/` and are registered in the tracked `.claude/settings.json`, so a fresh clone gets them once the folder is trusted.

- `PreToolUse` on `Bash` runs `guard-bash.sh`. It denies `wrangler deploy` without `TCN_CONTENT_SOURCE=remote` and plain `git push --force`, and asks before the remote deploy, `wrangler secret|delete|rollback`, remote D1 commands, and R2 deletes.
- `PostToolUse` on `Edit|Write|MultiEdit` runs `format-edited.sh` (prettier on files inside the repo) and the Impeccable design hook.
- `Stop` runs `stop-verify.sh`, which calls `.agent-hooks/verify.sh` (`astro check` + `vitest`) once per change set and blocks the turn end on failure. Bypass with `AGENT_VERIFY_OFF=1`. Codex is not wired to it.
- `permissions.ask` also covers `git push`, `gh pr create|merge`, `gh secret|workflow run|release`, and the production `npx wrangler` commands, so an unattended loop pauses there by design.

## Build and manual production deploy

- `npm run build` (and `dev`/`start`) first runs `scripts/export-public-content.mjs`, which bakes the public seminar list from D1 into `/`, `/about`, `/seminars`. Without a flag it reads the **local** D1 whenever `.wrangler/state` exists.
- **CRITICAL:** a manual production deploy MUST be `TCN_CONTENT_SOURCE=remote npm run build && npx wrangler deploy`. Never run `npx wrangler deploy` after a plain `npm run build`; it publishes local test seminars on the production home page.
- CI deploys set `TCN_REQUIRE_CONTENT=1` (production D1 only; the build fails if it cannot be read). Do not remove it from the `Build` step of `deploy-workers.yml`.
- Details and the 10-minute auto-refresh: `docs/deployment.md#정적-공개-페이지와-자동-갱신`.
