export interface MediaMetadataPayload {
  caption?: unknown;
  position?: unknown;
}

export interface MediaMetadata {
  caption: string | null;
  position: number;
}

export function normalizeMediaMetadata(payload: MediaMetadataPayload): MediaMetadata {
  const caption = typeof payload.caption === 'string' ? payload.caption.trim() : null;
  if (caption && caption.length > 500) throw new Error('caption_too_long');
  if (!Number.isInteger(payload.position) || Number(payload.position) < 0) {
    throw new Error('position_invalid');
  }
  return {
    caption: caption || null,
    position: Number(payload.position),
  };
}
