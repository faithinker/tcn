import { describe, expect, it } from 'vitest';
import {
  attachmentSummary,
  displayUrl,
  formatClockTime,
  missingReadinessLabels,
  publishHeadline,
  publishPhase,
  publishTone,
  uploadProgressLabel,
} from './publish-state';

const at = new Date(2026, 6, 29, 17, 4);

describe('publishPhase', () => {
  it('reports a post that has never been saved as a draft', () => {
    expect(publishPhase({ hasPost: false, dirty: true, busy: false, outcome: null })).toBe('draft');
  });

  it('surfaces a failed creation instead of silently staying a draft', () => {
    expect(
      publishPhase({
        hasPost: false,
        dirty: true,
        busy: false,
        outcome: { kind: 'failed', message: 'Network unavailable.' },
      }),
    ).toBe('failed');
  });

  it('reports work in flight above everything else', () => {
    expect(
      publishPhase({
        hasPost: false,
        dirty: true,
        busy: true,
        outcome: { kind: 'failed', message: 'boom' },
      }),
    ).toBe('saving');
  });

  it('keeps a failure visible even after the editor keeps typing', () => {
    expect(
      publishPhase({
        hasPost: true,
        dirty: true,
        busy: false,
        outcome: { kind: 'failed', message: 'Network unavailable.' },
      }),
    ).toBe('failed');
    expect(
      publishPhase({
        hasPost: true,
        dirty: true,
        busy: false,
        outcome: { kind: 'partial', at, failures: ['clip.mp4: upload failed'] },
      }),
    ).toBe('partial');
  });

  it('prefers unsaved changes over a stale success once the editor edits again', () => {
    const outcome = { kind: 'published', at, uploaded: 2 } as const;
    expect(publishPhase({ hasPost: true, dirty: false, busy: false, outcome })).toBe('published');
    expect(publishPhase({ hasPost: true, dirty: true, busy: false, outcome })).toBe('dirty');
  });

  it('treats a freshly opened saved post as live', () => {
    expect(publishPhase({ hasPost: true, dirty: false, busy: false, outcome: null })).toBe('live');
  });
});

describe('publishHeadline and publishTone', () => {
  it('names each phase in the editor’s language', () => {
    expect(publishHeadline('draft', false)).toBe('Not published yet');
    expect(publishHeadline('dirty', true)).toBe('Unsaved changes');
    expect(publishHeadline('published', true)).toBe('Published');
    expect(publishHeadline('live', true)).toBe('Published');
    expect(publishHeadline('partial', true)).toBe('Published with problems');
  });

  it('distinguishes a failed first creation from a failed update', () => {
    expect(publishHeadline('failed', false)).toBe('Not created');
    expect(publishHeadline('failed', true)).toBe('Changes not published');
  });

  it('lets the progress line speak for itself while saving', () => {
    expect(publishHeadline('saving', true)).toBe('Publishing…');
  });

  it('maps phases to the four state tones', () => {
    expect(publishTone('published')).toBe('positive');
    expect(publishTone('live')).toBe('positive');
    expect(publishTone('dirty')).toBe('attention');
    expect(publishTone('failed')).toBe('danger');
    expect(publishTone('partial')).toBe('danger');
    expect(publishTone('draft')).toBe('neutral');
    expect(publishTone('saving')).toBe('neutral');
  });
});

describe('attachmentSummary', () => {
  it('counts what the reader will find on the public page', () => {
    expect(attachmentSummary([])).toBe('No media attached');
    expect(attachmentSummary([{ kind: 'image' }])).toBe('1 photo');
    expect(
      attachmentSummary([
        { kind: 'image' },
        { kind: 'image' },
        { kind: 'document' },
        { kind: 'video' },
      ]),
    ).toBe('2 photos · 1 document · 1 video');
  });
});

describe('missingReadinessLabels', () => {
  it('lists only what is still incomplete', () => {
    expect(
      missingReadinessLabels([
        ['Event date and public URL', true],
        ['Lead summary', false],
        ['Cover image', false],
      ]),
    ).toEqual(['Lead summary', 'Cover image']);
  });
});

describe('uploadProgressLabel', () => {
  it('counts the file in flight, never announcing a zeroth file', () => {
    expect(uploadProgressLabel(0, 3)).toBe('Uploading 1 of 3…');
    expect(uploadProgressLabel(1, 3)).toBe('Uploading 2 of 3…');
    // 마지막 파일이 끝난 뒤에도 총량을 넘겨 세지 않는다.
    expect(uploadProgressLabel(3, 3)).toBe('Uploading 3 of 3…');
    expect(uploadProgressLabel(0, 0)).toBe('Saving the post…');
  });
});

describe('formatClockTime and displayUrl', () => {
  it('shows a bare 24-hour clock and a protocol-free URL', () => {
    expect(formatClockTime(at)).toBe('17:04');
    expect(formatClockTime(new Date(2026, 6, 29, 9, 30))).toBe('09:30');
    expect(displayUrl('https://tcn.faithinker12.workers.dev/seminars/2100-02-20')).toBe(
      'tcn.faithinker12.workers.dev/seminars/2100-02-20',
    );
    expect(displayUrl('http://localhost:4322/seminars/2100-02-20/')).toBe(
      'localhost:4322/seminars/2100-02-20',
    );
  });
});
