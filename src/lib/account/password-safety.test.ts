import { it, expect, vi, afterEach } from 'vitest';
import { assertPasswordNotBreached } from './password-safety';
import { bytesToHex } from '../crypto';
afterEach(() => vi.unstubAllGlobals());
it('sends only a five-character hash prefix and compares the returned suffix locally', async () => {
  const password = 'A phrase long enough for this test';
  const hash = bytesToHex(
    new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(password))),
  ).toUpperCase();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(hash.slice(5) + ':42\r\n' + '0'.repeat(35) + ':0')),
  );
  await expect(
    assertPasswordNotBreached(password, new Request('https://tcn.example'), {}),
  ).rejects.toMatchObject({ code: 'weak_password' });
  expect(fetch).toHaveBeenCalledWith(
    'https://api.pwnedpasswords.com/range/' + hash.slice(0, 5),
    expect.objectContaining({ headers: { 'Add-Padding': 'true' } }),
  );
});
it('accepts unmatched passwords and fails closed on network errors', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('0'.repeat(35) + ':0')),
  );
  await expect(
    assertPasswordNotBreached(
      'Another unique phrase by a river',
      new Request('https://tcn.example'),
      {},
    ),
  ).resolves.toBeUndefined();
  vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'));
  await expect(
    assertPasswordNotBreached(
      'Another unique phrase by a river',
      new Request('https://tcn.example'),
      {},
    ),
  ).rejects.toMatchObject({ code: 'password_check_unavailable', status: 503 });
});
