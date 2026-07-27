// 글 메타데이터 입력 필드 + 공개 URL 미리보기. 상태는 컨테이너(PostEditor)가 소유하고
// 이 컴포넌트는 값·콜백만 받는다(제어 컴포넌트 의미론 불변).
import { POST_LIMITS } from '../../lib/posts/payload';
import { field, labelText } from './classnames';

interface Props {
  title: string;
  summary: string;
  eventDate: string;
  address: string;
  eventDateLocked: boolean;
  publicHref: string | null;
  ordinalLabel: string;
  isExisting: boolean;
  onTitleChange: (value: string) => void;
  onSummaryChange: (value: string) => void;
  onEventDateChange: (value: string) => void;
  onAddressChange: (value: string) => void;
}

export default function PostFields({
  title,
  summary,
  eventDate,
  address,
  eventDateLocked,
  publicHref,
  ordinalLabel,
  isExisting,
  onTitleChange,
  onSummaryChange,
  onEventDateChange,
  onAddressChange,
}: Readonly<Props>) {
  return (
    <>
      <div>
        <label htmlFor="post-title" className={labelText}>
          Seminar title / featured presentation
        </label>
        <input
          id="post-title"
          className={field}
          maxLength={POST_LIMITS.title}
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
        />
        <p className="mt-1 text-caption text-body-muted">
          The seminar number and public heading are generated from the event date.
        </p>
      </div>
      <div>
        <label htmlFor="post-summary" className={labelText}>
          Summary (optional)
        </label>
        <input
          id="post-summary"
          className={field}
          maxLength={POST_LIMITS.summary}
          value={summary ?? ''}
          onChange={(e) => onSummaryChange(e.target.value)}
        />
        <p className="mt-1 text-caption text-body-muted">
          Displayed as the lead paragraph on the public page.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="post-event-date" className={labelText}>
            Event date
          </label>
          <input
            id="post-event-date"
            type="date"
            className={`${field} disabled:cursor-not-allowed disabled:bg-canvas-band disabled:text-body-muted`}
            value={eventDate ?? ''}
            onChange={(e) => onEventDateChange(e.target.value)}
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
          <label htmlFor="post-address" className={labelText}>
            Location
          </label>
          <input
            id="post-address"
            className={field}
            maxLength={POST_LIMITS.address}
            value={address ?? ''}
            onChange={(e) => onAddressChange(e.target.value)}
          />
          <p className="mt-1 text-caption text-body-muted">
            Used as one complete location and for the map link.
          </p>
        </div>
      </div>

      <div className="border-y border-hairline-strong bg-canvas-soft px-4 py-4">
        <p className="text-caption font-bold uppercase text-accent">Public seminar identity</p>
        {publicHref ? (
          <>
            <p className="mt-2 font-serif text-body-serif font-semibold text-ink">{ordinalLabel}</p>
            {isExisting ? (
              <a
                href={publicHref}
                className="mt-1 inline-flex min-h-[44px] items-center font-mono text-caption font-bold text-link underline"
              >
                {publicHref}
              </a>
            ) : (
              <code className="mt-2 block font-mono text-caption font-bold text-body-muted">
                {publicHref}
              </code>
            )}
          </>
        ) : (
          <p className="mt-2 text-body-sm text-body-muted">
            Select an event date to preview the public URL.
          </p>
        )}
      </div>
    </>
  );
}
