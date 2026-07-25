import { describe, expect, it } from 'vitest';
import config from '../../../astro.config.mjs';

describe('site routing policy', () => {
  it('keeps the admin area outside locale-prefixed public routes', () => {
    expect(config.i18n?.routing).toBe('manual');
  });
});
