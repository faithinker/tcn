// 글 작성 컨테이너. 모든 상태와 API 호출은 여기 산다 — 하위 컴포넌트
// (PostFields·BodyEditor·MediaManager·ReadinessAside)는 값·콜백만 받는 표현 계층이다.
// 행동 계약은 scripts/verify-admin-authoring.mjs 브라우저 게이트가 잠근다.
import Link from '@tiptap/extension-link';
import StarterKit from '@tiptap/starter-kit';
import { useEditor } from '@tiptap/react';
import { Markdown } from 'tiptap-markdown';
import { useRef, useState } from 'react';
import { requestJson } from '../../lib/admin-api';
import { requestErrorMessage } from './editor-messages';
import { moveWithinGroup } from './media-order';
import { postReadiness } from './readiness';
import { processImage } from '../../lib/media/process-image';
import { mediaMetadataForSave } from '../../lib/media/metadata';
import { formatSeminarOrdinalLabel, seminarHref } from '../../lib/seminars';
import BodyEditor from './BodyEditor';
import MediaManager from './MediaManager';
import PostFields from './PostFields';
import ReadinessAside from './ReadinessAside';
import type { EditorMedia, EditorPost } from './types';

export type { EditorMedia, EditorPost } from './types';

interface Props {
  post?: EditorPost | null;
  media?: EditorMedia[];
  seminarSequence?: number;
}

