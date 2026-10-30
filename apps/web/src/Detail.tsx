import { ArrowUpRight, Check, EyeOff, X } from 'lucide-react';

import type { RankedTitle, WatchState } from '@shukannia/domain';

import { number } from './utils.js';
export function Detail({
  item,
  state,
  baseline,
  filterOnly,
  onClose,
  onChange,
}: {
  item: RankedTitle;
  state: WatchState | undefined;
  baseline: number;
  filterOnly: boolean;
  onClose: () => void;
  onChange: (v: Partial<WatchState>) => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal help-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Why ${item.name} matched`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">WHY THIS STORY?</span>
            <h2>{item.name}</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close details"
            onClick={onClose}
          >
            <X />
          </button>
        </div>
        <p>
          {item.series_name &&
            `${item.series_name} · Season ${item.season ?? '?'} · Episode ${item.episode_number ?? '?'} · `}
          {item.original_year ?? 'Year unknown'}
        </p>
        <dl>
          <dt>Selection rank</dt>
          <dd>#{number(item.rank)} by score</dd>
          <dt>Matched genres</dt>
          <dd>{item.matched_tags.join(', ')}</dd>
          <dt>Genre provenance</dt>
          <dd>
            {item.provenance === 'inherited'
              ? 'Inherited from parent series'
              : item.provenance === 'demo'
                ? 'Fictional demo metadata'
                : 'IMDb title genres'}
          </dd>
          <dt>Summed relevance</dt>
          <dd>{item.relevance.toFixed(3)}</dd>
          <dt>Discovery score</dt>
          <dd>{number(item.score)}</dd>
        </dl>
        <div className="formula-note">
          {filterOnly ? (
            <>
              {number(item.num_votes)} × ({item.average_rating} −{' '}
              {baseline.toFixed(3)}) (genre filter only)
            </>
          ) : (
            <>
              {item.relevance.toFixed(3)} × {item.relevance < 0 ? '| ' : '('}
              {number(item.num_votes)} × ({item.average_rating} −{' '}
              {baseline.toFixed(3)}){item.relevance < 0 ? ' |' : ')'}
            </>
          )}
        </div>
        <p className="muted small">
          Year-level chronology. Within-year order is by IMDb ID.
        </p>
        <div className="modal-actions">
          <button
            className="secondary"
            onClick={() => onChange({ hidden: true })}
          >
            <EyeOff size={15} />
            Hide title
          </button>
          {item.provenance !== 'demo' && (
            <a
              className="secondary"
              target="_blank"
              rel="noreferrer"
              href={`https://www.imdb.com/title/${item.imdb_id}/`}
            >
              IMDb
              <ArrowUpRight size={15} />
            </a>
          )}
          <button
            className="primary"
            onClick={() =>
              onChange({
                watched_at: state?.watched_at ? null : new Date().toISOString(),
              })
            }
          >
            <Check size={16} />
            {state?.watched_at ? 'Mark unwatched' : 'Mark watched'}
          </button>
        </div>
      </section>
    </div>
  );
}
