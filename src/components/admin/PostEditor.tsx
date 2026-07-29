// 글 작성 컨테이너. 모든 상태와 API 호출은 여기 산다 — 하위 컴포넌트
// (PostFields·BodyEditor·MediaManager·ReadinessAside)는 값·콜백만 받는 표현 계층이다.
// 미디어는 선택 즉시 올리지 않고 스테이징만 하고, Save 한 번이 [글 저장 → 업로드 → 메타] 를
// 순서대로 처리한다. 미디어 행은 글이 있어야 만들 수 있어서 새 글은 그 안에서 먼저 생성된다.
// 행동 계약은 scripts/verify-admin-authoring.mjs 브라우저 게이트가 잠근다.
import Link from '@tiptap/extension-link';
import StarterKit from '@tiptap/starter-kit';
import { useEditor } from '@tiptap/react';
import { Markdown } from 'tiptap-markdown';
import { useEffect, useRef, useState } from 'react';
import { requestJson } from '../../lib/admin-api';
import { requestErrorMessage } from './editor-messages';
import { moveWithinGroup } from './media-order';
import { postReadiness } from './readiness';
import {
  attachmentSummary,
  displayUrl,
  formatClockTime,
  missingReadinessLabels,
  publishPhase,
  type SaveOutcome,
} from './publish-state';
import { processImage } from '../../lib/media/process-image';
import { formatFileSize, inspectUploadCandidate } from '../../lib/media/accept';
import { UPLOAD_LIMITS } from '../../lib/media/validate';
import { mediaMetadataForSave } from '../../lib/media/metadata';
import {
  countPendingMedia,
  isPendingMedia,
  PENDING_ID_PREFIX,
  pendingNotice,
  remapMediaIds,
  replacePendingMedia,
} from './pending-media';
import { formatSeminarOrdinalLabel, seminarHref } from '../../lib/seminars';
import BodyEditor from './BodyEditor';
import MediaManager from './MediaManager';
import PostFields from './PostFields';
import PublishBar from './PublishBar';
import ReadinessAside from './ReadinessAside';
import type { EditorMedia, EditorPost, MediaItem, PendingMedia } from './types';

export type { EditorMedia, EditorPost } from './types';

interface Props {
  post?: EditorPost | null;
  media?: EditorMedia[];
  seminarSequence?: number;
  // 공개 링크의 절대 주소는 서버에서 주입한다 — 클라이언트에서 window 로 만들면
  // SSR 결과와 달라져 하이드레이션이 깨진다.
  siteOrigin?: string;
}

function webpFilename(filename: string): string {
  return `${filename.replace(/\.[^.]+$/, '')}.webp`;
}

