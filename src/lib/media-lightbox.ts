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
    .replaceAll('<', String.raw`\u003c`)
    .replaceAll('\u2028', String.raw`\u2028`)
    .replaceAll('\u2029', String.raw`\u2029`);
}
