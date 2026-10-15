import { describe, expect, it } from 'vitest';
import { clientIpKey } from './client-ip';

function requestFrom(ip: string | null, extra: Record<string, string> = {}): Request {
  const headers = new Headers(extra);
  if (ip !== null) headers.set('cf-connecting-ip', ip);
  return new Request('https://tcn.example/api/auth/login', { headers });
}

describe('clientIpKey', () => {
  it('keeps an IPv4 address as is', () => {
    expect(clientIpKey(requestFrom('203.0.113.10'))).toBe('203.0.113.10');
  });

  it('collapses every address of one IPv6 /64 into the same key', () => {
    const full = clientIpKey(requestFrom('2001:db8:1:2:aaaa:bbbb:cccc:dddd'));
    const compressed = clientIpKey(requestFrom('2001:db8:1:2::1'));
    const upper = clientIpKey(requestFrom('2001:DB8:1:2:0:0:0:FFFF'));

    expect(compressed).toBe(full);
    expect(upper).toBe(full);
    expect(full).toBe('2001:0db8:0001:0002::/64');
  });

  it('separates different /64 networks', () => {
    expect(clientIpKey(requestFrom('2001:db8:1:2::1'))).not.toBe(
      clientIpKey(requestFrom('2001:db8:1:3::1')),
    );
  });

  it('expands a leading and a trailing :: before taking the prefix', () => {
    expect(clientIpKey(requestFrom('::1'))).toBe('0000:0000:0000:0000::/64');
    expect(clientIpKey(requestFrom('2001:db8::'))).toBe('2001:0db8:0000:0000::/64');
    expect(clientIpKey(requestFrom('2001:db8:0:0:1::'))).toBe('2001:0db8:0000:0000::/64');
  });

  it('treats an IPv4-mapped IPv6 address as the IPv4 address', () => {
    expect(clientIpKey(requestFrom('::ffff:203.0.113.10'))).toBe('203.0.113.10');
    expect(clientIpKey(requestFrom('::ffff:cb00:710a'))).toBe('203.0.113.10');
  });

  it('drops an IPv6 zone identifier', () => {
    expect(clientIpKey(requestFrom('fe80::1%eth0'))).toBe(clientIpKey(requestFrom('fe80::2')));
  });

  it('falls back to one shared bucket when the header is missing or malformed', () => {
    const unknown = clientIpKey(requestFrom(null));
    expect(unknown).toBe('unknown');
    expect(clientIpKey(requestFrom('not-an-ip'))).toBe(unknown);
    expect(clientIpKey(requestFrom('1:2:3:4:5:6:7:8:9'))).toBe(unknown);
    expect(clientIpKey(requestFrom('2001:db8::1::2'))).toBe(unknown);
    expect(clientIpKey(requestFrom('999.1.1.1'))).toBe(unknown);
    expect(clientIpKey(requestFrom(''))).toBe(unknown);
  });

  it('does not trust a client-provided forwarded address', () => {
    const forged = clientIpKey(requestFrom(null, { 'x-forwarded-for': '203.0.113.10' }));
    expect(forged).toBe('unknown');
  });
});
