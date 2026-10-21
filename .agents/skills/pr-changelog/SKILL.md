---
name: pr-changelog
description: Instructs AI agents to systematically record their changes in CHANGELOG.md by date, in the same commit, before every commit.
---

# PR Changelog Management

When you (an AI agent like Claude, Codex, etc.) complete a development task and are about to commit your changes, you **MUST** update the `CHANGELOG.md` file located at the root of the project first. This applies to every commit, not only the one that leads to a Pull Request.

## 📝 Instructions

1. **Check the Date Grouping**
   - Open `CHANGELOG.md` and check if today's date (in `YYYY-MM-DD` format) already exists as a Level 2 heading (e.g., `## [2026-07-22]`).
   - If today's date exists, add your changes under that existing date heading.
   - If it DOES NOT exist, create a new Level 2 heading for today's date at the very top of the log (just below the main title and description).

2. **Categorize and Format**
   - Group your changes under appropriate Level 3 headings (e.g., `### Feature`, `### Fix`, `### Refactor`, `### Chore`). If the heading doesn't exist under the current date, create it.
   - Add a concise bullet point (`-`) summarizing your work.
   - You MUST include the branch name and your agent signature at the end of the line.
   
   **Example Entry:**
   ```markdown
   ## [2026-07-22]
   ### Feature
   - Add senior-friendly dark mode to all academic layouts (Branch: `feat/dark-mode`) - Implemented by Claude
   ```

3. **Include in Commit**
   - Ensure the modified `CHANGELOG.md` is staged and included in the same commit as the change it describes, before you create that commit.
   - A commit that edits nothing but `CHANGELOG.md` needs no further entry.

4. **Sync with PR Body**
   - When you generate the Pull Request, copy the exact bullet points that the PR's commits added to `CHANGELOG.md` and include them in the PR description.
