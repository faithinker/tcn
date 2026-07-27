// 미디어 관리 구획: 드롭존 업로드 + 이미지 그리드 + 파일 목록(캡션·정렬·삭제 포함).
// 모든 상태는 컨테이너 소유 — 이 컴포넌트는 파생 목록과 콜백만 받는다.
import type { RefObject } from 'react';
import { field, labelText, mediaAction } from './classnames';
import { fileTypeLabel } from './media-order';
import type { EditorMedia } from './types';

interface Props {
  hasPost: boolean;
  busy: boolean;
  dragging: boolean;
  imageMedia: EditorMedia[];
  fileMedia: EditorMedia[];
  openCaptions: ReadonlySet<string>;
  heroMediaId: string | null;
  managerRef: RefObject<HTMLDivElement | null>;
  onDraggingChange: (dragging: boolean) => void;
  onUpload: (files: FileList | null) => void;
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
  imageMedia,
  fileMedia,
  openCaptions,
  heroMediaId,
  managerRef,
  onDraggingChange,
  onUpload,
  onSetHero,
  onToggleCaption,
  onCaptionChange,
  onMove,
  onRemove,
}: Readonly<Props>) {
  return (
    <div ref={managerRef} tabIndex={-1}>
      <p className={labelText}>Media (photos, video, documents)</p>
      {!hasPost ? (
        <p className="text-caption text-body-muted">Save the post first to attach media.</p>
      ) : (
        <>
          <div
            data-dropzone
            onDragOver={(e) => {
              e.preventDefault();
              onDraggingChange(true);
            }}
            onDragLeave={(e) => {
              // 자식 요소로 이동할 때 발생하는 leave는 무시
              if (!e.currentTarget.contains(e.relatedTarget as Node)) onDraggingChange(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              onDraggingChange(false);
              onUpload(e.dataTransfer.files);
            }}
            className={`mb-3 border border-dashed p-4 text-center transition-colors ${
              dragging ? 'border-accent bg-canvas-soft' : 'border-hairline-strong bg-canvas'
            }`}
          >
            <p className="text-caption font-bold text-ink">Drag photos, video, or documents here</p>
            <p className="mt-1 text-caption text-body-muted">or choose files</p>
            <input
              type="file"
              multiple
              disabled={busy}
              accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
              onChange={(e) => onUpload(e.target.files)}
              className="mx-auto mt-2 block text-caption text-body-muted"
            />
          </div>
          {imageMedia.length > 0 && (
            <section aria-labelledby="media-images-heading">
              <div className="flex items-center justify-between">
                <h3 id="media-images-heading" className="font-sans text-body-sm font-bold text-ink">
                  Images
                </h3>
                <span className="text-caption text-body-muted">{imageMedia.length}</span>
              </div>
              <ul className="mt-2 grid gap-3 sm:grid-cols-2">
                {imageMedia.map((item, index) => (
                  <li key={item.id} className="border border-hairline p-2">
                    <img
                      src={`/media/${item.r2Key}`}
                      alt=""
                      className="aspect-square w-full bg-canvas-band object-cover"
                    />
                    <p className="mt-1 truncate text-caption text-body-muted">{item.filename}</p>
                    {openCaptions.has(item.id) && (
                      <div className="mt-3">
                        <label htmlFor={`media-caption-${item.id}`} className={labelText}>
                          Caption (optional)
                        </label>
                        <input
                          id={`media-caption-${item.id}`}
                          className={field}
                          maxLength={500}
                          placeholder="Describe this photo…"
                          value={item.caption ?? ''}
                          onChange={(event) => onCaptionChange(item.id, event.target.value)}
                        />
                        <p className="mt-1 text-caption text-body-muted">
                          Leave empty to show the image without a visible caption.
                        </p>
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 text-caption">
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
                        {openCaptions.has(item.id)
                          ? 'Hide caption field'
                          : item.caption
                            ? 'Edit caption'
                            : 'Add caption'}
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
              <p className="mt-2 text-caption text-body-muted">
                Cover image changes take effect after saving.
              </p>
            </section>
          )}
          {fileMedia.length > 0 && (
            <section
              className={imageMedia.length > 0 ? 'mt-6' : ''}
              aria-labelledby="media-files-heading"
            >
              <div className="flex items-center justify-between">
                <h3 id="media-files-heading" className="font-sans text-body-sm font-bold text-ink">
                  Files
                </h3>
                <span className="text-caption text-body-muted">{fileMedia.length}</span>
              </div>
              <ul className="mt-2 divide-y divide-hairline border-y border-hairline">
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
                          </p>
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
                          value={item.caption ?? ''}
                          onChange={(event) => onCaptionChange(item.id, event.target.value)}
                          aria-describedby={`video-transcript-help-${item.id}`}
                        />
                        <p
                          id={`video-transcript-help-${item.id}`}
                          className="mt-1 text-caption text-body-muted"
                        >
                          This video remains hidden from the public page until the transcript is
                          saved.
                        </p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
