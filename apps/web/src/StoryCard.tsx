import { ArrowUpRight, Check, Film, Tv } from 'lucide-react';

import { RankedTitle } from '../../../packages/domain/src/index.js';
import { AppModel } from './useAppModel.js';
import { compact } from './utils.js';
export function StoryCard({ model, t }: { model: AppModel; t: RankedTitle }) {
  const { setDetail, changeState } = model;
  return (
    <article
      key={t.imdb_id}
      className={`story ${t.watched_at ? 'is-watched' : ''}`}
    >
      <div className={`story-art art-${(t.original_year ?? 0) % 5}`}>
        <span>
          {t.title_type === 'tvEpisode' ? (
            <Tv size={24} strokeWidth={1} />
          ) : (
            <Film size={24} strokeWidth={1} />
          )}
        </span>
        <small>{t.title_type === 'tvEpisode' ? 'EPISODE' : 'FILM'}</small>
      </div>
      <div className="story-info">
        <div className="story-meta">
          <span
            className={
              t.title_type === 'tvEpisode' ? 'type-tag episode' : 'type-tag'
            }
          >
            {t.title_type === 'tvEpisode'
              ? 'TV EPISODE'
              : t.title_type === 'tvMovie'
                ? 'TV MOVIE'
                : 'MOVIE'}
          </span>
          <span>{t.genres.slice(0, 2).join(' / ')}</span>
        </div>
        <button className="story-title" onClick={() => setDetail(t)}>
          {t.name}
        </button>
        <p>
          {storyDescription(t)}
          {t.provenance === 'inherited' && (
            <span className="inherit-tag">Inherited genres</span>
          )}
        </p>
      </div>
      <div className="story-rating">
        <span className="rating-star">★</span>
        <strong>{t.average_rating.toFixed(1)}</strong>
        <small>{compact(t.num_votes)} votes</small>
      </div>
      <div className="story-score">
        <strong className={t.score < 0 ? 'negative' : ''}>
          {t.score > 0 ? '+' : ''}
          {compact(t.score)}
        </strong>
        <small>discovery score</small>
      </div>
      <button
        className={`watched-button ${t.watched_at ? 'checked' : ''}`}
        aria-label={
          t.watched_at ? `Mark ${t.name} unwatched` : `Mark ${t.name} watched`
        }
        title={t.watched_at ? 'Mark unwatched' : 'Mark watched'}
        onClick={() =>
          void changeState(t.imdb_id, {
            watched_at: t.watched_at ? null : new Date().toISOString(),
          })
        }
      >
        <Check size={17} />
      </button>
      <button
        className="icon-button story-more"
        aria-label={`Details for ${t.name}`}
        onClick={() => setDetail(t)}
      >
        <ArrowUpRight size={18} />
      </button>
    </article>
  );
}

function storyDescription(t: RankedTitle): string {
  return t.series_name
    ? `${t.series_name} · S${String(t.season ?? '?').padStart(2, '0')} E${String(t.episode_number ?? '?').padStart(2, '0')}`
    : `${t.original_year ?? 'Year unknown'} · A story worth discovering`;
}
