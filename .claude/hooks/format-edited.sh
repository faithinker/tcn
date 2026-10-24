#!/usr/bin/env bash
# PostToolUse(Edit|Write|MultiEdit): 저장소 안 파일만 prettier로 정리한다. .prettierignore 대상은 prettier가 건너뛴다.

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
file=$(jq -r '.tool_response.filePath // .tool_input.file_path // empty' 2>/dev/null)

[ -n "$file" ] || exit 0
case "$file" in "$root"/*) ;; *) exit 0 ;; esac
[ -f "$file" ] || exit 0
[ -x "$root/node_modules/.bin/prettier" ] || exit 0

cd "$root" && ./node_modules/.bin/prettier --write --ignore-unknown --log-level warn "$file" >/dev/null 2>&1
exit 0
