# AI Development Workflow

Use the lightest workflow that fits the task. Do not run overlapping methodologies for the same phase unless the user explicitly asks for a comparison.

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

## Mutating and external workflows

- Never invoke `$qa`, `$design-review`, `$ship`, `$land-and-deploy`, or `$canary` unless the user explicitly requests the corresponding code mutation, commits, push, pull request, merge, deployment, or production verification.
- Prefer report-only review first when the requested action is ambiguous.