export default function PostEditor({
  post = null,
  media: initialMedia = [],
  seminarSequence = 1,
  siteOrigin = '',
}: Readonly<Props>) {
  const [postId, setPostId] = useState<string | null>(post?.id ?? null);
  const [title, setTitle] = useState(post?.title ?? '');
  const [summary, setSummary] = useState(post?.summary ?? '');
  const [eventDate, setEventDate] = useState(post?.eventDate ?? '');
  const [address, setAddress] = useState(post?.address ?? '');
  const [heroMediaId, setHeroMediaId] = useState<string | null>(post?.heroMediaId ?? null);
  const [revision, setRevision] = useState<number | null>(post?.revision ?? null);
  const [media, setMedia] = useState<MediaItem[]>(() =>
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
  // 게시 상태: 마지막 저장 결과 + 그 뒤에 손댄 적이 있는지 + 진행률.
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null);
  const [dirty, setDirty] = useState(false);
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
    filename: string | null;
  }>({ done: 0, total: 0, filename: null });
  const mediaManagerRef = useRef<HTMLDivElement>(null);
  const stagedCounter = useRef(0);
  // beforeunload 핸들러는 렌더 사이에 살아 있어야 하므로 ref 로 최신 dirty 를 읽는다.
  const dirtyRef = useRef(false);
  const markDirty = () => {
    dirtyRef.current = true;
    setDirty(true);
  };
  const eventDateLocked = Boolean(postId);
  const publicHref = seminarHref(eventDate);
  const ordinalLabel = formatSeminarOrdinalLabel(seminarSequence);
  const imageMedia = media.filter((item) => item.kind === 'image');
  const fileMedia = media.filter((item) => item.kind !== 'image');
  const pendingCount = countPendingMedia(media);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer' } }),
      Markdown.configure({ html: false, transformPastedText: true }),
    ],
    content: post?.body ?? '',
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => {
      setBodyHasContent(Boolean(currentEditor.getText().trim()));
      markDirty();
    },
    editorProps: {
      attributes: {
        class: 'admin-prose min-h-[16rem] px-3 py-3 focus:outline-none',
        'aria-labelledby': 'post-body-label',
      },
    },
  });

  // 선택·드롭한 파일을 검사해 스테이징에 넣는다. 여기서는 네트워크를 타지 않는다.
  const stageFiles = (files: FileList | null) => {
    if (busy || !files || files.length === 0) return;
    const staged: PendingMedia[] = [];
    const rejected: string[] = [];
    for (const file of Array.from(files)) {
      const check = inspectUploadCandidate(file);
      if (!check.ok) {
        rejected.push(check.reason);
        continue;
      }
      stagedCounter.current += 1;
      staged.push({
        pending: true,
        id: `${PENDING_ID_PREFIX}${stagedCounter.current}`,
        kind: check.kind,
        filename: file.name,
        caption: null,
        uploadMimeType: check.uploadMimeType,
        size: file.size,
        file,
        previewUrl: check.kind === 'image' ? URL.createObjectURL(file) : null,
      });
    }

    if (staged.length > 0) {
      setMedia((current) => [...current, ...staged]);
      const firstStagedImage = staged.find((item) => item.kind === 'image');
      if (firstStagedImage) setHeroMediaId((current) => current ?? firstStagedImage.id);
      markDirty();
    }

    const notice = staged.length > 0 ? pendingNotice(pendingCount + staged.length) : '';
    const problem =
      rejected.length > 0 ? `Skipped ${rejected.length}: ${rejected.join(' · ')}` : '';
    setStatus([notice, problem].filter(Boolean).join(' — '));
  };

  // 스테이징 파일을 실제 미디어 행으로 승격. 실패 항목은 스테이징으로 남겨 Save 재시도가 가능하다.
  const uploadStaged = async (targetPostId: string, items: MediaItem[]) => {
    const failures: string[] = [];
    const uploadedIds = new Map<string, string>();
    const total = countPendingMedia(items);
    let done = 0;
    let next = items;

    // 한 건 처리 → 실패 이유(문자열) 또는 null. 진행률은 성공·실패와 무관하게 한 칸 나아간다.
    const uploadOne = async (item: PendingMedia, position: number): Promise<string | null> => {
      let payload: Blob = item.file;
      let filename = item.filename;
      if (item.kind === 'image') {
        try {
          payload = (await processImage(item.file)).blob;
          filename = webpFilename(item.filename);
        } catch {
          return `${item.filename}: the photo could not be processed`;
        }
        if (payload.size > UPLOAD_LIMITS.image) {
          return `${item.filename}: still ${formatFileSize(payload.size)} after compression (limit ${formatFileSize(UPLOAD_LIMITS.image)})`;
        }
      }

      const uploadQuery = new URLSearchParams({
        postId: targetPostId,
        filename,
        position: String(position),
      });
      try {
        const result = await requestJson<{ ok: true; media: EditorMedia }>(
          `/api/media?${uploadQuery}`,
          {
            method: 'POST',
            headers: { 'content-type': item.uploadMimeType },
            body: payload,
          },
        );
        next = replacePendingMedia(next, item.id, result.media);
        uploadedIds.set(item.id, result.media.id);
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        return null;
      } catch (error) {
        return `${item.filename}: ${requestErrorMessage(error, 'upload failed')}`;
      }
    };

    for (const [index, item] of items.entries()) {
      if (!isPendingMedia(item)) continue;
      setStatus(`Uploading ${item.filename}…`);
      setProgress({ done, total, filename: item.filename });
      const failure = await uploadOne(item, index);
      if (failure) failures.push(failure);
      done += 1;
      setProgress({ done, total, filename: item.filename });
    }

    return { items: next, failures, uploadedIds };
  };

  const save = async () => {
    if (busy) return;
    if (!title.trim()) {
      setStatus('Please enter a title.');
      return;
    }
    setBusy(true);
    setOutcome(null);
    setProgress({ done: 0, total: pendingCount, filename: null });
    setStatus(pendingCount > 0 ? 'Saving and uploading…' : 'Saving…');
    // tiptap-markdown 확장의 storage 타입은 Tiptap Storage 맵에 등록되지 않아 좁혀서 캐스트.
    const markdownStorage = (editor?.storage as Record<string, unknown> | undefined)?.markdown as
      { getMarkdown(): string } | undefined;
    const body = markdownStorage?.getMarkdown() ?? '';

    try {
      let id = postId;
      let currentRevision = revision;
      const isNewPost = !id;
      if (!id) {
        // 미디어 행은 글이 있어야 만들 수 있다 → 대표 이미지는 업로드 뒤 별도 갱신.
        const created = await requestJson<{ ok: true; post: { id: string; revision: number } }>(
          '/api/posts',
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              title,
              summary,
              eventDate,
              address,
              body,
              heroMediaId: null,
              revision: null,
            }),
          },
        );
        id = created.post.id;
        currentRevision = created.post.revision;
        setPostId(id);
        setRevision(currentRevision);
        // 화면을 버리지 않고 편집 상태로 이어간다 — 업로드에 실패한 파일이 살아 있어야
        // 다시 Save 로 재시도할 수 있다. 주소만 편집 URL 로 맞춘다.
        window.history.replaceState(null, '', `/admin/posts/${id}`);
      }

      const upload = await uploadStaged(id, media);
      setMedia(upload.items);
      if (upload.uploadedIds.size > 0) {
        setOpenCaptions((current) => remapMediaIds(current, upload.uploadedIds));
      }

      const savedIds = new Set(
        upload.items.filter((item) => !isPendingMedia(item)).map((item) => item.id),
      );
      const resolvedHero = heroMediaId
        ? (upload.uploadedIds.get(heroMediaId) ?? heroMediaId)
        : null;
      if (resolvedHero !== heroMediaId) setHeroMediaId(resolvedHero);
      // 아직 업로드되지 않은 대표 후보는 서버에 보낼 수 없다(hero_media_invalid).
      const heroForSave = resolvedHero && savedIds.has(resolvedHero) ? resolvedHero : null;

      // 새 글은 방금 만든 값이 이미 서버에 있다 → 대표 이미지가 정해진 경우에만 다시 쓴다.
      if (!isNewPost || heroForSave) {
        const result = await requestJson<{ ok: true; post?: { id: string; revision: number } }>(
          `/api/posts/${id}`,
          {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              title,
              summary,
              eventDate,
              address,
              body,
              heroMediaId: heroForSave,
              revision: currentRevision,
            }),
          },
        );
        if (result.post) {
          currentRevision = result.post.revision;
          setRevision(currentRevision);
        }
      }

      const metadataResults = await Promise.allSettled(
        upload.items.map((item, position) =>
          isPendingMedia(item)
            ? Promise.resolve(null)
            : requestJson(`/api/media/${item.id}`, {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(mediaMetadataForSave(item, position)),
              }),
        ),
      );
      const failedMetadata = metadataResults.filter(
        (result) => result.status === 'rejected',
      ).length;

      setMedia((current) =>
        current.map((item, position) => (isPendingMedia(item) ? item : { ...item, position })),
      );

      // 부분 실패는 "게시됐지만 문제가 있다"로 남긴다 — 스테이징 파일이 살아 있어 재시도가 된다.
      const problems = [
        ...upload.failures,
        ...(failedMetadata > 0
          ? [
              `${failedMetadata} media ${failedMetadata === 1 ? 'item' : 'items'} kept the previous caption or order`,
            ]
          : []),
      ];
      if (problems.length > 0) {
        const noun = upload.failures.length === 1 ? 'file' : 'files';
        setOutcome({ kind: 'partial', at: new Date(), failures: problems });
        dirtyRef.current = false;
        setDirty(false);
        setStatus(
          upload.failures.length > 0
            ? `Post saved, but ${upload.failures.length} ${noun} could not be uploaded. Retry Save. ${upload.failures.join(' · ')}`
            : `Post saved, but ${problems.join(' · ')}. Retry Save.`,
        );
        return;
      }

      setOutcome({
        kind: 'published',
        at: new Date(),
        uploaded: upload.uploadedIds.size,
      });
      dirtyRef.current = false;
      setDirty(false);
      setStatus('Saved ✓');
    } catch (error) {
      const message = requestErrorMessage(error, 'Save failed. Try again.');
      setOutcome({ kind: 'failed', message });
      setStatus(message);
    } finally {
      setBusy(false);
    }
  };

  const removeMedia = async (id: string) => {
    if (busy) return;
    const item = media.find((candidate) => candidate.id === id);
    if (!item) return;
    const label = item.filename ?? 'this file';

    // 스테이징 항목은 서버에 아무것도 없다 — 목록에서 빼고 미리보기 URL만 회수한다.
    if (isPendingMedia(item)) {
      if (!window.confirm(`Remove ${label}? It has not been uploaded yet.`)) return;
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      setMedia((current) => current.filter((candidate) => candidate.id !== id));
      setHeroMediaId((current) => (current === id ? null : current));
      setStatus(`${label} removed before upload.`);
      markDirty();
      queueMicrotask(() => mediaManagerRef.current?.focus());
      return;
    }

    if (!window.confirm(`Delete ${label}? This permanently removes the file and cannot be undone.`))
      return;
    setBusy(true);
    setStatus('Deleting media…');
    try {
      await requestJson(`/api/media/${id}`, { method: 'DELETE' });
      setMedia((current) => current.filter((candidate) => candidate.id !== id));
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
    markDirty();
  };

  const moveMediaWithinGroup = (id: string, offset: -1 | 1) => {
    setMedia((current) => moveWithinGroup(current, id, offset));
    markDirty();
  };

  // 필드 변경은 모두 "공개본과 다르다"는 신호를 남긴다 — 게시 상태 바가 이걸 읽는다.
  const editField = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    markDirty();
  };

  const chooseHero = (id: string) => {
    setHeroMediaId(id);
    markDirty();
  };

  const deletePost = async () => {
    if (busy || !postId || !window.confirm('Delete this post? (It will be hidden, not erased.)'))
      return;
    setBusy(true);
    setStatus('Deleting post…');
    try {
      await requestJson(`/api/posts/${postId}`, { method: 'DELETE' });
      // 의도한 이탈이므로 이탈 경고를 끈다.
      dirtyRef.current = false;
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

  // 저장하지 않은 변경이 있으면 탭을 닫기 전에 붙잡는다(공개본과 화면이 다른 상태).
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const phase = publishPhase({ hasPost: Boolean(postId), dirty, busy, outcome });
  const publicUrl =
    postId && publicHref ? (siteOrigin ? `${siteOrigin}${publicHref}` : publicHref) : null;
  const savedAt = outcome && outcome.kind !== 'failed' ? outcome.at : null;

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
          isExisting={Boolean(postId)}
          onTitleChange={editField(setTitle)}
          onSummaryChange={editField(setSummary)}
          onEventDateChange={editField(setEventDate)}
          onAddressChange={editField(setAddress)}
        />

        <BodyEditor editor={editor} />

        <MediaManager
          hasPost={Boolean(postId)}
          busy={busy}
          dragging={dragging}
          pendingCount={pendingCount}
          imageMedia={imageMedia}
          fileMedia={fileMedia}
          openCaptions={openCaptions}
          heroMediaId={heroMediaId}
          managerRef={mediaManagerRef}
          onDraggingChange={setDragging}
          onPickFiles={stageFiles}
          onSetHero={chooseHero}
          onToggleCaption={toggleCaption}
          onCaptionChange={updateCaption}
          onMove={moveMediaWithinGroup}
          onRemove={(id) => void removeMedia(id)}
        />

        {/* 상세 상태는 화면에서 게시 상태 바가 보여주고, 보조기술에는 라이브 리전이 읽어준다. */}
        <span role="status" aria-live="polite" className="sr-only">
          {status}
        </span>

        <PublishBar
          mode={postId ? 'save' : 'create'}
          phase={phase}
          busy={busy}
          outcome={outcome}
          savedAtLabel={savedAt ? formatClockTime(savedAt) : null}
          revision={revision}
          publicUrl={publicUrl}
          publicUrlLabel={publicUrl ? displayUrl(publicUrl) : null}
          ordinalLabel={ordinalLabel}
          eventDate={eventDate}
          attachments={attachmentSummary(media)}
          missing={missingReadinessLabels(readiness)}
          progress={progress}
          hasPost={Boolean(postId)}
          onSave={save}
          onDelete={deletePost}
        />
      </div>

      <ReadinessAside readiness={readiness} hasPost={Boolean(postId)} publicHref={publicHref} />
    </div>
  );
}
