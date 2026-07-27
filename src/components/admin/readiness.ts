// 공개 페이지 준비도 체크리스트 — 순수 계산. 라벨·판정을 한곳에 두어
// 에디터 UI와 무관하게 테스트한다.

export interface ReadinessInput {
  eventDate: string;
  address: string;
  summary: string;
  heroMediaId: string | null;
  bodyHasContent: boolean;
  mediaCount: number;
  videoCaptions: (string | null)[];
}

export type ReadinessItem = readonly [label: string, complete: boolean];

export function postReadiness(input: ReadinessInput): ReadinessItem[] {
  return [
    ['Event date and public URL', Boolean(input.eventDate)],
    ['Location and map link', Boolean(input.address.trim())],
    ['Lead summary', Boolean(input.summary.trim())],
    ['Cover image', Boolean(input.heroMediaId)],
    ['Body content', input.bodyHasContent],
    ['Photos or materials', input.mediaCount > 0],
    ['Video transcripts', input.videoCaptions.every((caption) => Boolean(caption?.trim()))],
  ];
}

export function readinessPercent(items: ReadinessItem[]): number {
  const complete = items.filter(([, done]) => done).length;
  return Math.round((complete / items.length) * 100);
}