export default function PostEditor({
  post = null,
  media: initialMedia = [],
  seminarSequence = 1,
}: Readonly<Props>) {
  const [title, setTitle] = useState(post?.title ?? '');
  const [summary, setSummary] = useState(post?.summary ?? '');
  const [eventDate, setEventDate] = useState(post?.eventDate ?? '');
  const [address, setAddress] = useState(post?.address ?? '');
  const [heroMediaId, setHeroMediaId] = useState<string | null>(post?.heroMediaId ?? null);
  const [revision, setRevision] = useState<number | null>(post?.revision ?? null);
  const [media, setMedia] = useState<EditorMedia[]>(() =>
    [...initialMedia].sort((a, b) => a.position - b.position),
  );
  const [openCaptions, setOpenCaptions] = useState<Set<string>>(
    () =>
      new Set(
        initialMedia.filter((item) => item.kind === 'image' && item.caption).map((item) => item.id),
      ),
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [dragging, setDragging] = useState(false);
  const [bodyHasContent, setBodyHasContent] = useState(Boolean(post?.body.trim()));
  const mediaManagerRef = useRef<HTMLDivElement>(null);
  const eventDateLocked = Boolean(post?.eventDate);
  const publicHref = seminarHref(eventDate);
  const ordinalLabel = formatSeminarOrdinalLabel(seminarSequence);
  const imageMedia = media.filter((item) => item.kind === 'image');
  const fileMedia = media.filter((item) => item.kind !== 'image');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer' } }),
      Markdown.configure({ html: false, transformPastedText: true }),
    ],
    content: post?.body ?? '',
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) =>
      setBodyHasContent(Boolean(currentEditor.getText().trim())),
    editorProps: {
      attributes: {
        class: 'admin-prose min-h-[16rem] px-3 py-3 focus:outline-none',
        'aria-labelledby': 'post-body-label',
      },
    },
  });

  const save = async () => {
    if (busy) return;
    if (!title.trim()) {
      setStatus('Please enter a title.');
      return;
    }
    setBusy(true);
    setStatus('Saving…');
    // tiptap-markdown 확장의 storage 타입은 Tiptap Storage 맵에 등록되지 않아 좁혀서 캐스트.
    const markdownStorage = (editor?.storage as Record<string, unknown> | undefined)?.markdown as
      { getMarkdown(): string } | undefined;
    const body = markdownStorage?.getMarkdown() ?? '';
    const payload = { title, summary, eventDate, address, body, heroMediaId, revision };
    try {
      const result = await requestJson<{ ok: true; post?: { id: string; revision: number } }>(
        post ? `/api/posts/${post.id}` : '/api/posts',
        {
          method: post ? 'PUT' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      if (!post && result.post) {
        // 새 글은 저장 후 편집 화면으로 이동 → 미디어 첨부 가능
        window.location.href = `/admin/posts/${result.post.id}`;
        return;
      }
      if (result.post) setRevision(result.post.revision);
      const metadataResults = await Promise.allSettled(
        media.map((item, position) =>
          requestJson(`/api/media/${item.id}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(mediaMetadataForSave(item, position)),
          }),
        ),
      );
      const failedMetadata = metadataResults.filter(
        (result) => result.status === 'rejected',
      ).length;
      if (failedMetadata > 0) {
        setStatus(
          `Post saved, but ${failedMetadata} media ${failedMetadata === 1 ? 'item' : 'items'} could not be updated. Retry Save.`,
        );
        return;
      }
      setMedia((current) => current.map((item, position) => ({ ...item, position })));
      setStatus('Saved ✓');
    } catch (error) {
      setStatus(requestErrorMessage(error, 'Save failed. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const uploadFiles = async (files: FileList | null) => {
    if (busy || !post || !files || files.length === 0) return;
    setBusy(true);
    let nextPosition = media.length;
    let uploaded = 0;
    const failures: string[] = [];
    try {
      for (const file of Array.from(files)) {
        setStatus(`Uploading: ${file.name}`);
        let uploadFile = file;
        if (file.type.startsWith('image/')) {
          try {
            const processed = await processImage(file);
            const name = file.name.replace(/\.[^.]+$/, '') + '.webp';
            uploadFile = new File([processed.blob], name, { type: 'image/webp' });
          } catch {
            failures.push(`${file.name}: image processing failed`);
            continue;
          }
        }
        const uploadQuery = new URLSearchParams({
          postId: post.id,
          filename: uploadFile.name,
          position: String(nextPosition),
        });
        try {
          const result = await requestJson<{ ok: true; media: EditorMedia }>(
            `/api/media?${uploadQuery}`,
            {
              method: 'POST',
              headers: { 'content-type': uploadFile.type },
              body: uploadFile,
            },
          );
          const added = result.media;
          setMedia((current) => [...current, added]);
          setHeroMediaId((current) => current ?? (added.kind === 'image' ? added.id : current));
          nextPosition += 1;
          uploaded += 1;
        } catch (error) {
          failures.push(`${file.name}: ${requestErrorMessage(error, 'upload failed')}`);
        }
      }
      if (failures.length === 0) {
        const noun = uploaded === 1 ? 'file' : 'files';
        setStatus(`${uploaded} ${noun} uploaded ✓`);
      } else {
        setStatus(`${uploaded} uploaded; ${failures.length} failed. ${failures.join(' · ')}`);
      }
    } finally {
      setBusy(false);
    }
  };

  const removeMedia = async (id: string) => {
    if (busy) return;
    setBusy(true);
    setStatus('Deleting media…');
    try {
      await requestJson(`/api/media/${id}`, { method: 'DELETE' });
      setMedia((current) => current.filter((item) => item.id !== id));
      setHeroMediaId((current) => (current === id ? null : current));
      setStatus('Media deleted ✓');
      queueMicrotask(() => mediaManagerRef.current?.focus());
    } catch (error) {
      setStatus(requestErrorMessage(error, 'Media could not be deleted. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const toggleCaption = (id: string) => {
    setOpenCaptions((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateCaption = (id: string, caption: string) => {
    setMedia((current) =>
      current.map((item) => (item.id === id ? { ...item, caption: caption || null } : item)),
    );
  };

  const moveMediaWithinGroup = (id: string, offset: -1 | 1) =>
    setMedia((current) => moveWithinGroup(current, id, offset));

  const deletePost = async () => {
    if (busy || !post || !window.confirm('Delete this post? (It will be hidden, not erased.)'))
      return;
    setBusy(true);
    setStatus('Deleting post…');
    try {
      await requestJson(`/api/posts/${post.id}`, { method: 'DELETE' });
      window.location.href = '/admin';
    } catch (error) {
      setStatus(requestErrorMessage(error, 'Post could not be deleted. Try again.'));
      setBusy(false);
    }
  };

  const readiness = postReadiness({
    eventDate,
    address,
    summary,
    heroMediaId,
    bodyHasContent,
    mediaCount: media.length,
    videoCaptions: fileMedia.filter((item) => item.kind === 'video').map((item) => item.caption),
  });

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 space-y-6">
        <PostFields
          title={title}
          summary={summary}
          eventDate={eventDate}
          address={address}
          eventDateLocked={eventDateLocked}
          publicHref={publicHref}
          ordinalLabel={ordinalLabel}
          isExisting={Boolean(post)}
          onTitleChange={setTitle}
          onSummaryChange={setSummary}
          onEventDateChange={setEventDate}
          onAddressChange={setAddress}
        />

        <BodyEditor editor={editor} />

        <MediaManager
          hasPost={Boolean(post)}
          busy={busy}
          dragging={dragging}
          imageMedia={imageMedia}
          fileMedia={fileMedia}
          openCaptions={openCaptions}
          heroMediaId={heroMediaId}
          managerRef={mediaManagerRef}
          onDraggingChange={setDragging}
          onUpload={(files) => void uploadFiles(files)}
          onSetHero={setHeroMediaId}
          onToggleCaption={toggleCaption}
          onCaptionChange={updateCaption}
          onMove={moveMediaWithinGroup}
          onRemove={(id) => void removeMedia(id)}
        />

        <div className="flex items-center gap-4 border-t border-hairline pt-5">
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="bg-ink px-5 py-2 font-sans text-body-sm font-bold text-on-primary hover:opacity-90 disabled:opacity-50"
          >
            {post ? 'Save' : 'Create'}
          </button>
          {post && (
            <button
              type="button"
              onClick={deletePost}
              disabled={busy}
              className="text-caption font-bold text-accent underline"
            >
              Delete
            </button>
          )}
          <span role="status" aria-live="polite" className="text-caption text-body-muted">
            {status}
          </span>
        </div>
      </div>

      <ReadinessAside readiness={readiness} hasPost={Boolean(post)} publicHref={publicHref} />
    </div>
  );
}
