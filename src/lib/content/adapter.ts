import fallbackJson from '../../data/seminars.json';
import fallbackHistoryJson from '../../data/history.json';

import { parseBodyDocument } from './schema';
import type {
  BodyDocument,
  ContentLocale,
  PostKind,
  PublicContentSnapshot,
  PublicHistoryEntry,
  PublicPost,
  PublicSeminar,
  PublicUrlAlias,
  SeminarEventStatus,
  SeminarTemporalStatus,
} from './types';

export interface LegacySeminarRow {
  id: string;
  slug: string;
  lang: ContentLocale;
  title: string;
  date: string;
  status: 'upcoming' | 'past';
  location: string;
  venue?: string;
  mapUrl?: string;
  speaker?: string;
  affiliation?: string;
  theme?: string;
  summary?: string;
  abstract?: string;
  program?: string[];
  speakers?: string[];
  materials?: Array<{ label: string; url: string }>;
  outcomes?: string[];
  photos?: Array<{ src: string; alt: string; caption?: string }>;
  tags?: string[];
}

export interface LoadPublicContentOptions {
  supabaseUrl?: string;
  supabaseKey?: string;
  fetcher?: typeof fetch;
  fallbackRows?: LegacySeminarRow[];
  fallbackHistoryRows?: LegacyHistoryRow[];
  allowConfiguredFallback?: boolean;
  now?: Date;
}

export interface LegacyHistoryRow {
  id: string;
  lang: ContentLocale;
  date: string;
  kind: 'founding' | 'seminar';
  status: SeminarTemporalStatus;
  title: string;
  location: string;
  participants: string[];
  description: string;
}

export type ContentEnvironment = Record<string, string | undefined>;

const PUBLIC_TRANSLATIONS = new Set(['source', 'human_reviewed']);
const LOCALES = new Set<ContentLocale>(['ko', 'en']);
const EVENT_STATUSES = new Set<SeminarEventStatus>([
  'scheduled',
  'completed',
  'postponed',
  'cancelled',
]);
const POST_KINDS = new Set<PostKind>([
  'announcement',
  'invitation',
  'report',
  'activity',
  'materials',
  'news',
]);
const publicSnapshotCache = new Map<string, Promise<PublicContentSnapshot>>();

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function asArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  return value;
}

function asString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} must be a non-empty string`);
  return value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function optionalRecord(value: unknown, label: string): Record<string, unknown> {
  return value === undefined || value === null ? {} : asRecord(value, label);
}

function optionalStringArray(value: unknown, label: string): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  return asArray(value, label).map((item, index) => asString(item, `${label}[${index}]`));
}

function safePublicUrl(value: unknown, label: string): string {
  const url = asString(value, label);
  if (url.startsWith('/') || url.startsWith('#')) return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return url;
  } catch {
    // Use the shared error below for malformed and unsafe URLs.
  }
  throw new TypeError(`${label} must be an http(s), root-relative, or fragment URL`);
}

function optionalMaterials(value: unknown, label: string): Array<{ label: string; url: string }> | undefined {
  if (value === undefined || value === null) return undefined;
  return asArray(value, label).map((item, index) => {
    const row = asRecord(item, `${label}[${index}]`);
    return {
      label: asString(row.label, `${label}[${index}].label`),
      url: safePublicUrl(row.url, `${label}[${index}].url`),
    };
  });
}

function optionalPhotos(
  value: unknown,
  label: string,
): Array<{ src: string; alt: string; caption?: string }> | undefined {
  if (value === undefined || value === null) return undefined;
  return asArray(value, label).map((item, index) => {
    const row = asRecord(item, `${label}[${index}]`);
    return {
      src: safePublicUrl(row.src, `${label}[${index}].src`),
      alt: asString(row.alt, `${label}[${index}].alt`),
      ...(optionalString(row.caption) ? { caption: optionalString(row.caption) } : {}),
    };
  });
}

function asPositiveInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive integer`);
  }
  return value;
}

function asLocale(value: unknown, label: string): ContentLocale {
  if (typeof value !== 'string' || !LOCALES.has(value as ContentLocale)) {
    throw new TypeError(`${label} must be ko or en`);
  }
  return value as ContentLocale;
}

