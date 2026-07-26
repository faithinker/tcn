interface ApiErrorPayload {
  ok?: boolean;
  error?: string;
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(code: string, status: number) {
    super(code);
    this.name = 'ApiRequestError';
    this.code = code;
    this.status = status;
  }
}

export async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch {
    throw new ApiRequestError('network_error', 0);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiRequestError('invalid_response', response.status);
  }

  const apiPayload = payload as ApiErrorPayload;
  if (!response.ok || apiPayload?.ok === false) {
    throw new ApiRequestError(apiPayload?.error ?? 'request_failed', response.status);
  }

  return payload as T;
}
