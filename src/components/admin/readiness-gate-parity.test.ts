import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { postReadiness, readinessPercent } from './readiness';

// verify:admin 게이트의 A9 는 준비도 퍼센트를 숫자로 단정한다(71%). 체크리스트 항목이 늘거나
// 판정이 바뀌면 그 숫자가 먼저 틀리는데, 게이트는 브라우저·D1·R2 가 떠 있어야만 돌아서
// 어긋남이 CI 뒤로 밀린다. 항목 수 변경을 여기서 즉시 빨갛게 만든다.
const GATE = readFileSync(
  new URL('../../../scripts/verify-admin-authoring.mjs', import.meta.url),
  'utf8',
);

const match = GATE.match(/readinessPercent >= (\d+)/);
if (!match) {
  throw new Error(
    'verify-admin-authoring.mjs 에서 A9 준비도 임계값을 읽지 못했다 — 게이트가 바뀌었으면 이 테스트도 함께 고쳐야 한다.',
  );
}
const gateThreshold = Number(match[1]);

// A9 시점의 글 상태: 개최일·본문·사진·대표 이미지 충족, 장소·요약 미입력, 영상 없음.
const stateAtA9 = postReadiness({
  eventDate: '2099-12-31',
  address: '',
  summary: '',
  heroMediaId: 'media-1',
  bodyHasContent: true,
  mediaCount: 2,
  videoCaptions: [],
});

describe('readiness percent ↔ verify:admin A9 threshold', () => {
  it('reaches exactly the percentage the browser gate asserts', () => {
    expect(stateAtA9.filter(([, done]) => done)).toHaveLength(5);
    expect(stateAtA9).toHaveLength(7);
    expect(readinessPercent(stateAtA9)).toBe(gateThreshold);
  });

  it('keeps the gate threshold on the satisfiable side of the checklist', () => {
    expect(gateThreshold).toBeGreaterThan(0);
    expect(gateThreshold).toBeLessThan(100);
  });
});
