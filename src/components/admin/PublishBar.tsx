// 저장·게시 상태 바 — 에디터 하단에 붙어 있고(sticky) 항상 한 가지 질문에 답한다:
// "이 글이 지금 공개 페이지에 올라가 있나?" 상태는 컨테이너(PostEditor)가 소유하고,
// 이 컴포넌트는 문장·색·모션만 담당한다.
import { useState } from 'react';
import {
  publishHeadline,
  publishTone,
  uploadProgressLabel,
  type PublishPhase,
  type PublishTone,
  type SaveOutcome,
} from './publish-state';

const DOT_COLOR: Record<PublishTone, string> = {
  neutral: 'bg-body-muted',
  positive: 'bg-accent',
  attention: 'bg-ink',
  danger: 'bg-danger',
};

const HEADLINE_COLOR: Record<PublishTone, string> = {
  neutral: 'text-body-muted',
  positive: 'text-ink',
  attention: 'text-ink',
  danger: 'text-danger',
};

// 체크 표시는 그려지듯 나타난다(450ms) — 저장이 "끝났다"는 유일한 축하 신호.
function DrawnCheck() {
  return (
    <svg
      className="admin-check mt-0.5 h-5 w-5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="square"
      aria-hidden="true"
    >
      <path d="M4 13l5.2 5.2L20 6" />
    </svg>
  );
}

interface Props {
  mode: 'create' | 'save';
  phase: PublishPhase;
  busy: boolean;
  outcome: SaveOutcome | null;
  savedAtLabel: string | null;
  revision: number | null;
  publicUrl: string | null;
  publicUrlLabel: string | null;
  ordinalLabel: string;
  eventDate: string;
  attachments: string;
  missing: string[];
  progress: { done: number; total: number; filename: string | null };
  // 글이 서버에 존재하는지 — 삭제 가능 여부와 실패 문구("생성 실패" vs "게시 실패")를 함께 가른다.
  hasPost: boolean;
  onSave: () => void;
  onDelete: () => void;
}

