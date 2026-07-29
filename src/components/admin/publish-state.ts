// 저장·게시 상태의 표현 로직 — React 와 무관한 순수 함수.
// 에디터가 답해야 하는 질문은 하나다: "지금 이 글은 공개 페이지에 제대로 올라가 있나?"
// 그래서 상태는 '저장 요청의 결과'가 아니라 '공개 상태'로 이름 붙인다.
import type { ReadinessItem } from './readiness';

export type SaveOutcome =
  | { kind: 'published'; at: Date; uploaded: number }
  | { kind: 'partial'; at: Date; failures: string[] }
  | { kind: 'failed'; message: string };

export type PublishPhase =
  'draft' | 'saving' | 'failed' | 'partial' | 'published' | 'dirty' | 'live';

export type PublishTone = 'neutral' | 'positive' | 'attention' | 'danger';

export interface PublishPhaseInput {
  hasPost: boolean;
  dirty: boolean;
  busy: boolean;
  outcome: SaveOutcome | null;
}

// 우선순위: 진행 중 > 실패(재시도 전까지 남는다) > 미생성 > 수정중 > 성공.
// 실패가 '미생성'보다 앞선다 — 생성 자체가 실패한 경우에도 이유가 화면에 남아야 한다.
export function publishPhase({ hasPost, dirty, busy, outcome }: PublishPhaseInput): PublishPhase {
  if (busy) return 'saving';
  if (outcome?.kind === 'failed') return 'failed';
  if (outcome?.kind === 'partial') return 'partial';
  if (!hasPost) return 'draft';
  if (dirty) return 'dirty';
  if (outcome?.kind === 'published') return 'published';
  return 'live';
}

const HEADLINES: Record<PublishPhase, string> = {
  draft: 'Not published yet',
  saving: 'Publishing…',
  failed: 'Changes not published',
  partial: 'Published with problems',
  published: 'Published',
  dirty: 'Unsaved changes',
  live: 'Published',
};

const TONES: Record<PublishPhase, PublishTone> = {
  draft: 'neutral',
  saving: 'neutral',
  failed: 'danger',
  partial: 'danger',
  published: 'positive',
  dirty: 'attention',
  live: 'positive',
};

// 아직 만들어지지도 않은 글의 실패는 "게시 안 됨"이 아니라 "생성 안 됨"이다.
export function publishHeadline(phase: PublishPhase, hasPost: boolean): string {
  if (phase === 'failed' && !hasPost) return 'Not created';
  return HEADLINES[phase];
}

export function publishTone(phase: PublishPhase): PublishTone {
  return TONES[phase];
}

function plural(count: number, singular: string): string {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}

export function attachmentSummary(items: { kind: 'image' | 'video' | 'document' }[]): string {
  if (items.length === 0) return 'No media attached';
  const photos = items.filter((item) => item.kind === 'image').length;
  const documents = items.filter((item) => item.kind === 'document').length;
  const videos = items.filter((item) => item.kind === 'video').length;
  return [
    photos > 0 ? plural(photos, 'photo') : '',
    documents > 0 ? plural(documents, 'document') : '',
    videos > 0 ? plural(videos, 'video') : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

export function missingReadinessLabels(items: ReadinessItem[]): string[] {
  return items.filter(([, complete]) => !complete).map(([label]) => label);
}

// done 은 "끝난 개수"이고 사람에게는 "지금 몇 번째"가 필요하다 — 0번째 파일은 없다.
export function uploadProgressLabel(done: number, total: number): string {
  if (total === 0) return 'Saving the post';
  return `Uploading ${Math.min(done + 1, total)} of ${total}`;
}

// 로케일·타임존에 의존하지 않는 24시간 시계(감사 로그가 아니라 "방금"의 표시용).
export function formatClockTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}