function temporalStatus(
  eventStatus: SeminarEventStatus,
  startsAt: string,
  now: Date,
): SeminarTemporalStatus {
  if (eventStatus === 'completed') return 'past';
  const startsAtTime = new Date(startsAt).getTime();
  if (!Number.isFinite(startsAtTime)) throw new TypeError('starts_at must be a valid ISO date');
  return startsAtTime < now.getTime() ? 'past' : 'upcoming';
}

export function googleMapsSearchUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function mapHistory(
  seminars: PublicSeminar[],
  rows: LegacyHistoryRow[],
): PublicHistoryEntry[] {
  const founding = rows
    .filter((row) => row.kind === 'founding')
    .map<PublicHistoryEntry>((row) => ({
      id: row.id,
      locale: row.lang,
      date: row.date,
      kind: 'founding',
      status: row.status,
      title: row.title,
      location: row.location,
      participants: row.participants,
      description: row.description,
    }));
  const seminarEntries = seminars.map<PublicHistoryEntry>((seminar) => {
    const legacy = rows.find((row) =>
      row.kind === 'seminar'
      && row.lang === seminar.locale
      && row.date.slice(0, 10) === seminar.startsAt.slice(0, 10));
    return {
      id: `seminar-${seminar.id}-${seminar.locale}`,
      locale: seminar.locale,
      date: seminar.startsAt,
      kind: 'seminar',
      status: seminar.temporalStatus,
      title: seminar.title,
      location: seminar.address
        ? `${seminar.placeName}, ${seminar.address}`
        : seminar.placeName,
      participants: legacy?.participants ?? [],
      description:
        seminar.summary
        ?? seminar.abstract
        ?? legacy?.description
        ?? (seminar.locale === 'ko' ? '국제 세미나입니다.' : 'An international seminar.'),
      seminarSequence: seminar.sequence,
    };
  });
  return [...founding, ...seminarEntries]
    .sort((a, b) => a.date.localeCompare(b.date) || a.locale.localeCompare(b.locale));
}

function fallbackSnapshot(
  rows: LegacySeminarRow[],
  historyRows: LegacyHistoryRow[],
): PublicContentSnapshot {
  const orderedSeminars = [...new Map(
    [...rows]
      .sort((a, b) => a.date.localeCompare(b.date) || a.slug.localeCompare(b.slug))
      .map((row) => [row.slug, row]),
  ).values()];
  const sequenceBySlug = new Map(orderedSeminars.map((row, index) => [row.slug, index + 1]));

  const seminars = rows
    .map<PublicSeminar>((row) => ({
      id: row.id,
      sequence: sequenceBySlug.get(row.slug)!,
      locale: row.lang,
      legacySlug: row.slug,
      title: row.title,
      startsAt: row.date,
      eventStatus: row.status === 'past' ? 'completed' : 'scheduled',
      temporalStatus: row.status,
      placeName: row.location,
      ...(row.venue ? { address: row.venue } : {}),
      ...(row.mapUrl ? { mapUrl: row.mapUrl } : {}),
      ...(row.summary ? { summary: row.summary } : {}),
      ...(row.abstract ? { abstract: row.abstract } : {}),
      ...(row.theme ? { theme: row.theme } : {}),
      ...(row.speaker ? { speaker: row.speaker } : {}),
      ...(row.affiliation ? { affiliation: row.affiliation } : {}),
      ...(row.program ? { program: row.program } : {}),
      ...(row.speakers ? { speakers: row.speakers } : {}),
      ...(row.materials ? { materials: row.materials } : {}),
      ...(row.outcomes ? { outcomes: row.outcomes } : {}),
      ...(row.photos ? { photos: row.photos } : {}),
      ...(row.tags ? { tags: row.tags } : {}),
    }))
    .sort((a, b) => a.sequence - b.sequence);

  return { source: 'json', seminars, posts: [], aliases: [], history: mapHistory(seminars, historyRows) };
}

function localizationRows(row: Record<string, unknown>, primary: string, fallback: string): unknown[] {
  const value = row[primary] ?? row[fallback] ?? [];
  return asArray(value, primary);
}

