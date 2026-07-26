import Link from '@tiptap/extension-link';
import StarterKit from '@tiptap/starter-kit';
import { EditorContent, useEditor } from '@tiptap/react';
import { Markdown } from 'tiptap-markdown';
import { useState } from 'react';
import { processImage } from '../../lib/media/process-image';
import { seminarHref } from '../../lib/seminar-url';
import { formatSeminarOrdinalLabel } from '../../lib/seminars';

export interface EditorMedia {
  id: string;
  r2Key: string;
  kind: 'image' | 'video' | 'document';
  mimeType: string | null;
  filename: string | null;
  width: number | null;
  height: number | null;
}

export interface EditorPost {
  id: string;
  title: string;
  summary: string | null;
  eventDate: string | null;
  address: string | null;
  body: string;
  heroMediaId: string | null;
}

interface Props {
  post?: EditorPost | null;
  media?: EditorMedia[];
  seminarSequence?: number;
}

const field =
  'w-full border border-hairline-strong bg-canvas px-3 py-2 text-body-sm text-ink focus:border-accent focus:outline-none';
const labelText = 'mb-1 block text-caption font-bold text-body-muted';

const saveErrors: Record<string, string> = {
  event_date_required: 'Please select the seminar date.',
  event_date_invalid: 'Please select a valid calendar date.',
  event_date_conflict: 'Another seminar already uses this date.',
  event_date_must_follow_latest: 'A new seminar date must be later than the latest seminar.',
  event_date_immutable: 'The event date is locked because it determines the public URL and seminar sequence.',
};

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
  const [media, setMedia] = useState<EditorMedia[]>(initialMedia);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [dragging, setDragging] = useState(false);
  const eventDateLocked = Boolean(post?.eventDate);
  const publicHref = seminarHref(eventDate);
  const ordinalLabel = formatSeminarOrdinalLabel(seminarSequence);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer' } }),
      Markdown.configure({ html: false, transformPastedText: true }),
    ],
    content: post?.body ?? '',
    immediatelyRender: false,
    editorProps: { attributes: { class: 'admin-prose min-h-[16rem] px-3 py-3 focus:outline-none' } },
  });

  const save = async () => {
    if (!title.trim()) {
      setStatus('Please enter a title.');
      return;
    }
    setBusy(true);
    setStatus('Saving…');
    // tiptap-markdown 확장의 storage 타입은 Tiptap Storage 맵에 등록되지 않아 좁혀서 캐스트.
    const markdownStorage = (editor?.storage as Record<string, unknown> | undefined)?.markdown as
      | { getMarkdown(): string }
      | undefined;
    const body = markdownStorage?.getMarkdown() ?? '';
    const payload = { title, summary, eventDate, address, body, heroMediaId };
    const response = await fetch(post ? `/api/posts/${post.id}` : '/api/posts', {
      method: post ? 'PUT' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as { ok: boolean; post?: { id: string }; error?: string };
    setBusy(false);
    if (!response.ok || !result.ok) {
      setStatus(saveErrors[result.error ?? ''] ?? `Save failed: ${result.error ?? response.status}`);
      return;
    }
    if (!post && result.post) {
      // 새 글은 저장 후 편집 화면으로 이동 → 미디어 첨부 가능
      window.location.href = `/admin/posts/${result.post.id}`;
      return;
    }
    setStatus('Saved ✓');
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!post || !files || files.length === 0) return;
    setBusy(true);
    for (const file of Array.from(files)) {
      setStatus(`Uploading: ${file.name}`);
      let uploadFile = file;
      if (file.type.startsWith('image/')) {
        try {
          const processed = await processImage(file);
          const name = file.name.replace(/\.[^.]+$/, '') + '.webp';
          uploadFile = new File([processed.blob], name, { type: 'image/webp' });
        } catch {
          setStatus(`Image processing failed: ${file.name}`);
          continue;
        }
      }
      const form = new FormData();
      form.append('postId', post.id);
      form.append('file', uploadFile);
      const response = await fetch('/api/media', { method: 'POST', body: form });
      const result = (await response.json()) as { ok: boolean; media?: EditorMedia; error?: string };
      if (response.ok && result.media) {
        const added = result.media;
        setMedia((current) => [...current, added]);
        setHeroMediaId((current) => current ?? (added.kind === 'image' ? added.id : current));
      } else {
        setStatus(`Upload failed (${file.name}): ${result.error ?? response.status}`);
      }
    }
    setBusy(false);
    setStatus('Upload complete ✓');
  };

  const removeMedia = async (id: string) => {
    await fetch(`/api/media/${id}`, { method: 'DELETE' });
    setMedia((current) => current.filter((item) => item.id !== id));
    setHeroMediaId((current) => (current === id ? null : current));
  };

  const deletePost = async () => {
    if (!post || !window.confirm('Delete this post? (It will be hidden, not erased.)')) return;
    await fetch(`/api/posts/${post.id}`, { method: 'DELETE' });
    window.location.href = '/admin';
  };

  const toolbarButton = (label: string, active: boolean, onClick: () => void) => (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`px-2 py-1 text-caption font-bold ${active ? 'bg-ink text-on-primary' : 'text-ink hover:bg-canvas-soft'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="post-title" className={labelText}>Title</label>
        <input id="post-title" className={field} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label htmlFor="post-summary" className={labelText}>Summary (optional)</label>
        <input id="post-summary" className={field} value={summary ?? ''} onChange={(e) => setSummary(e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="post-event-date" className={labelText}>Event date</label>
          <input
            id="post-event-date"
            type="date"
            className={`${field} disabled:cursor-not-allowed disabled:bg-canvas-band disabled:text-body-muted`}
            value={eventDate ?? ''}
            onChange={(e) => setEventDate(e.target.value)}
            disabled={eventDateLocked}
            aria-describedby="event-date-help"
          />
          <p id="event-date-help" className="mt-1 text-caption text-body-muted">
            {eventDateLocked
              ? 'Locked after creation because the date determines the sequence and public URL.'
              : 'New seminars must use a date later than the latest seminar.'}
          </p>
        </div>
        <div>
          <label htmlFor="post-address" className={labelText}>Address</label>
          <input id="post-address" className={field} value={address ?? ''} onChange={(e) => setAddress(e.target.value)} />
        </div>
      </div>

      <div className="border-y border-hairline-strong bg-canvas-soft px-4 py-4">
        <p className="text-caption font-bold uppercase text-accent">Public seminar identity</p>
        {publicHref ? (
          <>
            <p className="mt-2 font-serif text-body-serif font-semibold text-ink">{ordinalLabel}</p>
            {post ? (
              <a href={publicHref} className="mt-1 inline-flex min-h-[44px] items-center font-mono text-caption font-bold text-link underline">
                {publicHref}
              </a>
            ) : (
              <code className="mt-2 block font-mono text-caption font-bold text-body-muted">{publicHref}</code>
            )}
          </>
        ) : (
          <p className="mt-2 text-body-sm text-body-muted">Select an event date to preview the public URL.</p>
        )}
      </div>

      <div>
        <p className={labelText}>Body</p>
        <div className="border border-hairline-strong bg-canvas">
          <div className="flex flex-wrap gap-1 border-b border-hairline bg-canvas-soft px-2 py-1.5">
            {toolbarButton('B', editor?.isActive('bold') ?? false, () => editor?.chain().focus().toggleBold().run())}
            {toolbarButton('I', editor?.isActive('italic') ?? false, () => editor?.chain().focus().toggleItalic().run())}
            {toolbarButton('H2', editor?.isActive('heading', { level: 2 }) ?? false, () => editor?.chain().focus().toggleHeading({ level: 2 }).run())}
            {toolbarButton('H3', editor?.isActive('heading', { level: 3 }) ?? false, () => editor?.chain().focus().toggleHeading({ level: 3 }).run())}
            {toolbarButton('• List', editor?.isActive('bulletList') ?? false, () => editor?.chain().focus().toggleBulletList().run())}
            {toolbarButton('1. List', editor?.isActive('orderedList') ?? false, () => editor?.chain().focus().toggleOrderedList().run())}
            {toolbarButton('Quote', editor?.isActive('blockquote') ?? false, () => editor?.chain().focus().toggleBlockquote().run())}
            {toolbarButton('Link', editor?.isActive('link') ?? false, () => {
              const url = window.prompt('Link URL (https://…)');
              if (url) editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
              else editor?.chain().focus().unsetLink().run();
            })}
          </div>
          <EditorContent editor={editor} />
        </div>
      </div>

      <div>
        <p className={labelText}>Media (photos, video, documents)</p>
        {!post ? (
          <p className="text-caption text-body-muted">Save the post first to attach media.</p>
        ) : (
          <>
            <div
              data-dropzone
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={(e) => {
                // 자식 요소로 이동할 때 발생하는 leave는 무시
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                void uploadFiles(e.dataTransfer.files);
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
                accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                onChange={(e) => uploadFiles(e.target.files)}
                className="mx-auto mt-2 block text-caption text-body-muted"
              />
            </div>
            {media.length > 0 && (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {media.map((item) => (
                  <li key={item.id} className="border border-hairline p-2">
                    {item.kind === 'image' ? (
                      <img src={`/media/${item.r2Key}`} alt="" className="aspect-square w-full bg-canvas-band object-cover" />
                    ) : (
                      <div className="flex aspect-square w-full items-center justify-center bg-canvas-band text-caption text-body-muted">
                        {item.kind === 'video' ? '🎬 Video' : '📄 Document'}
                      </div>
                    )}
                    <p className="mt-1 truncate text-caption text-body-muted">{item.filename}</p>
                    <div className="mt-1 flex items-center justify-between text-caption">
                      {item.kind === 'image' ? (
                        <button
                          type="button"
                          onClick={() => setHeroMediaId(item.id)}
                          className={`font-bold ${heroMediaId === item.id ? 'text-accent' : 'text-link'}`}
                        >
                          {heroMediaId === item.id ? '★ Cover' : 'Set as cover'}
                        </button>
                      ) : (
                        <span />
                      )}
                      <button type="button" onClick={() => removeMedia(item.id)} className="font-bold text-accent">
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-caption text-body-muted">Cover image changes take effect after saving.</p>
          </>
        )}
      </div>

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
          <button type="button" onClick={deletePost} disabled={busy} className="text-caption font-bold text-accent underline">
            Delete
          </button>
        )}
        <span className="text-caption text-body-muted">{status}</span>
      </div>
    </div>
  );
}
