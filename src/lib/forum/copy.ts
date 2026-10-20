import type { ForumBoard } from '../auth/permissions';

// Single English source for the authenticated forum, alongside the site's English UI dictionary.
export const forumCopy = {
  title: (board: ForumBoard) => (board === 'directors' ? 'Directors Forum' : 'Assembly Forum'),
  description: (board: ForumBoard) =>
    board === 'directors'
      ? 'Internal discussions and records for directors and authorised members.'
      : 'Discussions and records for TCN members and associate members.',
  newPost: 'Write a post',
  empty: 'No posts yet. Start a discussion or share a record with this forum.',
  titleLabel: 'Title',
  bodyLabel: 'Body',
  textHelp: 'Plain text only. Line breaks are preserved; HTML and Markdown are displayed as text.',
  titleHelp: '1–120 characters.',
  bodyHelp: '1–10,000 characters.',
  create: 'Publish post',
  edit: 'Edit post',
  save: 'Save changes',
  hide: 'Hide post',
  hiding: 'Hiding…',
  saving: 'Saving…',
  hideConfirm:
    'Hide this post from the forum? It will no longer appear in the list or open from its link.',
  back: 'Back to forum',
  cancel: 'Cancel',
  member: 'Member',
  loadError: 'The forum could not be loaded. Please try again.',
  latest: 'View latest version',
} as const;
