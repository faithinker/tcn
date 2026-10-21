#!/usr/bin/env bash
# PreToolUse(Bash): AGENTS.md의 운영 배포·원격 D1·시크릿 규칙을 명령 단계에서 강제한다.
# 판단할 수 없으면(jq 없음, 빈 명령) 통과시키고 일반 권한 흐름에 맡긴다.

cmd=$(jq -r '.tool_input.command // empty' 2>/dev/null) || exit 0
[ -n "$cmd" ] || exit 0

decide() {
  jq -n --arg d "$1" --arg r "$2" \
    '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: $d, permissionDecisionReason: $r}}'
  exit 0
}

has() { printf '%s' "$cmd" | grep -Eq -e "$1"; }

W='(^|[[:space:]/;&|(])wrangler[[:space:]]+'

if has "${W}(versions[[:space:]]+)?deploy([[:space:]]|\$)" && ! has '--dry-run'; then
  if ! has 'TCN_CONTENT_SOURCE=remote'; then
    decide deny "운영 배포는 'TCN_CONTENT_SOURCE=remote npm run build && npx wrangler deploy'로만 한다(AGENTS.md). 플래그 없이 빌드한 산출물은 로컬 테스트 세미나를 운영 홈에 올린다."
  fi
  decide ask "운영 배포다. 방금 TCN_CONTENT_SOURCE=remote로 빌드한 산출물인지 확인하고 승인한다."
fi

if has "${W}(secret|delete|rollback)([[:space:]]|\$)" || has "${W}d1[[:space:]].*--remote" || has "${W}r2[[:space:]].*delete"; then
  decide ask "운영 리소스를 바꾸거나 읽는 wrangler 명령이다. 대상과 --remote 여부를 확인하고 승인한다."
fi

if has '(^|[[:space:];&|(])git[[:space:]]+push([[:space:]]|$)' && has '[[:space:]](--force|-f)([[:space:]]|$)|[[:space:]]\+[^[:space:]]'; then
  decide deny "강제 푸시는 --force-with-lease=<브랜치>:<직전 원격 SHA>로만 한다."
fi

exit 0