function mapSeminars(payload: unknown, now: Date): PublicSeminar[] {
  const seminars: PublicSeminar[] = [];
  for (const [index, value] of asArray(payload, 'seminars').entries()) {
    const row = asRecord(value, `seminars[${index}]`);
    const id = asString(row.id, `seminars[${index}].id`);
    const sequence = asPositiveInteger(row.sequence, `seminars[${index}].sequence`);
    const startsAt = asString(row.starts_at, `seminars[${index}].starts_at`);
    if (typeof row.event_status !== 'string' || !EVENT_STATUSES.has(row.event_status as SeminarEventStatus)) {
      throw new TypeError(`seminars[${index}].event_status is invalid`);
    }
    const eventStatus = row.event_status as SeminarEventStatus;
    const basePlaceName = optionalString(row.place_name);
    const baseAddress = optionalString(row.address);

    for (const [localizationIndex, localizationValue] of localizationRows(
      row,
      'seminar_localizations',
      'localizations',
    ).entries()) {
      const localization = asRecord(
        localizationValue,
        `seminars[${index}].seminar_localizations[${localizationIndex}]`,
      );
      const locale = asLocale(localization.locale, 'seminar localization locale');
      const address = optionalString(localization.address) ?? baseAddress;
      const legacyContent = optionalRecord(localization.content, 'seminar localization content');
      const legacyMapUrl = legacyContent.mapUrl === undefined
        ? undefined
        : safePublicUrl(legacyContent.mapUrl, 'seminar localization content.mapUrl');
      const program = optionalStringArray(legacyContent.program, 'seminar localization content.program');
      const speakers = optionalStringArray(legacyContent.speakers, 'seminar localization content.speakers');
      const outcomes = optionalStringArray(legacyContent.outcomes, 'seminar localization content.outcomes');
      const tags = optionalStringArray(legacyContent.tags, 'seminar localization content.tags');
      const materials = optionalMaterials(legacyContent.materials, 'seminar localization content.materials');
      const photos = optionalPhotos(legacyContent.photos, 'seminar localization content.photos');
      seminars.push({
        id,
        sequence,
        locale,
        ...(optionalString(row.legacy_slug) ? { legacySlug: optionalString(row.legacy_slug) } : {}),
        title: asString(localization.title, 'seminar localization title'),
        startsAt,
        ...(optionalString(row.ends_at) ? { endsAt: optionalString(row.ends_at) } : {}),
        ...(optionalString(row.timezone) ? { timezone: optionalString(row.timezone) } : {}),
        eventStatus,
        temporalStatus: temporalStatus(eventStatus, startsAt, now),
        placeName:
          optionalString(localization.place_name)
          ?? basePlaceName
          ?? address
          ?? (locale === 'ko' ? '장소 추후 안내' : 'Venue to be announced'),
        ...(address ? { address } : {}),
        ...(legacyMapUrl ? { mapUrl: legacyMapUrl } : address ? { mapUrl: googleMapsSearchUrl(address) } : {}),
        ...(optionalString(localization.summary) ? { summary: optionalString(localization.summary) } : {}),
        ...(optionalString(localization.abstract) ? { abstract: optionalString(localization.abstract) } : {}),
        ...(optionalString(localization.theme) ? { theme: optionalString(localization.theme) } : {}),
        ...(optionalString(legacyContent.speaker) ? { speaker: optionalString(legacyContent.speaker) } : {}),
        ...(optionalString(legacyContent.affiliation) ? { affiliation: optionalString(legacyContent.affiliation) } : {}),
        ...(program ? { program } : {}),
        ...(speakers ? { speakers } : {}),
        ...(materials ? { materials } : {}),
        ...(outcomes ? { outcomes } : {}),
        ...(photos ? { photos } : {}),
        ...(tags ? { tags } : {}),
      });
    }
  }
  return seminars.sort((a, b) => a.sequence - b.sequence || a.locale.localeCompare(b.locale));
}

function relationRecord(value: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(value)) return value.length ? asRecord(value[0], 'seminar relation') : undefined;
  return value === undefined || value === null ? undefined : asRecord(value, 'seminar relation');
}

export function storagePublicUrl(supabaseUrl: string, path: string): string {
  const segments = path.split('/');
  if (segments.length === 0 || segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new TypeError('storage path contains an unsafe segment');
  }
  const objectPath = segments.map((segment) => encodeURIComponent(segment)).join('/');
  return `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/seminar-assets/${objectPath}`;
}

