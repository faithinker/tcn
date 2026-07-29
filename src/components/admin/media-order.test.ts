import { describe, expect, it } from 'vitest';
import { moveWithinGroup } from './media-order';

type Kind = 'image' | 'video' | 'document';
const item = (id: string, kind: Kind) => ({ id, kind });

// 화면과 동일한 혼합 배열: 이미지 그룹(a,b,c)과 파일 그룹(v,d)이 섞여 있다.
const mixed = [
  item('a', 'image'),
  item('v', 'video'),
  item('b', 'image'),
  item('d', 'document'),
  item('c', 'image'),
];
const ids = (items: { id: string }[]) => items.map((i) => i.id);

describe('moveWithinGroup', () => {
  it('moves an image past interleaved non-images to its group neighbour', () => {
    // b(이미지)를 앞으로 → 이미지 그룹 이웃 a와 교환. v·d는 제자리.
    expect(ids(moveWithinGroup(mixed, 'b', -1))).toEqual(['b', 'v', 'a', 'd', 'c']);
    expect(ids(moveWithinGroup(mixed, 'b', 1))).toEqual(['a', 'v', 'c', 'd', 'b']);
  });

  it('moves within the non-image group without touching images', () => {
    expect(ids(moveWithinGroup(mixed, 'v', 1))).toEqual(['a', 'd', 'b', 'v', 'c']);
  });

  it('returns the array unchanged at group boundaries', () => {
    expect(moveWithinGroup(mixed, 'a', -1)).toBe(mixed); // 첫 이미지 위로 없음
    expect(moveWithinGroup(mixed, 'c', 1)).toBe(mixed); // 마지막 이미지 아래로 없음
    expect(moveWithinGroup(mixed, 'd', 1)).toBe(mixed); // 마지막 파일
  });

  it('ignores unknown ids and single-item groups', () => {
    expect(moveWithinGroup(mixed, 'nope', 1)).toBe(mixed);
    const single = [item('only', 'image')];
    expect(moveWithinGroup(single, 'only', 1)).toBe(single);
  });

  it('does not mutate the input array', () => {
    const before = ids(mixed);
    moveWithinGroup(mixed, 'b', -1);
    expect(ids(mixed)).toEqual(before);
  });
});