export default function PublishBar({
  mode,
  phase,
  busy,
  outcome,
  savedAtLabel,
  revision,
  publicUrl,
  publicUrlLabel,
  ordinalLabel,
  eventDate,
  attachments,
  missing,
  progress,
  hasPost,
  onSave,
  onDelete,
}: Readonly<Props>) {
  const [copied, setCopied] = useState(false);
  const tone = publishTone(phase);
  // 진행 중에는 버튼이 이미 "Publishing…"이라 같은 말을 두 번 쓰지 않는다 — 진행 수치를 앞세운다.
  const headline =
    phase === 'saving'
      ? uploadProgressLabel(progress.done, progress.total)
      : publishHeadline(phase, hasPost);

  const copyPublicUrl = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_800);
    } catch {
      // 클립보드 권한이 없으면 링크가 이미 화면에 있으니 조용히 넘어간다.
    }
  };

  const standingDetail = () => {
    if (phase === 'draft') return 'Nothing is public until you press Create.';
    if (phase === 'saving') {
      return progress.filename ?? 'Keep this tab open until it finishes.';
    }
    if (phase === 'failed' && !hasPost) return 'Nothing has been created yet.';
    if (phase === 'dirty' || phase === 'failed') {
      return 'The public page still shows the last published version.';
    }
    if (savedAtLabel) {
      return `Last published ${savedAtLabel}${revision ? ` · revision ${revision}` : ''}`;
    }
    return `Live on the public page${revision ? ` · revision ${revision}` : ''}`;
  };

  return (
    <div
      data-publish-bar
      className="sticky bottom-0 z-10 mt-2 border-t-2 border-hairline-strong bg-canvas pb-4 pt-4 shadow-overlay"
    >
      {outcome?.kind === 'published' && phase === 'published' && (
        <div className="admin-banner mb-4 border-t-2 border-accent bg-canvas-soft px-4 py-3">
          <div className="flex gap-3">
            <span className="text-accent">
              <DrawnCheck />
            </span>
            <div className="min-w-0">
              <p className="font-sans text-body-sm font-bold text-ink">
                {ordinalLabel} is live
                {outcome.uploaded > 0
                  ? ` with ${outcome.uploaded} new ${outcome.uploaded === 1 ? 'file' : 'files'}`
                  : ''}
              </p>
              {publicUrl && publicUrlLabel && (
                <p className="mt-1 break-all font-mono text-caption text-body-muted">
                  {publicUrlLabel}
                </p>
              )}
              <p className="mt-1 font-sans text-caption text-body-muted">
                {eventDate} · {attachments}
              </p>
              {missing.length > 0 && (
                <p className="mt-2 font-sans text-caption text-body-muted">
                  Still incomplete: <span className="font-bold text-ink">{missing.join(', ')}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {(phase === 'failed' || phase === 'partial') && (
        <div className="admin-banner mb-4 border-t-2 border-danger bg-danger-soft px-4 py-3">
          <p className="font-sans text-body-sm font-bold text-danger">
            {phase === 'partial'
              ? 'Published, but some files failed'
              : hasPost
                ? 'Your changes were not published'
                : 'The post was not created'}
          </p>
          {outcome?.kind === 'failed' && (
            <p className="mt-1 font-sans text-caption text-ink">{outcome.message}</p>
          )}
          {outcome?.kind === 'partial' && (
            <ul className="mt-1 space-y-1 font-sans text-caption text-ink">
              {outcome.failures.map((failure) => (
                <li key={failure}>{failure}</li>
              ))}
            </ul>
          )}
          <p className="mt-2 font-sans text-caption text-body-muted">
            {phase === 'failed'
              ? 'Nothing you typed was lost — press Save to try again.'
              : 'The files are still attached below. Press Save to retry the upload.'}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <button
          type="button"
          onClick={onSave}
          disabled={busy}
          className="min-h-11 rounded-sm bg-ink px-6 font-sans text-body-sm font-bold text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Publishing…' : mode === 'create' ? 'Create' : 'Save'}
        </button>

        <p className="flex min-w-0 items-baseline gap-2">
          <span
            aria-hidden="true"
            className={`mt-1 inline-block h-2 w-2 shrink-0 ${DOT_COLOR[tone]}`}
          />
          <span className="min-w-0">
            <span className={`font-sans text-body-sm font-bold ${HEADLINE_COLOR[tone]}`}>
              {headline}
            </span>
            <span className="block font-sans text-caption text-body-muted">{standingDetail()}</span>
          </span>
        </p>

        <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2 font-sans text-caption">
          {publicUrl && (
            <>
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener"
                className="inline-flex min-h-11 items-center gap-1 rounded-sm px-2 font-bold text-link no-underline hover:bg-canvas-band"
              >
                Open public page<span aria-hidden="true">↗</span>
              </a>
              <button
                type="button"
                onClick={() => void copyPublicUrl()}
                className="inline-flex min-h-11 items-center rounded-sm px-2 font-bold text-link hover:bg-canvas-band"
              >
                {copied ? 'Link copied' : 'Copy link'}
              </button>
            </>
          )}
          {hasPost && (
            <button
              type="button"
              data-post-delete
              onClick={onDelete}
              disabled={busy}
              className="inline-flex min-h-11 items-center rounded-sm px-2 font-bold text-danger hover:bg-danger-soft disabled:opacity-50"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {busy && (
        <div
          className="mt-3 h-1 w-full overflow-hidden bg-canvas-band"
          role="progressbar"
          aria-label="Publishing progress"
          aria-valuemin={0}
          aria-valuemax={progress.total > 0 ? progress.total : undefined}
          aria-valuenow={progress.total > 0 ? progress.done : undefined}
        >
          {progress.total > 0 ? (
            <div
              className="admin-progress h-1 bg-accent"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          ) : (
            // 남은 단계 수를 알 수 없는 구간(글 저장 자체)은 폭이 아니라 움직임으로 알린다.
            <div className="admin-progress-sweep h-1 w-1/3 bg-accent" />
          )}
        </div>
      )}
    </div>
  );
}