function hydrateStorageUrls(document: BodyDocument, supabaseUrl: string): BodyDocument {
  return {
    ...document,
    content: document.content.map((block) => {
      if (block.type === 'image' && block.attrs.path && !block.attrs.src) {
        return {
          ...block,
          attrs: { ...block.attrs, src: storagePublicUrl(supabaseUrl, block.attrs.path) },
        };
      }
      if (block.type === 'gallery') {
        return {
          ...block,
          attrs: {
            ...block.attrs,
            images: block.attrs.images.map((image) => image.path && !image.src
              ? { ...image, src: storagePublicUrl(supabaseUrl, image.path) }
              : image),
          },
        };
      }
      if (block.type === 'attachments') {
        return {
          ...block,
          attrs: {
            files: block.attrs.files.map((file) => file.path && !file.url
              ? { ...file, url: storagePublicUrl(supabaseUrl, file.path) }
              : file),
          },
        };
      }
      return block;
    }),
  };
}

function mapLegacyHistoryLocalization(
  postId: string,
  seminarSequence: number | undefined,
  locale: ContentLocale,
  title: string,
  excerpt: string | undefined,
  bodyValue: unknown,
): PublicHistoryEntry | undefined {
  const body = asRecord(bodyValue, 'post localization body_json');
  const attrs = optionalRecord(body.attrs, 'post localization body_json.attrs');
  if (attrs.legacyHistory === undefined || attrs.legacyHistory === null) return undefined;
  const legacy = asRecord(attrs.legacyHistory, 'post localization body_json.attrs.legacyHistory');
  if (legacy.kind !== 'founding' && legacy.kind !== 'seminar') {
    throw new TypeError('legacy history kind must be founding or seminar');
  }
  if (legacy.status !== 'past' && legacy.status !== 'upcoming') {
    throw new TypeError('legacy history status must be past or upcoming');
  }
  const participants = optionalStringArray(
    legacy.participants,
    'post localization body_json.attrs.legacyHistory.participants',
  ) ?? [];
  return {
    id: `history-${postId}-${locale}`,
    locale,
    date: asString(legacy.date, 'post localization body_json.attrs.legacyHistory.date'),
    kind: legacy.kind,
    status: legacy.status,
    title,
    location: asString(legacy.location, 'post localization body_json.attrs.legacyHistory.location'),
    participants,
    description: excerpt ?? title,
    ...(seminarSequence ? { seminarSequence } : {}),
  };
}

interface MappedPostContent {
  posts: PublicPost[];
  history: PublicHistoryEntry[];
}

