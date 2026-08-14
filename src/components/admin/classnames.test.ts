import { describe, expect, it } from 'vitest';

import { mediaAction } from './classnames';

describe('admin class names', () => {
  it('uses a hover surface instead of a resting underline for media actions', () => {
    expect(mediaAction).toContain('no-underline');
    expect(mediaAction).toContain('hover:bg-canvas-soft');
    expect(mediaAction.split(' ')).not.toContain('underline');
  });
});
