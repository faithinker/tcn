import { describe, expect, it } from 'vitest';
import { postReadiness, readinessPercent } from './readiness';

const empty = {
  eventDate: '',
  address: '',
  summary: '',
  heroMediaId: null,
  bodyHasContent: false,
  mediaCount: 0,
  videoCaptions: [],
};

describe('postReadiness', () => {
  it('reports 7 items, all incomplete on a fresh post except vacuous transcripts', () => {
    const items = postReadiness(empty);
    expect(items).toHaveLength(7);
    // 비디오가 없으면 트랜스크립트 항목은 공허하게 충족(공개 차단 대상이 없음).
    expect(items.filter(([, done]) => done).map(([label]) => label)).toEqual(['Video transcripts']);
  });

  it('treats whitespace-only text fields as incomplete', () => {
    const items = postReadiness({ ...empty, address: '  ', summary: '\n' });
    const byLabel = Object.fromEntries(items);
    expect(byLabel['Location and map link']).toBe(false);
    expect(byLabel['Lead summary']).toBe(false);
  });

  it('requires every video to carry a transcript', () => {
    const one = postReadiness({ ...empty, videoCaptions: ['spoken words', null] });
    expect(Object.fromEntries(one)['Video transcripts']).toBe(false);
    const all = postReadiness({ ...empty, videoCaptions: ['spoken words', 'more words'] });
    expect(Object.fromEntries(all)['Video transcripts']).toBe(true);
  });

  it('completes date, cover, body, and media items from their inputs', () => {
    const items = postReadiness({
      ...empty,
      eventDate: '2100-01-15',
      heroMediaId: 'm1',
      bodyHasContent: true,
      mediaCount: 2,
    });
    const byLabel = Object.fromEntries(items);
    expect(byLabel['Event date and public URL']).toBe(true);
    expect(byLabel['Cover image']).toBe(true);
    expect(byLabel['Body content']).toBe(true);
    expect(byLabel['Photos or materials']).toBe(true);
  });
});

describe('readinessPercent', () => {
  it('rounds the share of completed items to a whole percent', () => {
    const filled = {
      ...empty,
      eventDate: '2099-12-31',
      heroMediaId: 'media-1',
      bodyHasContent: true,
      mediaCount: 2,
    };

    expect(readinessPercent(postReadiness(filled))).toBe(71);
    expect(readinessPercent(postReadiness({ ...filled, address: 'Seoul' }))).toBe(86);
    expect(readinessPercent(postReadiness(empty))).toBe(14);
  });

  it('reaches 100 only when every item is complete', () => {
    const complete = {
      eventDate: '2099-12-31',
      address: 'Seoul',
      summary: 'Lead',
      heroMediaId: 'media-1',
      bodyHasContent: true,
      mediaCount: 2,
      videoCaptions: ['spoken words'],
    };

    expect(readinessPercent(postReadiness(complete))).toBe(100);
  });
});
