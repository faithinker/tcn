import { readinessPercent, type ReadinessItem } from './readiness';

interface Props {
  readiness: ReadinessItem[];
  hasPost: boolean;
  publicHref: string | null;
}

export default function ReadinessAside({ readiness, hasPost, publicHref }: Readonly<Props>) {
  return (
    <aside className="space-y-4 lg:sticky lg:top-6" aria-label="Public page readiness">
      <section className="border-t-2 border-hairline-strong bg-canvas-soft p-4">
        <p className="text-caption font-bold uppercase tracking-wider text-accent">
          Public page readiness
        </p>
        <p className="mt-2 font-serif text-display-sm font-semibold text-ink">
          {readinessPercent(readiness)}%
        </p>
        <ul className="mt-3 divide-y divide-hairline border-y border-hairline">
          {readiness.map(([label, complete]) => (
            <li
              key={label}
              className={`py-2 text-caption font-bold ${complete ? 'text-ink' : 'text-body-muted'}`}
            >
              <span className="mr-2" aria-hidden="true">
                {complete ? '✓' : '○'}
              </span>
              {label}
            </li>
          ))}
        </ul>
        {hasPost && publicHref && (
          <a
            href={publicHref}
            target="_blank"
            rel="noopener"
            className="mt-4 flex min-h-[44px] items-center justify-between border border-hairline-strong px-3 text-caption font-bold text-ink no-underline hover:bg-canvas"
          >
            <span>Open public preview</span>
            <span aria-hidden="true">↗</span>
          </a>
        )}
      </section>
      <section className="border border-hairline bg-canvas p-4">
        <p className="text-caption font-bold uppercase tracking-wider text-accent">
          Automatic mapping
        </p>
        <dl className="mt-3 divide-y divide-hairline text-caption">
          {[
            ['Title', 'Featured presentation'],
            ['Summary', 'Lead paragraph'],
            ['Date', 'Sequence + URL'],
            ['Location', 'Event rail + map'],
            ['H2 / H3', 'On this page'],
            ['Media', 'Cover + gallery'],
          ].map(([source, output]) => (
            <div key={source} className="grid grid-cols-[1fr_auto_1fr] gap-2 py-2">
              <dt className="text-body-muted">{source}</dt>
              <span aria-hidden="true">→</span>
              <dd className="m-0 text-right font-bold text-ink">{output}</dd>
            </div>
          ))}
        </dl>
      </section>
    </aside>
  );
}
