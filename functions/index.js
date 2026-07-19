const LANGUAGE_COOKIE = 'tcn_locale';
const SUPPORTED_LANGUAGES = new Set(['ko', 'en']);

function readLanguageCookie(request) {
  const cookie = request.headers.get('Cookie') ?? '';
  for (const pair of cookie.split(';')) {
    const [name, value] = pair.trim().split('=');
    if (name === LANGUAGE_COOKIE && SUPPORTED_LANGUAGES.has(value)) return value;
  }
  return null;
}

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const preferred = readLanguageCookie(request);
  const country = request.cf?.country;
  const language = preferred ?? (country === 'KR' ? 'ko' : 'en');

  url.pathname = `/${language}/`;
  return Response.redirect(url.toString(), 302);
}

export const onRequestHead = onRequestGet;
