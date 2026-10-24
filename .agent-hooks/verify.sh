#!/usr/bin/env bash
# Claude Code Stop 훅(.claude/hooks/stop-verify.sh)이 턴을 끝내기 직전에 부르는 검증.
# 실패하면 훅이 출력 끝 40줄을 되돌려 보내 에이전트가 고치게 한다.
#
# 여기서는 서버나 로컬 D1 없이 20초 안에 끝나는 검사만 돌린다.
# 브라우저가 필요한 verify·a11y·motion 게이트와 test:*:d1 시나리오는 제외한다.
# 그쪽은 AGENTS.md의 verification-before-completion 절차로 직접 실행한다.
#
# 우회: AGENT_VERIFY_OFF=1

set -uo pipefail

cd "$(dirname "$0")/.." || exit 0

# 문서만 바뀌었으면 코드 검사를 건너뛴다.
CHANGED=$(git status --porcelain -uall 2>/dev/null | cut -c4-)
[ -n "$CHANGED" ] || exit 0
if ! printf '%s\n' "$CHANGED" | grep -vE '\.(md|mdx|txt)$|^docs/' | grep -q .; then
  exit 0
fi

# node_modules 가 없으면 검사를 돌릴 수 없으므로 막지 않는다.
[ -d node_modules ] || exit 0

run_step() {
  local name="$1"
  shift
  local out
  if ! out=$("$@" 2>&1); then
    printf '[%s] 실패\n%s\n' "$name" "$out"
    exit 1
  fi
}

run_step 'astro check' npm run --silent check
run_step 'vitest' npx vitest run --retry=1

exit 0
