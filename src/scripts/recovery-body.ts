// 위젯이 폼에 넣는 숨은 입력 `cf-turnstile-response` 는 서버가 허용하지 않는 필드라 걸러 내고,
// 토큰은 항상 `turnstileToken` 으로만 보낸다. 챌린지가 꺼져 있으면(token 이 null) 필드를 그대로 보낸다.
export function buildRecoveryRequestBody(
  fields: Record<string, unknown>,
  token: string | null,
): Record<string, unknown> {
  const { 'cf-turnstile-response': _widgetField, turnstileToken: _forged, ...rest } = fields;
  return token === null ? rest : { ...rest, turnstileToken: token };
}
