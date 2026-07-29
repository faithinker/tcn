// 미디어 관리 구획: 드롭존(영역 전체가 파일 선택 트리거) + 사진 그리드 + 파일 목록.
// 모든 상태는 컨테이너 소유 — 이 컴포넌트는 파생 목록과 콜백만 받는다.
// 선택한 파일은 업로드 전 스테이징 상태로도 여기에 나타난다(캡션·순서·대표 지정 가능).
import { useRef, type RefObject } from 'react';
import {
  formatFileSize,
  UPLOAD_ACCEPT_ATTRIBUTE,
  UPLOAD_FORMAT_HINT,
  UPLOAD_LIMIT_HINT,
} from '../../lib/media/accept';
import { field, labelText, mediaAction } from './classnames';
import { fileTypeLabel } from './media-order';
import { isPendingMedia, mediaPreviewSrc, pendingNotice } from './pending-media';
import type { MediaItem } from './types';

// 캡션 토글 버튼 문구: 열려 있으면 닫기, 닫혀 있으면 기존 캡션 유무에 따라 편집/추가.
function captionButtonLabel(open: boolean, caption: string | null): string {
  if (open) return 'Hide caption field';
  return caption ? 'Edit caption' : 'Add caption';
}

function PendingBadge() {
  return (
    <span className="mt-1 inline-block bg-canvas-band px-2 py-0.5 font-sans text-caption font-bold uppercase tracking-wide text-body-muted">
      Not uploaded yet
    </span>
  );
}

interface Props {
  hasPost: boolean;
  busy: boolean;
  dragging: boolean;
  pendingCount: number;
  imageMedia: MediaItem[];
  fileMedia: MediaItem[];
  openCaptions: ReadonlySet<string>;
  heroMediaId: string | null;
  managerRef: RefObject<HTMLDivElement | null>;
  onDraggingChange: (dragging: boolean) => void;
  onPickFiles: (files: FileList | null) => void;
  onSetHero: (id: string) => void;
  onToggleCaption: (id: string) => void;
  onCaptionChange: (id: string, caption: string) => void;
  onMove: (id: string, offset: -1 | 1) => void;
  onRemove: (id: string) => void;
}

