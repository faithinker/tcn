// Baseline security headers for every response.
//
// Prerendered pages are served by Workers Static Assets and never reach the
// middleware, so `public/_headers` carries the same set under `/*`. A test keeps
// the two in sync; change both together.

const TURNSTILE = 'https://challenges.cloudflare.com';

// Enforced everywhere: only directives that cannot break page scripts or styles.
const ENFORCED_CSP = ["frame-ancestors 'none'", "base-uri 'self'", "object-src 'none'"];

// Observed only (Report-Only) until the console stays clean, then enforce.
// 'unsafe-inline' stays for now: Astro islands, the theme bootstrap and the
// Q&A form script are inline. Hashing them is the follow-up.
const OBSERVED_CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${TURNSTILE}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "media-src 'self' blob:",
  `connect-src 'self' ${TURNSTILE}`,
  `frame-src ${TURNSTILE}`,
  "form-action 'self'",
  ...ENFORCED_CSP,
];

export const SECURITY_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'Content-Security-Policy': ENFORCED_CSP.join('; '),
  'Content-Security-Policy-Report-Only': OBSERVED_CSP.join('; '),
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // No includeSubDomains/preload: neither is a commitment to make blindly.
  'Strict-Transport-Security': 'max-age=31536000',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
});

function setMissing(headers: Headers) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(name)) headers.set(name, value);
  }
}

// Mutates in place so framework state attached to the response (cookies) stays
// with it. Redirects and fetched responses have immutable headers; those are
// copied once instead.
export function applySecurityHeaders(response: Response): Response {
  try {
    setMissing(response.headers);
    return response;
  } catch {
    const mutable = new Response(response.body, response);
    setMissing(mutable.headers);
    return mutable;
  }
}
