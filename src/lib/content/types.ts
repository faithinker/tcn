export type ContentLocale = 'ko' | 'en';

export type SeminarEventStatus = 'scheduled' | 'completed' | 'postponed' | 'cancelled';
export type SeminarTemporalStatus = 'upcoming' | 'past';

export type PostKind =
  | 'announcement'
  | 'invitation'
  | 'report'
  | 'activity'
  | 'materials'
  | 'news';

export type PostKindPath =
  | 'announcements'
  | 'invitations'
  | 'reports'
  | 'activities'
  | 'materials'
  | 'news';

export type TranslationStatus = 'source' | 'missing' | 'ai_draft' | 'human_reviewed' | 'stale';

export interface ContentTextMark {
  type: 'bold' | 'italic' | 'link';
  attrs?: { href: string };
}

export interface ContentTextNode {
  type: 'text';
  text: string;
  marks?: ContentTextMark[];
}

export interface ContentHardBreakNode {
  type: 'hardBreak';
}

export type ContentInlineNode = ContentTextNode | ContentHardBreakNode;

export interface ContentParagraphNode {
  type: 'paragraph';
  content?: ContentInlineNode[];
}

export interface ContentHeadingNode {
  type: 'heading';
  attrs: { level: 2 | 3 };
  content?: ContentInlineNode[];
}

export interface ContentBlockquoteNode {
  type: 'blockquote';
  content: ContentParagraphNode[];
}

export interface ContentListItemNode {
  type: 'listItem';
  content: ContentParagraphNode[];
}

export interface ContentListNode {
  type: 'bulletList' | 'orderedList';
  content: ContentListItemNode[];
}

export interface ContentProgrammeNode {
  type: 'programme';
  attrs: {
    items: Array<{ time: string; title: string; description?: string }>;
  };
}

export interface ContentOutcomesNode {
  type: 'outcomes';
  attrs: {
    items: Array<{ title: string; description?: string }>;
  };
}

export type ImageLayout = 'reading' | 'wide' | 'pair';

export interface ContentImage {
  assetId: string;
  path?: string;
  src?: string;
  alt: string;
  caption?: string;
  layout?: ImageLayout;
  width?: number;
  height?: number;
  aspectRatio?: number;
}

export interface ContentImageNode {
  type: 'image';
  attrs: ContentImage;
}

export interface ContentGalleryNode {
  type: 'gallery';
  attrs: { images: ContentImage[]; layout?: ImageLayout };
}

export interface ContentAttachment {
  assetId: string;
  path?: string;
  name: string;
  label?: string;
  mimeType: string;
  size: number;
  url?: string;
}

export interface ContentAttachmentsNode {
  type: 'attachments';
  attrs: { files: ContentAttachment[] };
}

export interface ContentHorizontalRuleNode {
  type: 'horizontalRule';
}

export type ContentBlockNode =
  | ContentParagraphNode
  | ContentHeadingNode
  | ContentBlockquoteNode
  | ContentListNode
  | ContentProgrammeNode
  | ContentOutcomesNode
  | ContentImageNode
  | ContentGalleryNode
  | ContentAttachmentsNode
  | ContentHorizontalRuleNode;

export interface BodyDocument {
  type: 'doc';
  content: ContentBlockNode[];
}

export interface PublicPhoto {
  src: string;
  alt: string;
  caption?: string;
}

export interface PublicMaterial {
  label: string;
  url: string;
}

export interface PublicSeminar {
  id: string;
  sequence: number;
  locale: ContentLocale;
  legacySlug?: string;
  title: string;
  startsAt: string;
  endsAt?: string;
  timezone?: string;
  eventStatus: SeminarEventStatus;
  temporalStatus: SeminarTemporalStatus;
  placeName: string;
  address?: string;
  mapUrl?: string;
  summary?: string;
  abstract?: string;
  theme?: string;
  speaker?: string;
  affiliation?: string;
  program?: string[];
  speakers?: string[];
  materials?: PublicMaterial[];
  outcomes?: string[];
  photos?: PublicPhoto[];
  tags?: string[];
}

export interface PublicPost {
  id: string;
  seminarId: string;
  seminarSequence: number;
  postNo: number;
  kind: PostKind;
  locale: ContentLocale;
  title: string;
  excerpt?: string;
  slug: string;
  body: BodyDocument;
  hero?: ContentImage;
  publishedAt?: string;
  translationStatus: 'source' | 'human_reviewed';
}

export interface PublicHistoryEntry {
  id: string;
  locale: ContentLocale;
  date: string;
  kind: 'founding' | 'seminar';
  status: SeminarTemporalStatus;
  title: string;
  location: string;
  participants: string[];
  description: string;
  seminarSequence?: number;
}

export interface PublicUrlAlias {
  locale: ContentLocale;
  from: string;
  to: string;
}

export interface PublicContentSnapshot {
  source: 'supabase' | 'json';
  seminars: PublicSeminar[];
  posts: PublicPost[];
  aliases: PublicUrlAlias[];
  history: PublicHistoryEntry[];
}