export default function MediaManager({
  hasPost,
  busy,
  dragging,
  pendingCount,
  imageMedia,
  fileMedia,
  openCaptions,
  heroMediaId,
  managerRef,
  onDraggingChange,
  onPickFiles,
  onSetHero,
  onToggleCaption,
  onCaptionChange,
  onMove,
  onRemove,
}: Readonly<Props>) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadHint = hasPost
    ? 'Selected files are uploaded when you press Save.'
    : 'Selected files are uploaded when you press Create.';

  return (
    <div ref={managerRef} tabIndex={-1}>
      <div className="flex items-baseline justify-between gap-4">
        <p className={labelText}>Media</p>
        <p className="mb-1 font-sans text-caption text-body-muted">
          {imageMedia.length} {imageMedia.length === 1 ? 'photo' : 'photos'} · {fileMedia.length}{' '}
          {fileMedia.length === 1 ? 'file' : 'files'}
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        tabIndex={-1}
        aria-hidden="true"
        disabled={busy}
        accept={UPLOAD_ACCEPT_ATTRIBUTE}
        onChange={(event) => {
          onPickFiles(event.target.files);
          // 같은 파일을 다시 고를 때도 change 가 발생하도록 값을 비운다.
          event.target.value = '';
        }}
        className="sr-only"
      />
      <button
        type="button"
        data-dropzone
        disabled={busy}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          onDraggingChange(true);
        }}
        onDragLeave={(event) => {
          // 자식 요소로 이동할 때 발생하는 leave는 무시
          if (!event.currentTarget.contains(event.relatedTarget as Node)) onDraggingChange(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          onDraggingChange(false);
          onPickFiles(event.dataTransfer.files);
        }}
        className={`flex w-full cursor-pointer flex-col items-center gap-1.5 border-2 border-dashed px-6 py-9 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
          dragging
            ? 'border-accent bg-canvas-soft'
            : 'border-hairline bg-canvas hover:border-accent hover:bg-canvas-soft'
        }`}
      >
        <span aria-hidden="true" className="font-sans text-body-serif font-bold text-body-muted">
          ↑
        </span>
        <span className="font-sans text-body-sm font-bold text-ink">
          Drop files here, or click to browse
        </span>
        <span className="max-w-[36rem] font-sans text-caption leading-relaxed text-body-muted">
          {UPLOAD_FORMAT_HINT}
        </span>
        <span className="font-sans text-caption text-body-muted">{UPLOAD_LIMIT_HINT}</span>
      </button>
      <p className="mt-2 font-sans text-caption text-body-muted">
        {pendingCount > 0 ? pendingNotice(pendingCount) : uploadHint}
      </p>

      {imageMedia.length > 0 && (
        <section className="mt-6" aria-labelledby="media-images-heading">
          <div className="flex items-center justify-between border-b border-hairline pb-2">
            <h3 id="media-images-heading" className="font-sans text-body-sm font-bold text-ink">
              Photos
            </h3>
            <span className="font-sans text-caption text-body-muted">{imageMedia.length}</span>
          </div>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {imageMedia.map((item, index) => (
              <li key={item.id} className="border border-hairline p-2">
                <img
                  src={mediaPreviewSrc(item) ?? ''}
                  alt=""
                  className="aspect-square w-full bg-canvas-band object-cover"
                />
                <p className="mt-1 truncate font-sans text-caption text-body-muted">
                  {item.filename}
                </p>
                {isPendingMedia(item) && <PendingBadge />}
                {openCaptions.has(item.id) && (
                  <div className="mt-3">
                    <label htmlFor={`media-caption-${item.id}`} className={labelText}>
                      Caption (optional)
                    </label>
                    <input
                      id={`media-caption-${item.id}`}
                      className={field}
                      maxLength={500}
                      // 업로드 중 입력한 값은 저장 스냅샷에 반영되지 않으므로 잠근다.
                      disabled={busy}
                      placeholder="Describe this photo…"
                      value={item.caption ?? ''}
                      onChange={(event) => onCaptionChange(item.id, event.target.value)}
                    />
                    <p className="mt-1 font-sans text-caption text-body-muted">
                      Leave empty to show the image without a visible caption.
                    </p>
                  </div>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 font-sans text-caption">
                  <button
                    type="button"
                    onClick={() => onSetHero(item.id)}
                    disabled={busy}
                    className={`inline-flex min-h-11 items-center font-bold ${heroMediaId === item.id ? 'text-accent' : 'text-link'}`}
                  >
                    {heroMediaId === item.id ? '★ Cover' : 'Set as cover'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleCaption(item.id)}
                    disabled={busy}
                    className={`${mediaAction} text-link`}
                  >
                    {captionButtonLabel(openCaptions.has(item.id), item.caption)}
                  </button>
                  <button
                    type="button"
                    onClick={() => onMove(item.id, -1)}
                    disabled={busy || index === 0}
                    className={`${mediaAction} text-link disabled:cursor-not-allowed disabled:opacity-40`}
                    aria-label={`Move ${item.filename ?? 'image'} earlier`}
                  >
                    Earlier
                  </button>
                  <button
                    type="button"
                    onClick={() => onMove(item.id, 1)}
                    disabled={busy || index === imageMedia.length - 1}
                    className={`${mediaAction} text-link disabled:cursor-not-allowed disabled:opacity-40`}
                    aria-label={`Move ${item.filename ?? 'image'} later`}
                  >
                    Later
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    disabled={busy}
                    className={`${mediaAction} text-accent`}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 font-sans text-caption text-body-muted">
            Cover image changes take effect after saving.
          </p>
        </section>
      )}

      {fileMedia.length > 0 && (
        <section className="mt-6" aria-labelledby="media-files-heading">
          <div className="flex items-center justify-between border-b border-hairline pb-2">
            <h3 id="media-files-heading" className="font-sans text-body-sm font-bold text-ink">
              Video and documents
            </h3>
            <span className="font-sans text-caption text-body-muted">{fileMedia.length}</span>
          </div>
          <ul className="divide-y divide-hairline border-b border-hairline">
            {fileMedia.map((item, index) => (
              <li key={item.id} className="py-3">
                <div className="sm:flex sm:items-center sm:gap-4">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span
                      className="inline-flex h-10 w-12 shrink-0 items-center justify-center bg-canvas-band font-mono text-caption font-bold text-body-muted"
                      aria-hidden="true"
                    >
                      {fileTypeLabel(item)}
                    </span>
                    <div className="min-w-0">
                      <p className="break-words font-sans text-body-sm font-bold text-ink">
                        {item.filename ?? 'Untitled file'}
                      </p>
                      <p className="font-sans text-caption text-body-muted">
                        {item.kind === 'video' ? 'Video file' : 'Document'}
                        {isPendingMedia(item) ? ` · ${formatFileSize(item.size)}` : ''}
                      </p>
                      {isPendingMedia(item) && <PendingBadge />}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 font-sans text-caption sm:mt-0 sm:shrink-0">
                    <button
                      type="button"
                      onClick={() => onMove(item.id, -1)}
                      disabled={busy || index === 0}
                      className={`${mediaAction} text-link disabled:cursor-not-allowed disabled:opacity-40`}
                      aria-label={`Move ${item.filename ?? 'file'} earlier`}
                    >
                      Earlier
                    </button>
                    <button
                      type="button"
                      onClick={() => onMove(item.id, 1)}
                      disabled={busy || index === fileMedia.length - 1}
                      className={`${mediaAction} text-link disabled:cursor-not-allowed disabled:opacity-40`}
                      aria-label={`Move ${item.filename ?? 'file'} later`}
                    >
                      Later
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(item.id)}
                      disabled={busy}
                      className={`${mediaAction} text-accent`}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {item.kind === 'video' && (
                  <div className="mt-3">
                    <label htmlFor={`video-transcript-${item.id}`} className={labelText}>
                      Video transcript (required for public display)
                    </label>
                    <textarea
                      id={`video-transcript-${item.id}`}
                      className={field}
                      rows={4}
                      maxLength={500}
                      disabled={busy}
                      value={item.caption ?? ''}
                      onChange={(event) => onCaptionChange(item.id, event.target.value)}
                      aria-describedby={`video-transcript-help-${item.id}`}
                    />
                    <p
                      id={`video-transcript-help-${item.id}`}
                      className="mt-1 font-sans text-caption text-body-muted"
                    >
                      This video remains hidden from the public page until the transcript is saved.
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
