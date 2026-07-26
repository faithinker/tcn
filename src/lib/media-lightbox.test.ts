import { describe, expect, it } from 'vitest';

import { serializeLightboxEntries, type LightboxEntry } from './media-lightbox';

describe('serializeLightboxEntries', () => {
  it('keeps administrator captions from terminating the JSON script element', () => {
    const entries: LightboxEntry[] = [
      {
        id: 'photo-1',
        type: 'image',
        src: '/media/p1/photo.webp',
        alt: 'Seminar photo',
        caption: '</script><script>globalThis.compromised = true</script>\u2028next',
      },
    ];
    const serialized = serializeLightboxEntries(entries);

    expect(serialized).not.toContain('<');
    expect(serialized).not.toContain('\u2028');
    expect(JSON.parse(serialized)).toEqual(entries);
  });
});