function mapPosts(
  payload: unknown,
  sequenceBySeminarId: Map<string, number>,
  supabaseUrl: string,
): MappedPostContent {
  const posts: PublicPost[] = [];
  const history: PublicHistoryEntry[] = [];
  for (const [index, value] of asArray(payload, 'posts').entries()) {
    const row = asRecord(value, `posts[${index}]`);
    if (row.workflow_status !== 'published') continue;
    if (typeof row.kind !== 'string' || !POST_KINDS.has(row.kind as PostKind)) {
      throw new TypeError(`posts[${index}].kind is invalid`);
    }
    const id = asString(row.id, `posts[${index}].id`);
    const seminarId = optionalString(row.seminar_id);
    const seminarRelation = relationRecord(row.seminars ?? row.seminar);
    const seminarSequence = seminarRelation?.sequence !== undefined
      ? asPositiveInteger(seminarRelation.sequence, `posts[${index}].seminars.sequence`)
      : seminarId ? sequenceBySeminarId.get(seminarId) : undefined;
    if (seminarId && !seminarSequence) throw new TypeError(`posts[${index}] has no seminar sequence`);
    const postNo = asPositiveInteger(row.post_no, `posts[${index}].post_no`);

    const allLocalizations = localizationRows(
      row,
      'post_localizations',
      'localizations',
    );
    const sourceLocalization = allLocalizations.find((value) => {
      const localization = asRecord(value, `posts[${index}].post_localizations.source`);
      return localization.translation_status === 'source';
    });
    // Korean is temporarily a mirrored language path, not a translation workflow.
    // A single source record therefore supplies both public language routes.
    const sourceRecord = sourceLocalization
      ? asRecord(sourceLocalization, 'source localization')
      : undefined;
    const publicLocalizations = sourceRecord
      ? [sourceRecord, { ...sourceRecord, locale: sourceRecord.locale === 'ko' ? 'en' : 'ko' }]
      : allLocalizations;
    for (const [localizationIndex, localizationValue] of publicLocalizations.entries()) {
      const localization = asRecord(
        localizationValue,
        `posts[${index}].post_localizations[${localizationIndex}]`,
      );
      if (typeof localization.translation_status !== 'string'
        || !PUBLIC_TRANSLATIONS.has(localization.translation_status)) continue;
      const locale = asLocale(localization.locale, 'post localization locale');
      const title = asString(localization.title, 'post localization title');
      const excerpt = optionalString(localization.excerpt);
      // Founding material is authored on the declaration page, not in the seminar stream.
      if (!seminarId || !seminarSequence) continue;
      const historyEntry = mapLegacyHistoryLocalization(
        id,
        seminarSequence,
        locale,
        title,
        excerpt,
        localization.body_json,
      );
      if (historyEntry) history.push(historyEntry);
      const heroAssetId = optionalString(row.hero_asset_id);
      const heroAsset = relationRecord(row.hero_asset ?? row.heroAsset);
      const heroReference = Array.isArray(row.post_assets)
        ? row.post_assets
          .map((value, assetIndex) => asRecord(value, `posts[${index}].post_assets[${assetIndex}]`))
          .find((value) => value.role === 'hero' && value.asset_id === heroAssetId)
        : undefined;
      const heroLocalization = heroReference
        ? localizationRows(heroReference, 'post_asset_localizations', 'localizations')
          .map((value, assetLocaleIndex) => asRecord(
            value,
            `posts[${index}].post_assets.hero.post_asset_localizations[${assetLocaleIndex}]`,
          ))
          .find((value) => value.locale === locale)
        : undefined;
      if (heroAssetId && !heroAsset) throw new TypeError(`posts[${index}] is missing its hero asset relation`);
      const heroPath = heroAsset ? asString(heroAsset.storage_path, `posts[${index}].hero_asset.storage_path`) : undefined;
      const heroWidth = heroAsset ? asPositiveInteger(heroAsset.width, `posts[${index}].hero_asset.width`) : undefined;
      const heroHeight = heroAsset ? asPositiveInteger(heroAsset.height, `posts[${index}].hero_asset.height`) : undefined;
      posts.push({
        id,
        seminarId,
        seminarSequence,
        postNo,
        kind: row.kind as PostKind,
        locale,
        title,
        ...(excerpt ? { excerpt } : {}),
        slug: asString(localization.slug, 'post localization slug'),
        body: hydrateStorageUrls(parseBodyDocument(localization.body_json), supabaseUrl),
        ...(heroAssetId && heroPath && heroWidth && heroHeight ? {
          hero: {
            assetId: heroAssetId,
            path: heroPath,
            src: storagePublicUrl(supabaseUrl, heroPath),
            alt: optionalString(heroLocalization?.alt_text) ?? title,
            ...(optionalString(heroLocalization?.caption) ? { caption: optionalString(heroLocalization?.caption) } : {}),
            width: heroWidth,
            height: heroHeight,
            aspectRatio: heroWidth / heroHeight,
          },
        } : {}),
        ...(optionalString(row.published_at) ? { publishedAt: optionalString(row.published_at) } : {}),
        translationStatus: localization.translation_status as 'source' | 'human_reviewed',
      });
    }
  }
  return {
    posts: posts.sort((a, b) => a.seminarSequence - b.seminarSequence || a.postNo - b.postNo),
    history: history.sort((a, b) => a.date.localeCompare(b.date) || a.locale.localeCompare(b.locale)),
  };
}

function mapAliases(payload: unknown): PublicUrlAlias[] {
  return asArray(payload, 'url aliases').map((value, index) => {
    const row = asRecord(value, `url aliases[${index}]`);
    return {
      locale: asLocale(row.locale, `url aliases[${index}].locale`),
      from: asString(
        row.source_path ?? row.old_path ?? row.from_path,
        `url aliases[${index}].source_path`,
      ),
      to: asString(
        row.destination_path ?? row.new_path ?? row.to_path,
        `url aliases[${index}].destination_path`,
      ),
    };
  });
}

function restUrl(baseUrl: string, resource: string, params: Record<string, string>): string {
  const url = new URL(`/rest/v1/${resource}`, baseUrl);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.href;
}

