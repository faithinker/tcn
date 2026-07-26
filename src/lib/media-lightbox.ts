export interface LightboxEntry {
  id: string;
  type: 'image' | 'video';
  caption: string;
  alt: string;
  src: string;
  duration?: string;
}

export function serializeLightboxEntries(entries: LightboxEntry[]): string {
  return JSON.stringify(entries)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
