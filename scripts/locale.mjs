import assert from 'node:assert/strict';
import { onRequestGet as routeRoot } from '../functions/index.js';

function rootRequest(country, cookie = '', search = '') {
  return routeRoot({
    request: {
      url: `https://tcn.example/${search}`,
      headers: new Headers(cookie ? { Cookie: cookie } : {}),
      cf: { country },
    },
  });
}

const korea = await rootRequest('KR');
assert.equal(korea.status, 302);
assert.equal(korea.headers.get('Location'), 'https://tcn.example/ko/');

const overseas = await rootRequest('VN', '', '?utm_source=test');
assert.equal(overseas.headers.get('Location'), 'https://tcn.example/en/?utm_source=test');

const koreanChoice = await rootRequest('UZ', 'other=x; tcn_locale=ko');
assert.equal(koreanChoice.headers.get('Location'), 'https://tcn.example/ko/');

const englishChoice = await rootRequest('KR', 'tcn_locale=en');
assert.equal(englishChoice.headers.get('Location'), 'https://tcn.example/en/');

console.log('PASS: locale routing and preference cookie precedence');
