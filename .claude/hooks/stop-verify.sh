#!/usr/bin/env bash
# Stop 훅: 코드가 바뀐 턴에만 .agent-hooks/verify.sh(astro check + vitest)를 돌리고,
# 실패하면 턴 종료를 막아 출력 끝 40줄을 돌려준다. 같은 변경 상태에서 한 번 통과했으면 건너뛴다.
# 우회: AGENT_VERIFY_OFF=1

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$root" || exit 0

[ "${AGENT_VERIFY_OFF:-}" = "1" ] && exit 0
[ -x .agent-hooks/verify.sh ] || exit 0

# 막힌 직후 다시 멈추는 턴은 무한 루프를 피하려고 통과시킨다.
[ "$(jq -r '.stop_hook_active // false' 2>/dev/null)" = "true" ] && exit 0

gitdir=$(git rev-parse --absolute-git-dir 2>/dev/null) || exit 0
stamp="$gitdir/agent-verify.ok"
fingerprint=$({ git diff HEAD 2>/dev/null; git ls-files -o --exclude-standard -z | xargs -0 shasum 2>/dev/null; } | shasum | cut -d' ' -f1)
[ -f "$stamp" ] && [ "$(cat "$stamp")" = "$fingerprint" ] && exit 0

if out=$(.agent-hooks/verify.sh 2>&1); then
  printf '%s' "$fingerprint" > "$stamp"
  exit 0
fi

jq -n --arg tail "$(printf '%s\n' "$out" | tail -40)" \
  '{decision: "block", reason: ("에이전트 검증(.agent-hooks/verify.sh)이 실패했다. 고친 뒤 끝낸다:\n" + $tail)}'
exit 0
