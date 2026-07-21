---
name: academic-translation
description: Translate, edit, or review Korean and English copy for the Transcultural Network (TCN) in a register suitable for an international scholarly association. Use for Korean source editing, Korean-to-English translation, bilingual equivalence review, English institutional copyediting, bylaws and founding documents, UI text, event copy, member profiles, and terminology consistency in src/i18n or src/data.
---

# TCN Academic Translation

Treat Korean as the authoritative source unless the user identifies another source of truth. Preserve meaning before improving style. Do not silently repair a substantive ambiguity in Korean by inventing a precise English meaning.

## Load the standards

Read these references before editing:

- Read [references/terminology.md](references/terminology.md) for every task.
- Read [references/editorial-style.md](references/editorial-style.md) for every task.
- Read [references/document-types.md](references/document-types.md) when working on bylaws, declarations, invitations, UI copy, event copy, or member profiles.

Treat the references as version-controlled retrieval material, not model training. If usage in the repository conflicts with a reference, report the conflict and follow the reference unless an official proper name or the user requires otherwise.

## Locate paired content

Inspect all applicable sources, not only the file named by the user:

- `src/i18n/content.ts`: long-form Korean and English content
- `src/i18n/ui.ts`: short UI strings
- `src/data/*.json`: records paired by `lang` and canonical `id`
- `src/pages/ko` and `src/pages/en`: route parity

Preserve object keys, IDs, slugs, dates, URLs, array order, and data shape. Change structural fields only when the user explicitly requests a structural change.

## Run the editorial workflow

1. **Classify the text.** Identify its document type, audience, and whether it carries legal or governance force.
2. **Edit the Korean source.** Flag ambiguity, broken logic, inconsistent terminology, unnatural spacing, and unnecessary bureaucratic phrasing. Separate stylistic improvements from changes that alter meaning.
3. **Draft the English.** Translate propositions and relationships, not Korean word order. Apply the glossary and document-specific register.
4. **Audit semantic equivalence.** Compare Korean and English sentence by sentence for omissions, additions, weakened or strengthened obligations, changed agency, number, time, scope, and modality.
5. **Copyedit English independently.** Read the English without leaning on the Korean. Remove translationese and check collocation, parallelism, capitalization, punctuation, and institutional tone.
6. **Reconcile findings.** Make one main agent the only file editor. Resolve review findings against the Korean source and glossary; do not combine alternatives into awkward compromise prose.
7. **Validate.** Run the checks below and inspect the final diff.

## Use independent reviewers

For substantive translation or review, use independent subagents when available:

- `ko-editor`: review only the Korean source for clarity and correctness.
- `equivalence-reviewer`: compare the raw Korean and proposed English only for semantic equivalence.
- `en-institutional-editor`: review the proposed English as an editor for an international scholarly association.
- Add `bylaws-reviewer` for governance text, focusing on actors, authority, voting thresholds, modality, and defined terms.

Give reviewers the source artifact, proposed translation, document type, and the relevant reference files. Do not give them the main agent's conclusions or expected findings. Require read-only findings; reviewers must not edit repository files. If subagents are unavailable, perform the same passes sequentially and label them in the report; do not claim they were independent.

Small labels or obvious one-line fixes may use one independent review pass. Bylaws, declarations, invitations, public mission statements, and multi-paragraph translations require at least semantic and English-editor passes.

## Verify official names

Do not guess the English name of a person, university, institution, venue, office, or geographic entity. Prefer, in order:

1. The entity's official English-language source
2. An authoritative government or institutional directory
3. Existing verified project usage

Mark an unverified romanization or title as `[verification required]` in the review report rather than presenting it as confirmed. Use web or an available research connector only for this source verification; a general translation MCP is not required.

## Run validation

Run:

```sh
node .agents/skills/academic-translation/scripts/terminology-audit.mjs
npm run i18n
npm run check
```

The terminology audit is advisory because legacy copy may predate the glossary. Treat new discouraged variants in the edited scope as findings even when the script exits successfully.

## Report the result

Return:

1. Files or passages reviewed
2. Applied changes
3. A table of unresolved or judgment-sensitive findings with `Source`, `Current English`, `Recommendation`, and `Reason`
4. Official names still requiring verification
5. Validation commands and results

If no issues remain, say so explicitly. Never describe prose as “native” merely because it is grammatical; assess it against the documented institutional register.
