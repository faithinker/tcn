const QNA_HEADERS = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
} as const;

export function qnaJson(
  value: unknown,
  init: { status?: number; headers?: HeadersInit } = {},
): Response {
  const headers = new Headers(QNA_HEADERS);
  if (init.headers) {
    new Headers(init.headers).forEach((headerValue, key) => headers.set(key, headerValue));
  }
  return Response.json(value, { status: init.status ?? 200, headers });
}
