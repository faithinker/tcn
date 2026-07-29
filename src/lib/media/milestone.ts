import type { MilestoneMediaItem } from '../seminars';
import type { LightboxEntry } from './lightbox';

export function milestoneLightboxEntries(items: MilestoneMediaItem[]): LightboxEntry[] {
  return items.map((item) => ({
    id: item.src,
    type: 'image',
    src: `/images/history/${item.src}.webp`,
    alt: item.alt,
    caption: item.caption,
  }));
}
