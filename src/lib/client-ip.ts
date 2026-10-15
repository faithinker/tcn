// 레이트리밋용 클라이언트 식별자. `cf-connecting-ip` 만 신뢰하고(`x-forwarded-for` 는 무시),
// IPv6 는 주소 하나가 아니라 /64 대역을 한 사용자로 센다. 주소 단위면 공격자가 대역 안에서 주소를 바꿔 한도를 무력화한다.

const UNKNOWN = 'unknown';

function parseIpv4(text: string): [number, number, number, number] | null {
  const parts = text.split('.');
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : Number.NaN));
  if (octets.some((octet) => !(octet >= 0 && octet <= 255))) return null;
  return octets as [number, number, number, number];
}

// IPv6 문자열을 8개의 16비트 그룹으로 푼다. 형식이 틀리면 null.
function parseIpv6(text: string): number[] | null {
  let address = text.split('%', 1)[0];
  if (!/^[0-9a-f:.]+$/i.test(address)) return null;

  // 끝이 IPv4(`::ffff:203.0.113.10`)면 16진 그룹 둘로 바꾼다.
  const embedded = address.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (embedded) {
    const octets = parseIpv4(embedded[1]);
    if (!octets) return null;
    const high = ((octets[0] << 8) | octets[1]).toString(16);
    const low = ((octets[2] << 8) | octets[3]).toString(16);
    address = `${address.slice(0, -embedded[1].length)}${high}:${low}`;
  }

  const halves = address.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];

  if (halves.length === 1 && head.length !== 8) return null;
  if (halves.length === 2 && head.length + tail.length > 7) return null;

  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  const groups = [...head, ...Array<string>(fill).fill('0'), ...tail];
  if (groups.length !== 8) return null;

  const values = groups.map((group) => (/^[0-9a-f]{1,4}$/i.test(group) ? parseInt(group, 16) : -1));
  return values.includes(-1) ? null : values;
}

const hex4 = (value: number) => value.toString(16).padStart(4, '0');

export function clientIpKey(request: Request): string {
  const raw = request.headers.get('cf-connecting-ip')?.trim() ?? '';
  if (!raw) return UNKNOWN;

  const ipv4 = parseIpv4(raw);
  if (ipv4) return ipv4.join('.');

  const groups = parseIpv6(raw);
  if (!groups) return UNKNOWN;

  // IPv4-mapped(::ffff:a.b.c.d)는 IPv4 와 같은 사용자다.
  if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) {
    return [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff].join('.');
  }

  return `${groups.slice(0, 4).map(hex4).join(':')}::/64`;
}
