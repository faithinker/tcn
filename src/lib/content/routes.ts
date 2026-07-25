import type {
  ContentLocale,
  PostKind,
  PostKindPath,
  PublicContentSnapshot,
  PublicPost,
  PublicSeminar,
  PublicUrlAlias,
} from './types';

const KIND_PATHS: Record<PostKind, PostKindPath> = {
  announcement: 'announcements',
  invitation: 'invitations',
  report: 'reports',
  activity: 'activities',
  materials: 'materials',
  news: 'news',
};

const POST_KINDS = Object.entries(KIND_PATHS) as Array<[PostKind, PostKindPath]>;

function positiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0) throw new TypeError(`${label} must be a positive integer`);
  return value;
}

function routeSlug(value: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new TypeError('slug must contain lowercase letters, numbers, and single hyphens only');
  }
  return value;
}

function trimTrailingSlash(path: string): string {
  return path === '/' ? path : path.replace(/\/+$/, '');
}

function withTrailingSlash(path: string): string {
  return path.endsWith('/') ? path : `${path}/`;
}

export function postKindPath(kind: PostKind): PostKindPath {
  return KIND_PATHS[kind];
}

export function postKindFromPath(path: string): PostKind | undefined {
  return POST_KINDS.find(([, segment]) => segment === path)?.[0];
}

export function seminarHubPath(locale: ContentLocale, sequence: number): string {
  return `/${locale}/seminars/${positiveInteger(sequence, 'sequence')}`;
}

export function postPath(
  locale: ContentLocale,
  sequence: number,
  kind: PostKind,
  postNo: number,
  slug: string,
): string {
  // One canonical article per seminar: public URLs expose the human-visible
  // seminar sequence, never a date, region, slug, or internal post number.
  positiveInteger(postNo, 'post number');
  routeSlug(slug);
  postKindPath(kind);
  return `/${locale}/seminars/activities/${positiveInteger(sequence, 'sequence')}`;
}

export interface SeminarRouteEntry {
  params: { sequence: string };
  props: { seminar: PublicSeminar; canonicalPath: string };
}

export interface PostRouteEntry {
  params: { sequence: string; kind: PostKindPath; post: string };
  props: { post: PublicPost; seminar: PublicSeminar; canonicalPath: string };
}

export interface AliasRouteEntry {
  params: { alias: string };
  props: { target: string; status: 301 };
}

export function createSeminarRouteEntries(
  snapshot: PublicContentSnapshot,
  locale: ContentLocale,
): SeminarRouteEntry[] {
  return snapshot.seminars
    .filter((seminar) => seminar.locale === locale)
    .sort((a, b) => a.sequence - b.sequence)
    .map((seminar) => ({
      params: { sequence: String(seminar.sequence) },
      props: { seminar, canonicalPath: seminarHubPath(locale, seminar.sequence) },
    }));
}

export function createPostRouteEntries(
  snapshot: PublicContentSnapshot,
  locale: ContentLocale,
): PostRouteEntry[] {
  const seminars = new Map(
    snapshot.seminars
      .filter((seminar) => seminar.locale === locale)
      .map((seminar) => [seminar.sequence, seminar]),
  );

  return snapshot.posts
    .filter((post) => post.locale === locale && seminars.has(post.seminarSequence))
    .sort((a, b) => a.seminarSequence - b.seminarSequence || a.postNo - b.postNo)
    .map((post) => {
      const seminar = seminars.get(post.seminarSequence)!;
      return {
        params: {
          sequence: String(post.seminarSequence),
          kind: postKindPath(post.kind),
          post: `${post.postNo}-${post.slug}`,
        },
        props: {
          post,
          seminar,
          canonicalPath: postPath(locale, post.seminarSequence, post.kind, post.postNo, post.slug),
        },
      };
    });
}

export function buildCanonicalAliases(snapshot: PublicContentSnapshot): PublicUrlAlias[] {
  const aliases = new Map<string, PublicUrlAlias>();
  for (const alias of snapshot.aliases) {
    const normalized = {
      locale: alias.locale,
      from: trimTrailingSlash(alias.from),
      to: trimTrailingSlash(alias.to),
    };
    if (normalized.from !== normalized.to) aliases.set(normalized.from, normalized);
  }

  for (const seminar of snapshot.seminars) {
    if (!seminar.legacySlug) continue;
    const from = `/${seminar.locale}/seminars/${routeSlug(seminar.legacySlug)}`;
    if (!aliases.has(from)) {
      aliases.set(from, {
        locale: seminar.locale,
        from,
        to: seminarHubPath(seminar.locale, seminar.sequence),
      });
    }
  }

  return [...aliases.values()].sort((a, b) => a.from.localeCompare(b.from));
}

export function createAliasRouteEntries(
  snapshot: PublicContentSnapshot,
  locale: ContentLocale,
): AliasRouteEntry[] {
  const prefix = `/${locale}/seminars/`;
  return buildCanonicalAliases(snapshot)
    .filter((alias) => alias.locale === locale && alias.from.startsWith(prefix))
    .map((alias) => ({
      params: { alias: alias.from.slice(prefix.length) },
      props: { target: withTrailingSlash(alias.to), status: 301 as const },
    }));
}

export function createSitemapPaths(snapshot: PublicContentSnapshot): string[] {
  const staticPaths = [
    '/',
    '/about/',
    '/about/founding/',
    '/about/declaration/',
    '/about/bylaws/',
    '/people/',
    '/seminars/',
    '/contact/',
  ];
  const paths = (['ko', 'en'] as const).flatMap((locale) => [
    ...staticPaths.map((path) => path === '/' ? `/${locale}/` : `/${locale}${path}`),
    ...createSeminarRouteEntries(snapshot, locale)
      .map((entry) => withTrailingSlash(entry.props.canonicalPath)),
    ...createPostRouteEntries(snapshot, locale)
      .map((entry) => withTrailingSlash(entry.props.canonicalPath)),
  ]);
  return [...new Set(paths)];
}
