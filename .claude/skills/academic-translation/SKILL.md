---
name: academic-translation
description: Translate, edit, or review Korean and English copy for the Transcultural Network (TCN) in a register suitable for an international scholarly association. Use for Korean source editing, Korean-to-English translation, bilingual equivalence review, English institutional copyediting, bylaws and founding documents, UI text, event copy, member profiles, and terminology consistency in src/i18n or src/data.
---

# TCN Academic Translation

Use the repository's canonical cross-agent skill rather than maintaining a Claude-specific copy.

Before taking any task action, read the complete files below and follow them as the controlling instructions for this skill:

1. `.agents/skills/academic-translation/SKILL.md`
2. `.agents/skills/academic-translation/references/terminology.md`
3. `.agents/skills/academic-translation/references/editorial-style.md`
4. `.agents/skills/academic-translation/references/document-types.md` when the document type is covered there

Run the canonical audit script at:

```sh
node .agents/skills/academic-translation/scripts/terminology-audit.mjs
```

Treat `.agents/skills/academic-translation/` as the single source of truth. Do not copy or independently revise its rules under `.claude/`.
