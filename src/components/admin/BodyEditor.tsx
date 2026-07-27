// Tiptap 본문 편집 영역(툴바 + 콘텐츠). editor 인스턴스는 컨테이너가 소유한다 —
// save()가 tiptap-markdown storage에서 마크다운을 직접 읽는 계약을 바꾸지 않기 위함.
import { EditorContent, type Editor } from '@tiptap/react';
import { labelText } from './classnames';

interface Props {
  editor: Editor | null;
}

function toolbarButton(label: string, active: boolean, onClick: () => void) {
  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      aria-pressed={active}
      className={`px-2 py-1 text-caption font-bold ${active ? 'bg-ink text-on-primary' : 'text-ink hover:bg-canvas-soft'}`}
    >
      {label}
    </button>
  );
}

export default function BodyEditor({ editor }: Readonly<Props>) {
  return (
    <div>
      <p id="post-body-label" className={labelText}>
        Body
      </p>
      <div className="border border-hairline-strong bg-canvas">
        <div
          role="toolbar"
          aria-labelledby="post-body-label"
          className="flex flex-wrap gap-1 border-b border-hairline bg-canvas-soft px-2 py-1.5"
        >
          {toolbarButton('B', editor?.isActive('bold') ?? false, () =>
            editor?.chain().focus().toggleBold().run(),
          )}
          {toolbarButton('I', editor?.isActive('italic') ?? false, () =>
            editor?.chain().focus().toggleItalic().run(),
          )}
          {toolbarButton('H2', editor?.isActive('heading', { level: 2 }) ?? false, () =>
            editor?.chain().focus().toggleHeading({ level: 2 }).run(),
          )}
          {toolbarButton('H3', editor?.isActive('heading', { level: 3 }) ?? false, () =>
            editor?.chain().focus().toggleHeading({ level: 3 }).run(),
          )}
          {toolbarButton('• List', editor?.isActive('bulletList') ?? false, () =>
            editor?.chain().focus().toggleBulletList().run(),
          )}
          {toolbarButton('1. List', editor?.isActive('orderedList') ?? false, () =>
            editor?.chain().focus().toggleOrderedList().run(),
          )}
          {toolbarButton('Quote', editor?.isActive('blockquote') ?? false, () =>
            editor?.chain().focus().toggleBlockquote().run(),
          )}
          {toolbarButton('Link', editor?.isActive('link') ?? false, () => {
            const url = window.prompt('Link URL (https://…)');
            if (url) editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
            else editor?.chain().focus().unsetLink().run();
          })}
        </div>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
