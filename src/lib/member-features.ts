import { env } from 'cloudflare:workers';

function enabled(name: 'MEMBER_FEATURES_ENABLED' | 'SIGNUP_ENABLED'): boolean {
  return (env as unknown as Record<string, unknown>)[name] === 'true';
}

export const memberFeaturesEnabled = (): boolean => enabled('MEMBER_FEATURES_ENABLED');
export const signupEnabled = (): boolean => enabled('SIGNUP_ENABLED');

export function memberFeatureUnavailable(): Response {
  return Response.json(
    { ok: false, error: 'member_features_unavailable' },
    {
      status: 503,
      headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex', 'retry-after': '300' },
    },
  );
}