async function fetchJson(fetcher: typeof fetch, url: string, key: string): Promise<unknown> {
  const response = await fetcher(url, {
    headers: {
      Accept: 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
  if (!response.ok) throw new Error(`Public content request failed with ${response.status}`);
  return response.json();
}

async function supabaseSnapshot(
  supabaseUrl: string,
  supabaseKey: string,
  fetcher: typeof fetch,
  now: Date,
): Promise<PublicContentSnapshot> {
  const [seminarPayload, postPayload, aliasPayload] = await Promise.all([
    fetchJson(fetcher, restUrl(supabaseUrl, 'seminars', {
      select: 'id,sequence,starts_at,ends_at,timezone,event_status,place_name,address,legacy_slug,seminar_localizations(*)',
      order: 'sequence.asc',
    }), supabaseKey),
    fetchJson(fetcher, restUrl(supabaseUrl, 'posts', {
      select: 'id,seminar_id,post_no,kind,workflow_status,published_at,hero_asset_id,hero_asset:assets!posts_hero_asset_id_fkey(id,storage_path,original_filename,width,height),post_assets(asset_id,role,post_asset_localizations(locale,alt_text,caption)),seminars(sequence),post_localizations(*)',
      workflow_status: 'eq.published',
      order: 'post_no.asc',
    }), supabaseKey),
    fetchJson(fetcher, restUrl(supabaseUrl, 'aliases', {
      select: 'locale,source_path,destination_path',
      locale: 'in.(ko,en)',
      order: 'source_path.asc',
    }), supabaseKey),
  ]);

  const seminars = mapSeminars(seminarPayload, now);
  const sequenceBySeminarId = new Map(seminars.map((seminar) => [seminar.id, seminar.sequence]));
  const mappedPosts = mapPosts(postPayload, sequenceBySeminarId, supabaseUrl);
  return {
    source: 'supabase',
    seminars,
    posts: mappedPosts.posts,
    aliases: mapAliases(aliasPayload),
    history: mappedPosts.history,
  };
}

export async function loadPublicContent(options: LoadPublicContentOptions = {}): Promise<PublicContentSnapshot> {
  const rows = options.fallbackRows ?? (fallbackJson as LegacySeminarRow[]);
  const historyRows = options.fallbackHistoryRows ?? (fallbackHistoryJson as LegacyHistoryRow[]);
  if (!options.supabaseUrl && !options.supabaseKey) return fallbackSnapshot(rows, historyRows);
  if (!options.supabaseUrl || !options.supabaseKey) {
    throw new Error('Public Supabase content requires both a URL and publishable key');
  }
  const supabaseUrl = options.supabaseUrl;
  const supabaseKey = options.supabaseKey;

  const loadConfigured = () => supabaseSnapshot(
      supabaseUrl,
      supabaseKey,
      options.fetcher ?? globalThis.fetch,
      options.now ?? new Date(),
    );
  if (!options.allowConfiguredFallback) return loadConfigured();
  try {
    return await loadConfigured();
  } catch {
    return fallbackSnapshot(rows, historyRows);
  }
}

export function loadPublicContentFromEnvironment(
  environment: ContentEnvironment,
  options: Omit<LoadPublicContentOptions, 'supabaseUrl' | 'supabaseKey'> = {},
): Promise<PublicContentSnapshot> {
  const supabaseUrl = environment.SUPABASE_URL ?? environment.PUBLIC_SUPABASE_URL;
  const supabaseKey = environment.SUPABASE_PUBLISHABLE_KEY
    ?? environment.PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? environment.SUPABASE_ANON_KEY
    ?? environment.PUBLIC_SUPABASE_ANON_KEY;
  const load = () => loadPublicContent({
    ...options,
    supabaseUrl,
    supabaseKey,
    allowConfiguredFallback: environment.PUBLIC_CONTENT_ALLOW_JSON_FALLBACK === 'true',
  });

  if (Object.keys(options).length > 0 || environment.PUBLIC_CONTENT_DISABLE_CACHE === 'true') return load();
  const cacheKey = [
    supabaseUrl ?? 'json',
    supabaseKey ?? 'unconfigured',
    environment.PUBLIC_CONTENT_ALLOW_JSON_FALLBACK ?? 'false',
  ].join('|');
  const cached = publicSnapshotCache.get(cacheKey);
  if (cached) return cached;

  const pending = load();
  publicSnapshotCache.set(cacheKey, pending);
  void pending.catch(() => {
    if (publicSnapshotCache.get(cacheKey) === pending) publicSnapshotCache.delete(cacheKey);
  });
  return pending;
}
