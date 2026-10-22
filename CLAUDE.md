# Claude Code Project Instructions

@AGENTS.md

Treat the imported workflow as the authoritative tool-routing policy for this repository.

The workflow outranks Superpowers. When a Superpowers skill or its session-start rules (for example "invoke a skill if there is even a 1% chance it applies") conflict with the workflow, follow the workflow. Use a Superpowers skill only where the workflow names it (`$test-driven-development`, `$verification-before-completion`) or the user asks for it. The `$`-prefixed gstack skills the workflow names for discovery, plan critique, debugging, review, and QA are not available in Claude Code sessions here; do that work directly instead of substituting a Superpowers skill.
